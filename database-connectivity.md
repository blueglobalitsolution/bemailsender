# Database & Connectivity Issues

## Database Design Issues

### 1. MySQL Not Properly Initialized
- **File:** `docker-compose.yml:4-14`
- **Issue:** `depends_on` only waits for container, not MySQL ready
- **Impact:** Django crashes on startup until MySQL is ready

### 2. No Database Migrations in Startup
- **File:** `Dockerfile.backend:17`
- **Issue:** No `migrate` command before runserver
- **Impact:** New deployments fail

### 3. No Connection Pooling
- **File:** `settings.py:64-76`
- **Issue:** No `CONN_MAX_AGE` setting
- **Impact:** Connection overhead per request

### 4. MySQL Charset utf8mb4
- **File:** `settings.py:72-74`
- **Issue:** Charset not applied to existing tables
- **Impact:** Emoji content fails

### 5. No Backup Strategy
- **File:** `docker-compose.yml`
- **Impact:** Data loss risk

### 6. MySQL Password in Plain Text
- **File:** `docker-compose.yml:10`
- **Impact:** Security vulnerability

---

## Connectivity Issues

### 7. WhatsApp Service URL Mismatch
- **File:** `docker-compose.yml:30`
- **Issue:** Backend expects port 3001, but service defaults to 3002
- **Impact:** WhatsApp API calls fail

### 8. CORS Allows All Origins
- **File:** `settings.py:110`
- **Issue:** `CORS_ALLOW_ALL_ORIGINS = True`
- **Impact:** Security vulnerability

### 9. Weak Default API Key
- **File:** `settings.py:119-121`
- **Issue:** Fallback to default key in code
- **Impact:** Weak authentication

### 10. Backend Port Exposed Directly
- **File:** `docker-compose.yml:20-21`
- **Impact:** No rate limiting

### 11. Frontend API URL Hardcoded
- **File:** `docker-compose.yml:42`
- **Impact:** Doesn't work in different networks

### 12. WhatsApp Service Not Accessible
- **File:** `docker-compose.yml:48-49`
- **Impact:** Frontend cannot connect

### 13. No Health Check Endpoints
- **Impact:** Cannot monitor services

### 14. No Startup Wait Script
- **File:** `Dockerfile.backend`
- **Impact:** Race conditions

### 15. WhatsApp Sessions Not Persistent
- **File:** `docker-compose.yml:50-51`
- **Impact:** Sessions lost on restart

### 16. No HTTPS
- **Impact:** Data unencrypted

### 17. Default Django Secret Key
- **File:** `settings.py:11-13`
- **Impact:** Weak encryption

### 18. ALLOWED_HOSTS Wildcard
- **File:** `settings.py:17`
- **Impact:** Host header injection

### 19. Campaign Processor Missing
- **File:** `docker-compose.yml`
- **Issue:** No worker service to process campaigns
- **Impact:** Campaigns never run

### 20. No Redis
- **Impact:** Can't scale processing

### 21. Using Runserver
- **File:** `Dockerfile.backend`
- **Impact:** Poor production performance