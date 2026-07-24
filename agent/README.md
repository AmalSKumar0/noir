## Current Folder Structure
The current folder structure is as follows:
```plain
noir/
├── noir
│   ├── api
│   │   ├── client.py
│   │   └── __init__.py
│   ├── auth
│   │   ├── __init__.py
│   │   └── storage.py
│   ├── cli.py
│   ├── commands
│   │   ├── __init__.py
│   │   ├── init.py
│   │   ├── login.py
│   │   ├── logout.py
│   │   └── whoami.py
│   ├── config
│   │   ├── __init__.py
│   │   └── settings.py
│   ├── __init__.py
│   ├── __main__.py
│   ├── __pycache__
│   │   ├── __init__.cpython-314.pyc
│   │   └── __main__.cpython-314.pyc
│   └── utils
│       ├── __init__.py
│       └── logger.py
├── pyproject.toml
├── README.md
├── tests
└── uv.lock
```



## Authentication in our CLI

```
               Noir CLI
                   │
                   │ 1. Generate PKCE verifier/challenge
                   │
                   ▼
        Start localhost:53145
                   │
                   ▼
             Open Browser
                   │
                   ▼
        https://noir.ai/login?cli=1
&redirect_uri=http://127.0.0.1:53145/callback
              &code_challenge=...
                   │
                   ▼
           React Login Page
                   │
                   ▼
        Google / GitHub / Email
                   │
                   ▼
         Django Authentication
                   │
                   ▼
        Create authorization code
        (valid for ~60 seconds)
                   │
                   ▼
                Redirect

http://127.0.0.1:53145/callback?code=abc123
                   │
                   ▼
            CLI exchanges code
                   │
                   ▼
            JWT Access + Refresh
                   │
                   ▼
            Store Refresh Token
```