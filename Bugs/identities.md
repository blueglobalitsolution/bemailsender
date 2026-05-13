# Identities (SMTP) Feature - Bug Report

## Critical Bugs

### 1. Identity Password Not Encrypted
**File:** `backend/campaigns/models.py:37`
**Issue:** SMTP password stored in plain text:
```python
smtp_pass = models.CharField(max_length=255)  # Plain text
```
**Impact:** Security vulnerability if database compromised.

### 2. Identity Test Not Implemented
**File:** `backend/campaigns/views.py` and `frontend/src/pages/Identities.tsx`
**Issue:** No way to test identity before saving:
```javascript
// No test connection button
```
**Impact:** User saves invalid credentials and campaign fails.

### 3. Identity port Stored as Integer But Input String
**File:** `backend/campaigns/models.py:35`
**Issue:** Port is IntegerField but frontend sends as string:
```python
port = models.IntegerField(default=587)
# Frontend: value={newIdentity.port} as string
```
**Impact:** Potential type conversion issues.

### 4. SSL/TLS Logic Inverted
**File:** `backend/campaigns/management/commands/processcampaigns.py:140-141`
**Issue:** SSL/TLS logic appears inverted:
```python
use_tls=not identity.secure,   # If secure=True, use TLS=False
use_ssl=identity.secure,       # If secure=True, use SSL=True
```
**Impact:** Wrong protocol used for port 465/587.

### 5. Identity Deletion Doesn't Check Campaigns
**File:** `backend/campaigns/views.py:41-52`
**Issue:** Can delete identity even if used by campaigns:
```python
def perform_update(self, serializer):
    serializer.save(user=self.request.user)
# No check if identity used
```
**Impact:** Campaign fails when identity deleted.

### 6. From Email Not Customizable
**File:** `backend/campaigns/management/commands/processcampaigns.py:144-150`
**Issue:** Always uses smtp_user as from email:
```python
from_email=identity.smtp_user  # Can't customize "From" name
```
**Impact:** Can't set friendly sender name.

## Medium Priority Bugs

### 7. Identity Host Validation Missing
**File:** `backend/campaigns/views.py:41-52`
**Issue:** No validation of SMTP host format.
**Impact:** Invalid hosts accepted.

### 8. Identity smtp_user Not Validated as Email
**File:** `backend/campaigns/serializers.py:27-42`
**Issue:** `smtp_user` field not validated as email:
```python
smtp_user = serializers.CharField(max_length=255)  # Not EmailField
```
**Impact:** Invalid email formats accepted.

### 9. Duplicate Identity Names Allowed
**File:** `backend/campaigns/models.py:33`
**Issue:** No unique constraint on name per user.
**Impact:** User confusion.

### 10. Gmail Provider Assumes Always TLS
**File:** `frontend/src/pages/Identities.tsx:50-55`
**Issue:** Hardcoded Gmail settings may not always work:
```javascript
setNewIdentity({
    host: "smtp.gmail.com",
    port: "587",
    secure: false, // Gmail uses TLS on 587
});
```
**Impact:** Doesn't handle Gmail's App Password requirement.

### 11. Port 465 SSL Not Handled Correctly
**File:** `frontend/src/pages/Identities.tsx:214-223`
**Issue:** SSL checkbox for custom only but port selection independent:
```javascript
checked={newIdentity.secure}  // Doesn't auto-set port
```
**Impact:** Mismatched port/SSL.

### 12. No OAuth2 Support
**File:** `backend/campaigns/models.py` and send logic
**Issue:** Only supports password authentication:
```python
username=identity.smtp_user,
password=identity.smtp_pass,
```
**Impact:** Gmail OAuth deprecation not handled.

### 13. Identity Serializer Missing Port Validation
**File:** `backend/campaigns/serializers.py:27-42`
**Issue:** No range validation on port.
**Impact:** Invalid ports accepted (0, 99999).

### 14. From Header Not Customizable
**File:** `backend/campaigns/management/commands/processcampaigns.py:144-150`
**Issue:** Can't set "Sender Name" separately.
**Impact:** Recipient sees raw email only.

### 15. Custom SMTP Fields Too Permissive
**File:** `frontend/src/pages/Identities.tsx:154-178`
**Issue:** All fields editable without validation.
**Impact:** Easy to misconfigure.

### 16. Identity Update Doesn't Require All Fields
**File:** `frontend/src/pages/Identities.tsx:66-82`
**Issue:** Partial update may not work:
```javascript
body: JSON.stringify(newIdentity)
```
**Impact:** Updates may fail.

### 17. No Per-Campaign Identity Override
**File:** `backend/campaigns/models.py:64-66` and `views.py`
**Issue:** Identity linked to campaign but can't override per-email.
**Impact:** Can't send from multiple identities in one campaign.

### 18. Identity List Not Filtered by User in Admin
**File:** `backend/campaigns/models.py:30-31`
**Issue:** Foreign key may not properly filter:
```python
user = models.ForeignKey(
    settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="identities"
)
# Should filter in views
```
**Impact:** Might show other users' identities.