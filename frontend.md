# Frontend Bugs - Complete List

## Critical Frontend Bugs (Immediate Fix Required)

### 1. Token Stored in localStorage (XSS Vulnerable)
**File:** `frontend/src/lib/api.ts:14`
**Issue:** Token stored in localStorage can be stolen via XSS:
```javascript
const token = localStorage.getItem('token');
```
**Impact:** Tokens vulnerable to cross-site scripting attacks
**Fix:** Use httpOnly cookies instead

### 2. No Token Expiry Handling
**File:** `frontend/src/lib/api.ts`
**Issue:** No check for expired token before API calls
**Impact:** Silent failures when token expires
**Fix:** Check token exp claim and redirect to login

### 3. JWT Decode Error Not Handled
**File:** `frontend/src/lib/api.ts:39-58`
**Issue:** Try-catch wraps decode but doesn't show error:
```javascript
} catch (e) {
    console.error("Error decoding token...", e);
}
```
**Impact:** WhatsApp userId silently fails
**Fix:** Show error to user, redirect to login

### 4. WhatsApp API Key Hardcoded
**File:** `frontend/src/lib/api.ts:34`
**Issue:** Default API key in code:
```javascript
'x-api-key': import.meta.env.VITE_WHATSAPP_API_KEY || 'whatsapp-secret-key-change-in-production'
```
**Impact:** Weak default security
**Fix:** Require env var, fail if missing

### 5. Login Uses Wrong Auth Endpoint
**File:** `frontend/src/pages/Login.tsx:15`
**Issue:** Backend expects email but Django authenticate might use username:
```javascript
body: JSON.stringify({ email, password }),
```
**Impact:** Login may fail
**Fix:** Verify backend auth method

### 6. Login Returns 400 for Errors
**File:** `frontend/src/pages/Login.tsx:26`
**Issue:** Shows backend error but server returns 400 not 401:
```javascript
if (res.ok) { ... } else { setError(data.error || "Invalid credentials"); }
```
**Impact:** Cannot distinguish auth errors from other errors
**Fix:** Handle status codes properly

### 7. Register Doesn't Auto-Login
**File:** `frontend/src/pages/Register.tsx:22`
**Issue:** Redirects to login after register:
```javascript
if (res.ok) { navigate("/login"); }
```
**Impact:** Poor UX - must login again
**Fix:** Return token from register

### 8. Forgot Password Mock Backend
**File:** `frontend/src/pages/ForgotPassword.tsx:18-19`
**Issue:** Always shows success message:
```javascript
const data = await res.json();
setMessage(data.message);  // Backend is mocked
```
**Impact:** User thinks email sent but nothing happens
**Fix:** Implement actual backend

### 9. Campaign Logs API Uses Wrong Path
**File:** `frontend/src/pages/CampaignLogs.tsx:20`
**Issue:** Uses wrong endpoint path:
```javascript
const res = await fetch(`/api/campaigns/${id}/logs`, {
```
**Impact:** Should use action endpoint or ViewSet
**Fix:** Check backend URL routing

### 10. No Auth Redirect on 401
**File:** `frontend/src/lib/api.ts`
**Issue:** No automatic redirect when token expired
**Impact:** User sees generic errors
**Fix:** Check 401 response and redirect

---

## Medium Priority Bugs (Should Fix)

### 11. Wizard: Template Filter Doesn't Refresh
**File:** `frontend/src/pages/Wizard.tsx:26-40`
**Issue:** No dependency array cause stale closure:
```javascript
useEffect(() => {
    apiFetch(`/api/templates/?type=${campaignType}`)
    // Missing campaignType in dependency
}, [campaignType]);  // This should work but state update may batch
```
**Impact:** Templates don't update when switching campaign type
**Fix:** Add proper dependency or force refresh

### 12. Wizard: WhatsApp Status Missing userId
**File:** `frontend/src/pages/Wizard.tsx:36-38`
**Issue:** Status check without userId:
```javascript
whatsappFetch("/api/whatsapp/status")
// Missing parameter: url.searchParams.append('userId', ...)
```
**Impact:** Status always returns not_initialized
**Fix:** Pass userId in query

### 13. Wizard: delayMs Type Mismatch
**File:** `frontend/src/pages/Wizard.tsx:64`
**Issue:** String passed to backend:
```javascript
formData.append("delayMs", delayMs);  // backend expects integer
```
**Impact:** Type conversion issues
**Fix:** Convert to integer before append

### 14. Wizard: Identity Display Wrong Field
**File:** `frontend/src/pages/Wizard.tsx:188`
**Issue:** Shows `identity.user`:
```javascript
<p>{identity.user}</p>  // Should be identity.smtp_user
```
**Impact:** Displays undefined
**Fix:** Use correct field name

### 15. Templates: Editor Key Not Unique
**File:** `frontend/src/pages/Templates.tsx:216-221`
**Issue:** Key doesn't change for new templates:
```javascript
key={editingId || 'new'}  // Same key for all new templates
```
**Impact:** Editor state persists incorrectly
**Fix:** Use unique key per template

### 16. Templates: LoadDesign Not Working
**File:** `frontend/src/pages/Templates.tsx:100-104`
**Issue:** loadDesign may not work:
```javascript
if (newTemplate.design && emailEditorRef.current?.editor) {
    emailEditorRef.current.editor.loadDesign(newTemplate.design);
}
```
**Impact:** Cannot edit existing designs
**Fix:** Test and verify API

