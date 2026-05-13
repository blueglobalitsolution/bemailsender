# WhatsApp Service - Bug Report

## Critical Bugs

### 1. WhatsApp Service Port Mismatch
**File:** `whatsapp-service/server.js:8`
**Issue:** Default port is 3002 but Docker exposes 3001:
```javascript
const PORT = process.env.PORT || 3002;  // Default 3002
# docker-compose.yml maps 3001:3001
```
**Impact:** Container may start on wrong port.

### 2. WhatsApp Session Not Shared Across Container Restarts
**File:** `whatsapp-service/server.js:37-42`
**Issue:** LocalAuth stores session in container filesystem:
```javascript
authStrategy: new LocalAuth({ clientId: `user-${userId}` }),
# Stored in .whatsapp-web-jssdk which persists
# BUT: Multiple user sessions not isolated
```
**Impact:** Sessions lost or conflict on container recreation.

### 3. WhatsApp userId Not Actually Used
**File:** `whatsapp-service/server.js:31-78`
**Issue:** Per-user client created but no verification of user ownership:
```javascript
async function getWhatsAppClient(userId) {
    # Uses userId for clientId but no auth check
}
```
**Impact:** Any user can send from any connected WhatsApp.

### 4. Message Variable Replacement Not Done
**File:** `whatsapp-service/server.js:120-144`
**Issue:** Raw message sent without variable replacement:
```javascript
await client.sendMessage(chatId, message);  # No {{variable}} replacement
```
**Impact:** Dynamic content not working for WhatsApp.

### 5. Phone Number Format Not Validated
**File:** `whatsapp-service/server.js:135-136`
**Issue:** Simple regex for phone cleaning:
```javascript
let chatId = recipient.replace(/\D/g, "");
if (!chatId.endsWith("@c.us")) chatId += "@c.us";
```
**Impact:** Invalid phone numbers cause failures.

### 6. No Message Queue - Race Conditions
**File:** `whatsapp-service/server.js`
**Issue:** Synchronous send without queue:
```javascript
await client.sendMessage(chatId, message);
# Multiple campaigns can send simultaneously
```
**Impact:** Rate limiting not enforced, possible bans.

### 7. Session Auth Not Linked to Django User
**File:** `whatsapp-service/server.js:101-106`
**Issue:** Client created but no verification it's same user:
```javascript
app.post("/api/whatsapp/initialize", authenticateApiKey, async (req, res) => {
    const { userId } = req.body;  # UserId from body, not verified
    ...
```
**Impact:** User can initialize other user's WhatsApp.

### 8. WhatsApp Status Doesn't Persist In-Memory
**File:** `whatsapp-service/server.js:27-29`
**Issue:** Status maps in memory, lost on restart:
```python
const whatsappStatuses = new Map();
# Lost when container restarts
```
**Impact:** Status shows wrong after restart.

### 9. No Error Recovery On Client Failure
**File:** `whatsapp-service/server.js:55-66`
**Issue:** Failed client not restarted:
```javascript
client.on("disconnected", () => {
    whatsappStatuses.set(userId, "disconnected");
    whatsappClients.delete(userId);
    # No auto-reconnect
});
```
**Impact:** Must manually reconnect after disconnect.

### 10. QR Code Expires But No Refresh
**File:** `whatsapp-service/server.js:45-52`
**Issue:** QR generated once, no refresh:
```javascript
client.on("qr", async (qr) => {
    const qrDataUri = await QRCode.toDataURL(qr);
    # Old QR never refreshed
});
```
**Impact:** Old QR becomes useless after scan.

## Medium Priority Bugs

### 11. Django Logging Not Authenticated
**File:** `whatsapp-service/server.js:80-93`
**Issue:** Log to Django uses only API key, no user verification:
```javascript
await fetch(`${DJANGO_URL}/api/logs/`, {
    method: "POST",
    headers: {
        "Authorization": `Bearer ${API_KEY}`  # Only API key
    }
```
**Impact:** Logs can be spoofed.

### 12. No Connection Health Check
**File:** `whatsapp-service/server.js`
**Issue:** No /health endpoint.
**Impact:** Cannot monitor service health.

### 13. Timeout Not Set on Initialize
**File:** `whatsapp-service/server.js:72-77`
**Issue:** No timeout on client initialization:
```javascript
await client.initialize();  # Can hang forever
```
**Impact:** Hangs block service.

### 14. WhatsApp Service Not Integrated With Campaign Processor
**File:** `backend/campaigns/management/commands/process_campaigns.py:158-188`
**Issue:** Uses separate API call but doesn't verify user matches:
```python
"userId": campaign.user.id  # May not match WhatsApp user
```
**Impact:** Wrong user sending.

### 15. No Message Status Feedback
**File:** `whatsapp-service/server.js:134-143`
**Issue:** Only returns generic success/failure:
```javascript
res.json({ success: true });
# No delivery status
```
**Impact:** Can't track message delivery.

### 16. Docker Volume Not Properly Configured
**File:** `docker-compose.yml:50-51`
**Issue:** Session volume may not persist:
```yaml
volumes:
  - whatsapp_sessions:/app/.whatsapp-web-jssdk
# But path might be different
```
**Impact:** Sessions lost on restart.

### 17. Puppeteer Headless Issues in Docker
**File:** `whatsapp-service/server.js:39-42`
**Issue:** Missing display server args:
```javascript
puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
}
# Missing --disable-gpu for some systems
```
**Impact:** May not work in some Docker environments.

### 18. WhatsApp Service Not Using Redis for Sessions
**File:** `whatsapp-service/server.js`
**Issue:** In-memory sessions can't scale:
```javascript
const whatsappClients = new Map();
# No external session store
```
**Impact:** Can't run multiple instances.

### 19. API Key Header Case Sensitive
**File:** `whatsapp-service/server.js:19-25`
**Issue:** Header name case sensitive:
```javascript
const apiKey = req.headers["x-api-key"];  # Lowercase
# HTTP spec says header names case-insensitive
# But some clients send different case
```
**Impact:** Some API calls fail.

### 20. WhatsApp QR Display Not Working
**File:** `frontend/src/pages/WhatsApp.tsx:88-97`
**Issue:** QR displayed but not auto-refreshed:
```javascript
{status === 'qr' && qr && (
    <img src={qr} alt="WhatsApp QR Code" className="w-64 h-64" />
    # No polling to refresh QR
)}
```
**Impact:** QR may be stale.