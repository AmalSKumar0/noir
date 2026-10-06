from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
import os

load_dotenv()


GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")


# Service Base URLs
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL")

# Redis Configuration (Supports REDIS_URL or host/port/db with optional SSL & password)
REDIS_URL = os.getenv("REDIS_URL")
REDIS_HOST = os.getenv("REDIS_HOST")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_USE_SSL = os.getenv("REDIS_USE_SSL", "False").lower() in ("true", "1")

if REDIS_URL:
    REDIS_LOCATION = REDIS_URL
elif REDIS_HOST:
    _scheme = "rediss" if REDIS_USE_SSL else "redis"
    _auth = f":{REDIS_PASSWORD}@" if REDIS_PASSWORD else ""
    REDIS_LOCATION = f"{_scheme}://{_auth}{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
else:
    REDIS_LOCATION = None

# Database Configuration (Supports DATABASE_URL or individual PSQL_* variables)
DATABASE_URL = os.getenv("DATABASE_URL")
PSQL_NAME = os.getenv("PSQL_NAME")
PSQL_USER = os.getenv("PSQL_USER")
PSQL_PASSWORD = os.getenv("PSQL_PASSWORD")
PSQL_HOST = os.getenv("PSQL_HOST")
PSQL_PORT = os.getenv("PSQL_PORT", "5432")
PSQL_SSLMODE = os.getenv("PSQL_SSLMODE")

if DATABASE_URL:
    import urllib.parse
    _url = urllib.parse.urlparse(DATABASE_URL)
    PSQL_NAME = _url.path.lstrip("/") if _url.path else ""
    PSQL_USER = _url.username or ""
    PSQL_PASSWORD = _url.password or ""
    PSQL_HOST = _url.hostname or ""
    PSQL_PORT = str(_url.port or 5432)
    _query = urllib.parse.parse_qs(_url.query)
    if "sslmode" in _query:
        PSQL_SSLMODE = _query["sslmode"][0]


# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/
from django.core.exceptions import ImproperlyConfigured

DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("SECRET_KEY", "")

if not DEBUG and (not SECRET_KEY or SECRET_KEY.startswith("django-insecure")):
    raise ImproperlyConfigured("In production (DEBUG=False), SECRET_KEY must be set to a secure secret in environment variables.")

ALLOWED_HOSTS_ENV = os.getenv("ALLOWED_HOSTS")
if ALLOWED_HOSTS_ENV:
    ALLOWED_HOSTS = [h.strip() for h in ALLOWED_HOSTS_ENV.split(",") if h.strip()]
elif DEBUG:
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "testserver",
        ".amazonaws.com",
        ".awsapprunner.com",
        ".elb.amazonaws.com",
    ]


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],

    "DEFAULT_THROTTLE_RATES": {
        "anon": "300/min",
        "user": "1200/min",
        "login": "10/min",
        "register": "10/min",
        "user_delete": "20/min",
    }
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=12),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'TOKEN_REFRESH_SERIALIZER': 'apps.accounts.serializers.SafeTokenRefreshSerializer',
}


# Application definition

INSTALLED_APPS = [
    'daphne',
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework',
    'corsheaders',
    'apps.accounts',
    'apps.cli',
    'apps.users',
    'apps.projects',
]

ASGI_APPLICATION = 'backend.asgi.application'

if REDIS_LOCATION:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_LOCATION],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    "core.middleware.RequestTimingMiddleware"
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

if PSQL_NAME and PSQL_HOST:
    _db_config = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": PSQL_NAME,
        "USER": PSQL_USER or "postgres",
        "PASSWORD": PSQL_PASSWORD or "",
        "HOST": PSQL_HOST,
        "PORT": int(PSQL_PORT) if str(PSQL_PORT).isdigit() else 5432,
    }
    if PSQL_SSLMODE:
        _db_config["OPTIONS"] = {"sslmode": PSQL_SSLMODE}
    DATABASES = {
        "default": _db_config
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

if REDIS_LOCATION:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_LOCATION,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# AWS & Reverse Proxy Configuration (ALB / CloudFront / App Runner)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

if not DEBUG and os.getenv("SECURE_SSL_REDIRECT", "False").lower() in ("true", "1"):
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", 31536000))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# CORS Configuration
CORS_ALLOWED_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL", "False").lower() in ("true", "1")

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "https://aistudio.google.com"
]

if FRONTEND_BASE_URL and FRONTEND_BASE_URL.rstrip('/') not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(FRONTEND_BASE_URL.rstrip('/'))

EXTRA_CORS = os.getenv("CORS_ALLOWED_ORIGINS")
if EXTRA_CORS:
    for origin in EXTRA_CORS.split(","):
        trimmed = origin.strip().rstrip('/')
        if trimmed and trimmed not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(trimmed)

CORS_ALLOW_CREDENTIALS = True

# CSRF Trusted Origins (Required for Django 4+ with reverse proxy & AWS domains)
CSRF_TRUSTED_ORIGINS_ENV = os.getenv("CSRF_TRUSTED_ORIGINS")
if CSRF_TRUSTED_ORIGINS_ENV:
    CSRF_TRUSTED_ORIGINS = [orig.strip().rstrip('/') for orig in CSRF_TRUSTED_ORIGINS_ENV.split(",") if orig.strip()]
else:
    CSRF_TRUSTED_ORIGINS = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    if FRONTEND_BASE_URL and FRONTEND_BASE_URL.rstrip('/') not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(FRONTEND_BASE_URL.rstrip('/'))
    if BACKEND_BASE_URL and BACKEND_BASE_URL.rstrip('/') not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(BACKEND_BASE_URL.rstrip('/'))

AUTH_USER_MODEL = "accounts.User"

# Max upload sizes (2 MB) to prevent RequestDataTooBig exceptions
DATA_UPLOAD_MAX_MEMORY_SIZE = 2097152
FILE_UPLOAD_MAX_MEMORY_SIZE = 2097152