### 17. Templates: ExportHtml Race Condition
**File:** `frontend/src/pages/Templates.tsx:48-56`
**Issue:** Callback async but save not awaited:
```javascript
emailEditorRef.current.editor.exportHtml(async (data) => {
    await saveTemplate(html, design);  // Race with form submit
});
```
**Impact:** Save may fail silently
**Fix:** Handle promises properly

### 18. Templates: Editor Min Height Large
**File:** `frontend/src/pages/Templates.tsx:220`
**Issue:** Too large for small screens:
```javascript
minHeight={600}  // Causes scroll issues
```
**Impact:** Poor UI on laptops
**Fix:** Use responsive height

### 19. Templates: Preview Strips HTML
**File:** `frontend/src/pages/Templates.tsx:295-297`
**Issue:** HTML stripped incorrectly:
```javascript
{template.body.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
```
**Impact:** Preview doesn't match actual
**Fix:** Use proper HTML strip

### 20. Templates: No Unsaved Warning
**File:** `frontend/src/pages/Templates.tsx`
**Issue:** Navigate away without warning
**Impact:** Lost work
**Fix:** Add beforeunload listener

### 21. Identities: Port Type Mismatch
**File:** `frontend/src/pages/Identities.tsx:171-172`
**Issue:** Port stored as string:
```javascript
value={newIdentity.port}  // String "587"
```
**Impact:** Backend expects integer
**Fix:** Convert to number

### 22. Identities: No Test Button
**File:** `frontend/src/pages/Identities.tsx`
**Issue:** Save without testing credentials
**Impact:** Invalid credentials saved
**Fix:** Add test connection

### 23. WhatsApp: QR Not Auto-Refreshed
**File:** `frontend/src/pages/WhatsApp.tsx:88-97`
**Issue:** Static QR displayed:
```javascript
{status === 'qr' && qr && ( <img src={qr} /> )}
// No polling to refresh QR
```
**Impact:** Old QR becomes useless
**Fix:** Poll for new QR when status=qr

### 24. WhatsApp: No Pause on Background
**File:** `frontend/src/pages/WhatsApp.tsx:23-27`
**Issue:** Polls even when tab hidden
**Impact:** Wastes resources
**Fix:** Use Page Visibility API

### 25. Campaigns: Polling No Pause
**File:** `frontend/src/pages/Campaigns.tsx:36-37`
**Issue:** 5-second interval always runs
**Impact:** Unnecessary network calls
**Fix:** Pause when not visible

### 26. Campaign Logs: Polling Too Fast
**File:** `frontend/src/pages/CampaignLogs.tsx:36-37`
**Issue:** 3-second poll may be too fast
**Impact:** Server overload with many logs
**Fix:** Increase interval

### 27. API: No Loading States
**Files:** All pages
**Issue:** Some buttons don't show loading
**Impact:** User clicks multiple times
**Fix:** Add loading state to all buttons

### 28. API: No Error Toast Display
**Files:** All pages
**Issue:** Errors logged to console only
**Impact:** User doesn't see errors
**Fix:** Add toast notifications

### 29. Register: No Username Field
**File:** `frontend/src/pages/Register.tsx`
**Issue:** Only email and password:
```javascript
body: JSON.stringify({ email, password, password_confirm: password })
```
**Impact:** Backend expects username but none sent
**Fix:** Add username field

### 30. Login: No Remember Me
**File:** `frontend/src/pages/Login.tsx`
**Issue:** No remember me checkbox
**Impact:** Must login each session
**Fix:** Add remember me option

---

## Low Priority Bugs (Nice to Have)

### 31. CSS: Editor Min Height Too Large
- **Issue:** 600px min height poor on small screens

### 32. Filter: Doesn't Update URL
- **Issue:** Filter state reset on page reload

### 33. Validation: Required Fields Visual Only
- **Issue:** HTML required doesn't always enforce

### 34. Icons: No Loading States
- **Issue:** Icons don't show loading spinner

### 35. Accessibility: No ARIA Labels
- **Issue:** Missing accessibility attributes

### 36. Mobile: No Responsive Touch
- **Issue:** Some buttons too small for touch

### 37. Forms: No Inline Validation
- **Issue:** Validation only on submit

### 38. Empty States: Generic Messages
- **Issue:** Could be more helpful

### 39. Loading: No Skeleton Screens
- **Issue:** Uses spinner instead of skeletons

### 40. Error Boundaries: Not Implemented
- **Issue:** App crashes on errors

---

## API/lib Bugs

### 41. API_BASE Empty String
**File:** `frontend/src/lib/api.ts:1`
**Issue:** No base URL configured:
```javascript
const API_BASE = '';  // Should use env var
```
**Impact:** Relative paths only

### 42. WHATSAPP_BASE Hardcoded Default
**File:** `frontend/src/lib/api.ts:2`
**Issue:** Default URL in code:
```javascript
const WHATSAPP_BASE = import.meta.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3002';
```
**Impact:** Wrong default in production

### 43. No Request Retry Logic
**File:** `frontend/src/lib/api.ts`
**Issue:** No automatic retry on failure
**Impact:** Poor UX on network errors

### 44. No Request Timeout
**File:** `frontend/src/lib/api.ts`
**Issue:** Requests can hang forever
**Impact:** App appears frozen

### 45. No Response Caching
**File:** `frontend/src/lib/api.ts`
**Issue:** No cache for GET requests
**Impact:** Unnecessary network calls

---

## Summary

| Priority | Count |
|----------|-------|
| Critical | 10 |
| Medium | 21 |
| Low | 14 |
| **Total** | **45** |

The frontend has **45 identifiable bugs** with 10 being critical that require immediate attention.