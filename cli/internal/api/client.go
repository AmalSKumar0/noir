package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"noir-cli/internal/auth"
	"noir-cli/internal/config"
)

type Client struct {
	BaseHost   string
	HTTPClient *http.Client
}

func NewClient() *Client {
	rawURL := os.Getenv("API_KEY")
	if rawURL == "" || (!strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://")) {
		rawURL = "https://api.amalskumar.dev"
	}
	if rawURL == "" {
		rawURL = config.GetBackendURL()
	}
	if rawURL == "" {
		rawURL = config.DefaultBackend
	}

	cleanURL := config.NormalizeBackendURL(rawURL)
	if strings.HasSuffix(cleanURL, "/api") {
		cleanURL = cleanURL[:len(cleanURL)-4]
	}

	return &Client{
		BaseHost: cleanURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) BuildURL(path string) string {
	cleanPath := strings.TrimLeft(path, "/")
	if strings.HasPrefix(cleanPath, "api/") {
		return fmt.Sprintf("%s/%s", c.BaseHost, cleanPath)
	}
	return fmt.Sprintf("%s/api/%s", c.BaseHost, cleanPath)
}

func (c *Client) Login(email, password string) (map[string]interface{}, error) {
	url := c.BuildURL("/accounts/login/")
	payload := map[string]string{
		"email":    email,
		"password": password,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error during login: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errData map[string]interface{}
		_ = json.Unmarshal(body, &errData)
		if detail, ok := errData["detail"].(string); ok && detail != "" {
			return nil, fmt.Errorf("%s", detail)
		}
		return nil, fmt.Errorf("login failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("invalid json response from server: %w", err)
	}

	return result, nil
}

func (c *Client) GetOAuthURL(provider string) string {
	return c.BuildURL(fmt.Sprintf("/accounts/%s/login/?client=cli", provider))
}

func (c *Client) ObtainTokens(code string) (map[string]interface{}, error) {
	url := c.BuildURL("/accounts/common-auth/callback/")
	payload := map[string]string{
		"code": code,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("network error obtaining tokens: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errMap map[string]interface{}
		_ = json.Unmarshal(body, &errMap)
		if detail, ok := errMap["detail"].(string); ok && detail != "" {
			return nil, fmt.Errorf("%s", detail)
		}
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse token json: %w", err)
	}

	_ = auth.SaveToken(result)
	return result, nil
}

func (c *Client) SendRequest(path, method string, data interface{}) (interface{}, error) {
	return c.sendRequestInternal(path, method, data, true)
}

func (c *Client) sendRequestInternal(path, method string, data interface{}, retry bool) (interface{}, error) {
	if !auth.HasTokens() {
		return nil, fmt.Errorf("User data not found. Please run 'noir login'")
	}

	fullURL := c.BuildURL(path)
	var bodyReader io.Reader
	if data != nil {
		jsonBytes, err := json.Marshal(data)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewBuffer(jsonBytes)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", auth.GetAccessToken()))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to %s failed: %w", path, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized && retry {
		// Attempt token refresh
		refreshToken := auth.GetRefreshToken()
		if refreshToken != "" {
			refreshURL := c.BuildURL("/accounts/token/refresh/")
			refPayload, _ := json.Marshal(map[string]string{"refresh": refreshToken})
			refReq, refErr := http.NewRequest(http.MethodPost, refreshURL, bytes.NewBuffer(refPayload))
			if refErr == nil {
				refReq.Header.Set("Content-Type", "application/json")
				refResp, doErr := c.HTTPClient.Do(refReq)
				if doErr == nil {
					defer refResp.Body.Close()
					if refResp.StatusCode >= 200 && refResp.StatusCode < 300 {
						var newTokens map[string]interface{}
						if err := json.NewDecoder(refResp.Body).Decode(&newTokens); err == nil {
							_ = auth.SaveToken(newTokens)
							return c.sendRequestInternal(path, method, data, false)
						}
					}
				}
			}
		}
		return nil, fmt.Errorf("Session expired. Please run 'noir login'")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errData map[string]interface{}
		if err := json.Unmarshal(body, &errData); err == nil {
			if detail, ok := errData["detail"].(string); ok && detail != "" {
				return nil, fmt.Errorf("%s", detail)
			}
			if errMsg, ok := errData["error"].(string); ok && errMsg != "" {
				return nil, fmt.Errorf("%s", errMsg)
			}
		}
		return nil, fmt.Errorf("request failed with status %d: %s", resp.StatusCode, string(body))
	}

	if len(body) == 0 {
		return map[string]interface{}{}, nil
	}

	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return string(body), nil
	}
	return result, nil
}
