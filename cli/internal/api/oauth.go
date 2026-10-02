package api

import (
	"context"
	"fmt"
	"html"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type OAuthResult struct {
	AuthData map[string]interface{}
	Error    error
}

type OAuthServer struct {
	Host     string
	Port     int
	server   *http.Server
	resultCh chan OAuthResult
	client   *Client
}

func NewOAuthServer(client *Client) *OAuthServer {
	return &OAuthServer{
		Host:     "127.0.0.1",
		Port:     53145,
		resultCh: make(chan OAuthResult, 1),
		client:   client,
	}
}

func (s *OAuthServer) Start(timeout time.Duration) (map[string]interface{}, error) {
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)

	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("port %d is already in use: %w", s.Port, err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("/auth/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		oauthErr := q.Get("error")
		code := q.Get("authcode")

		if oauthErr != "" {
			errStr := fmt.Sprintf("OAuth provider error: %s", oauthErr)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(getOAuthErrorHTML(errStr)))
			s.resultCh <- OAuthResult{Error: fmt.Errorf("%s", errStr)}
			return
		}

		if code == "" {
			errStr := "Missing authorization code (authcode) in callback."
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(getOAuthErrorHTML(errStr)))
			s.resultCh <- OAuthResult{Error: fmt.Errorf("%s", errStr)}
			return
		}

		data, err := s.client.ObtainTokens(code)
		if err != nil {
			errStr := fmt.Sprintf("Token exchange failed: %v", err)
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(getOAuthErrorHTML(errStr)))
			s.resultCh <- OAuthResult{Error: err}
			return
		}

		username := "Developer"
		if user, ok := data["user"].(map[string]interface{}); ok {
			if u, ok := user["username"].(string); ok && u != "" {
				username = u
			} else if e, ok := user["email"].(string); ok && e != "" {
				username = e
			}
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(getOAuthSuccessHTML(username)))

		s.resultCh <- OAuthResult{AuthData: data}
	})

	s.server = &http.Server{
		Handler: mux,
	}

	go func() {
		_ = s.server.Serve(listener)
	}()

	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = s.server.Shutdown(ctx)
	}()

	select {
	case res := <-s.resultCh:
		return res.AuthData, res.Error
	case <-time.After(timeout):
		return nil, fmt.Errorf("timed out waiting for browser authentication (%v)", timeout)
	}
}

// OpenBrowser opens specified URL in developer default browser.
func OpenBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported platform")
	}
	return cmd.Start()
}

func getOAuthSuccessHTML(username string) string {
	escapedUser := html.EscapeString(username)
	tmpl := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noir CLI - Authenticated</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #08080a;
            color: #f5f5f4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
        }
        .card {
            background: linear-gradient(180deg, rgba(30, 27, 46, 0.7) 0%, rgba(18, 16, 28, 0.85) 100%);
            border: 1px solid rgba(139, 92, 246, 0.25);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(139, 92, 246, 0.1);
            backdrop-filter: blur(12px);
        }
        .logo {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1.5px;
            margin-bottom: 24px;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }
        .logo span { color: #8b5cf6; }
        .icon-circle {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 32px;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }
        h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        p {
            font-size: 14px;
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .user-tag {
            display: inline-block;
            background: rgba(139, 92, 246, 0.12);
            border: 1px solid rgba(139, 92, 246, 0.3);
            color: #c4b5fd;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
        }
        .footer-note {
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">NO<span>IR_</span></div>
        <div class="icon-circle">✓</div>
        <h1>Authentication Successful</h1>
        <div class="user-tag">{{USERNAME}}</div>
        <p>Your Noir developer session has been established. You can now close this browser tab and return to your terminal.</p>
        <div class="footer-note">Credentials stored securely</div>
    </div>
</body>
</html>`
	return strings.Replace(tmpl, "{{USERNAME}}", escapedUser, 1)
}

func getOAuthErrorHTML(errorMsg string) string {
	escapedErr := html.EscapeString(errorMsg)
	tmpl := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noir CLI - Authentication Failed</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background-color: #08080a;
            color: #f5f5f4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
        }
        .card {
            background: linear-gradient(180deg, rgba(30, 27, 46, 0.7) 0%, rgba(18, 16, 28, 0.85) 100%);
            border: 1px solid rgba(239, 68, 68, 0.25);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 0.1);
            backdrop-filter: blur(12px);
        }
        .logo {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1.5px;
            margin-bottom: 24px;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }
        .logo span { color: #ef4444; }
        .icon-circle {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 32px;
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
        }
        h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        p {
            font-size: 14px;
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .footer-note {
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">NO<span>IR_</span></div>
        <div class="icon-circle">✕</div>
        <h1>Authentication Failed</h1>
        <p>{{ERROR}}</p>
        <div class="footer-note">Please return to your terminal and try again</div>
    </div>
</body>
</html>`
	return strings.Replace(tmpl, "{{ERROR}}", escapedErr, 1)
}
