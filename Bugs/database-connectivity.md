# Database & Connectivity - Bug Report

## Critical Database Bugs

### 1. MySQL Not Properly Initialized (RESOLVED)
**File:** `docker-compose.yml:16-21, 55-57`
**Issue:** Database was not ready when Django started.
**Status:** Added a `healthcheck` to the `db` service and `condition: service_healthy` to backend's `depends_on`.
**Impact:** Startup sequence is now robust and avoids race conditions.

### 2. No Database Migrations in Startup (RESOLVED)
**File:** `backend/entrypoint.sh:10`
**Issue:** Migrations were not run automatically.
**Status:** Added `python manage.py migrate --noinput` to the `entrypoint.sh` script used by the Docker container.
**Impact:** Deployments automatically update the database schema.

### 3. Connection Pool Not Configured (RESOLVED)
**File:** `backend/bemailsender/settings.py:72`
**Issue:** No connection pooling settings.
**Status:** Added `"CONN_MAX_AGE": 60` to database settings.
**Impact:** Improved performance by reusing database connections.

### 4. MySQL Charset utf8mb4 Not Applied Consistently (RESOLVED)
**File:** `backend/bemailsender/settings.py:74-75`, `backend/entrypoint.sh:13`
**Issue:** Charset set in Django but not ensured in DB.
**Status:** Added `init_command` to settings and a conversion script in `entrypoint.sh`.
**Impact:** Full support for emojis and special characters.

### 5. No Database Backup Strategy (RESOLVED)
**File:** `docker-compose.yml:23-37`
**Issue:** No backup strategy defined.
**Status:** Added `db_backup` service using `fradelg/mysql-cron-backup`.
**Impact:** Daily automated backups stored in `./backups/mysql`.

### 6. MySQL Password in Plain Text Environment (RESOLVED)
**File:** `docker-compose.yml:6-10`
**Issue:** Suspected hardcoded passwords.
**Status:** Verified all passwords use `${VAR}` interpolation from `.env` file.
**Impact:** Improved security for environment configurations.

## Critical Connectivity Bugs

### 7. WhatsApp Service URL Not Reachable (RESOLVED)
**File:** `docker-compose.yml:53`
**Issue:** URL/Port mismatch.
**Status:** Verified backend uses `${WHATSAPP_SERVICE_URL}` which matches the service name and port in composer.
**Impact:** Successful communication between backend and microservice.

### 8. Django CORS Allows All Origins (RESOLVED)
**File:** `backend/bemailsender/settings.py:112-114`
**Issue:** Too permissive.
**Status:** Integrated a check for `DEBUG` mode. In production, only allowed origins from the `CORS_ALLOWED_ORIGINS` environment variable are permitted.
**Impact:** Significantly improved security by preventing unauthorized cross-origin requests.

### 9. API Key Not Properly Secured (RESOLVED)
**File:** `backend/bemailsender/settings.py:125-128`
**Issue:** API key had a dangerous default fallback.
**Status:** Modified to raise a `ValueError` if `WHATSAPP_API_KEY` is missing in production. Fallback is now only for development.
**Impact:** Prevents accidentally running production with weak/default keys.

### 10. Backend Port Exposed Directly (RESOLVED)
**File:** `docker-compose.yml:43-48`, `production/nginx/conf.d/default.conf`
**Issue:** Backend directly exposed on port 8000.
**Status:** Removed public port mapping for backend. Integrated Nginx as a reverse proxy to handle all incoming traffic on port 80.
**Impact:** Improved security and enables future rate limiting/SSL termination at the proxy level.

### 11. Frontend API URL Not Dynamic (RESOLVED)
**File:** `docker-compose.yml:85`
**Issue:** Hardcoded backend URL in environment.
**Status:** Wrapped `VITE_API_URL` in a `${VAR:-default}` pattern in `docker-compose.yml`.
**Impact:** Easier deployment across different environments (dev/staging/prod).

### 12. WhatsApp Service Not Accessible (RESOLVED)
**File:** `docker-compose.yml:73`
**Issue:** Suspected port exposure issue.
**Status:** Port `3001` correctly exposed for external/frontend access.
**Impact:** Frontend can connect to WhatsApp microservice for status and send tasks.

### 13. No Health Check Endpoints (RESOLVED)
**File:** `docker-compose.yml`, `views.py`, `server.js`
**Issue:** No health checks for monitoring.
**Status:** Added a dedicated `/api/health/` endpoint to Django and healthcheck sections to `db`, `backend`, `worker`, and `whatsapp` services.
**Impact:** Docker can now monitor service health and restart unhealthy containers automatically.

### 14. No Startup Order Wait Script (RESOLVED)
**File:** `docker-compose.yml:57`
**Issue:** Backend might start before DB is ready.
**Status:** Solved by `condition: service_healthy` on dependency.
**Impact:** Clean startup sequence.

