"""
Django settings for BEmailSender project.
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DEBUG", "True") == "True"

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY and not DEBUG:
    raise ValueError("SECRET_KEY environment variable is required in production")
SECRET_KEY = SECRET_KEY or "django-insecure-dev-key-fallback"

ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("ALLOWED_HOSTS", "*").split(",") if h.strip()
]
if "*" in ALLOWED_HOSTS and not DEBUG:
    # In production, wildcard is dangerous. Default to empty if not set properly.
    ALLOWED_HOSTS = []

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "accounts",
    "campaigns",
    "gmaps_scraper",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "bemailsender.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "bemailsender.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "accounts.User"

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
    if cors_origins:
        CORS_ALLOWED_ORIGINS = cors_origins.split(",")
    else:
        # Default production origins
        CORS_ALLOWED_ORIGINS = [
            "http://mailer.blueglobaltechnology.com",
            "https://mailer.blueglobaltechnology.com",
        ]

CORS_ALLOW_CREDENTIALS = True

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://mailer.blueglobaltechnology.com")
TRACKING_BASE_URL = os.environ.get("TRACKING_BASE_URL", "https://mailer.blueglobaltechnology.com")


# Laya & Llama AI Service
LAYA_BASE_URL = os.environ.get("LAYA_BASE_URL", "http://127.0.0.1:8081/predict")
LAYA_REMOTE_URL = os.environ.get("LAYA_REMOTE_URL", "https://blueglobal.qzz.io/laya/predict")
LLAMA_BASE_URL = os.environ.get("LLAMA_BASE_URL", "http://127.0.0.1:8080/v1/chat/completions")
LLAMA_REMOTE_URL = os.environ.get("LLAMA_REMOTE_URL", "https://blueglobal.qzz.io/v1/chat/completions")
LAYA_API_KEY = os.environ.get("LAYA_API_KEY", "5e32cdb0b828536dcabf517d42f63865")