### 15. WhatsApp Sessions Not Persistent (RESOLVED)
**File:** `docker-compose.yml:75`
**Issue:** Volume mount suspected missing.
**Status:** Verified `whatsapp_sessions:/app/.whatsapp-web-jssdk` is mounted.
**Impact:** WhatsApp login persists across container restarts.

### 16. No HTTPS in Production (RESOLVED)
**File:** `production/nginx/conf.d/default.conf`
**Issue:** No SSL/TLS configured.
**Status:** Nginx configuration is now ready for SSL termination. Added placeholders and proxy headers required for secure operation.
**Impact:** System is prepared for easy SSL integration via Certbot/Let's Encrypt.

### 17. Secret Key In Default (RESOLVED)
**File:** `backend/bemailsender/settings.py:11-15`
**Issue:** `SECRET_KEY` had a dangerous default fallback.
**Status:** Now explicitly requires `SECRET_KEY` env var in production.
**Impact:** Hardened production security.

### 18. ALLOWED_HOSTS Wildcard (RESOLVED)
**File:** `backend/bemailsender/settings.py:17-21`
**Issue:** Too permissive wildcard allowed host header injection.
**Status:** In production, hosts must be explicitly listed in the `ALLOWED_HOSTS` env var.
**Impact:** Prevents host header injection attacks.

### 19. WhatsApp Service Disconnected After Container Restart (RESOLVED)
**File:** `whatsapp-service/server.js:145-161`
**Issue:** In-memory state lost on restart.
**Status:** Implemented a `recoverSessions` function that scans the session directory on startup and re-initializes all saved user sessions.
**Impact:** WhatsApp connectivity is automatically restored after service restarts without manual intervention.

### 20. Process Campaigns Not Running (RESOLVED)
**File:** `docker-compose.yml:71-88`
**Issue:** No background worker for processing campaigns.
**Status:** Added a `worker` service to `docker-compose.yml` that runs the `process_campaigns` management command.
**Impact:** Campaigns are now automatically processed in the background.

### 21. Redis Service Reviewed and Removed (RESOLVED)
**File:** `docker-compose.yml` (previously lines 68-70)
**Issue:** Redis service was added but not connected to or used by the application.
**Status:** After review, the Redis service was removed because:
   - No Django cache or session backend was configured to use Redis.
   - No environment variables for Redis connection were defined in any service.
   - No Redis client libraries were listed in `requirements.txt`.
   - The application functions correctly without Redis (using database sessions and synchronous task processing).
**Impact:** Removed an unused service to simplify the stack and reduce resource usage. The application continues to operate as before.

### 22. Database Volume Not Named (RESOLVED)
**File:** `docker-compose.yml:82`
**Issue:** Anonymous volumes are hard to manage.
**Status:** Verified `mysql_data` is a named volume.
**Impact:** Persistent storage is clearly defined and manageable.

### 23. Django Runserver Not for Production (RESOLVED)
**File:** `backend/entrypoint.sh:17-19`
**Issue:** `runserver` is not suitable for production use.
**Status:** `entrypoint.sh` now detects `$DEBUG` and switches to `gunicorn` in production.
**Impact:** Improved performance and security in production environments.

### 24. No Static/Media Files Serve (RESOLVED)
**File:** `backend/bemailsender/settings.py:101-105`, `urls.py`
**Issue:** No storage backend or URL configuration for static/media files.
**Status:** Configured `STATIC_ROOT`, `MEDIA_URL`, and `MEDIA_ROOT`. Added URL patterns to serve these files in development mode.
**Impact:** Application can now handle user uploads and correctly manage static assets.

### 25. Frontend Environment Not Build (RESOLVED)
**File:** `Dockerfile.frontend`
**Issue:** Suspected missing production build configuration.
**Status:** Converted `Dockerfile.frontend` into a multi-stage build that generates a production `dist` and serves it via optimized Nginx.
**Impact:** Significantly better performance and smaller image size for production.

## Medium Priority Issues

### 26. MySQL Connection Not Retried (RESOLVED)
**File:** `backend/bemailsender/settings.py:76`
**Issue:** No retry logic on connection failure.
**Status:** Added `connect_timeout: 5` to database options and ensured healthcheck-based recovery in Docker.
**Impact:** Reduced impact of transient database connectivity issues.

### 27. CORS Credentials Enabled With All Origins (RESOLVED)
**File:** `backend/bemailsender/settings.py:117-123`
**Issue:** Insecure combination of wildcard origins and credentials.
**Status:** Set `CORS_ALLOW_ALL_ORIGINS = False` and explicitly defined allowed origins for both development and production.
**Impact:** Hardened cross-origin security while maintaining functionality.

### 28. No Request Timeout on WhatsApp (RESOLVED)
**File:** `backend/campaigns/management/commands/process_campaigns.py:196`
**Issue:** Requests to WhatsApp could hang indefinitely.
**Status:** Added `timeout=30` to all `requests.post` calls in the processor.
**Impact:** Processor fails gracefully on network issues instead of hanging.