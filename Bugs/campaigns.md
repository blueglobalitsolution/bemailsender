# Campaigns Feature - Bug Report

## Critical Bugs

### 1. useGemini Flag Always False (RESOLVED)
**File:** `backend/campaigns/views.py:107`
**Issue:** The `use_gemini` parameter is passed from frontend but is hardcoded to `False` when creating campaign.
**Status:** Fixed by using the `use_gemini` variable from request data.
**Impact:** Gemini AI generation can now be enabled for campaigns.

### 2. schedule_days JSON String Not Parsed (RESOLVED)
**File:** `backend/campaigns/views.py:109`
**Issue:** `schedule_days` was stored as JSON string directly without parsing.
**Status:** Fixed by adding `json.loads(schedule_days)` with safety checks.
**Impact:** Schedule days are now correctly stored as JSON arrays, allowing validation and processing.

### 3. Identity Not Required Validation Missing (RESOLVED)
**File:** `backend/campaigns/views.py:100-112`
**Issue:** No validation that `identity_id` is provided for email campaigns.
**Status:** Added validation to check for identity when campaign type is 'email'.
**Impact:** Users are prevented from creating broken email campaigns.

### 4. Template Not Required Validation Missing (RESOLVED)
**File:** `backend/campaigns/views.py:100-112`
**Issue:** No validation that `template_id` exists or is provided.
**Status:** Added validation to ensure template is provided.
**Impact:** Prevents processor crashes due to missing templates.

### 5. Missing Campaign Start Time Parse (RESOLVED)
**File:** `backend/campaigns/views.py:110`
**Issue:** `schedule_start_time` and `schedule_end_time` were stored as strings.
**Status:** Fixed by parsing time strings using `strptime` before saving to `TimeField`.
**Impact:** Schedule comparison now works correctly in background processor.

### 6. Campaign Contact email vs phone Field Naming (RESOLVED)
**File:** `backend/campaigns/views.py:119-125`
**Issue:** Using `email` for both email and phone caused confusion.
**Status:** Renamed `email` field to `recipient` in the `CampaignContact` model and updated all backend references.
**Impact:** Correct and clear field naming for both Email and WhatsApp campaigns.

### 7. No Campaign Running State Check (RESOLVED)
**File:** `backend/campaigns/management/commands/process_campaigns.py:29`
**Issue:** Campaigns were not consistently suspended when outside the schedule window if the processor restarted.
**Status:** Fixed by checking the window for all 'running' campaigns and suspending them if they are outside the allowed time/day.
**Impact:** Campaigns now respect scheduling windows accurately across processor restarts.

### 8. WhatsApp userId Not Passed From Frontend
**File:** `backend/campaigns/management/commands/process_campaigns.py:176`
**Issue:** WhatsApp send uses `campaign.user.id` as userId but WhatsApp service tracks by different user mapping.
**Impact:** WhatsApp messages fail because wrong userId sent to service.

## Medium Priority Bugs

### 9. CSV Encoding Not Handled (RESOLVED)
**File:** `backend/campaigns/views.py:114`
**Issue:** Only UTF-8 encoding was assumed.
**Status:** Added fallback to `latin-1` if `utf-8` decoding fails.
**Impact:** CSV files from Excel and other sources now parse correctly.

### 10. Bulk Create Without Batch Size Limit (RESOLVED)
**File:** `backend/campaigns/views.py:133`
**Issue:** `bulk_create` could cause memory issues with very large CSV files.
**Status:** Added `batch_size=500` to `bulk_create` to chunk the database insertions.
**Impact:** System can now handle large contact lists without OOM errors.

### 11. Process Delay Applied After Each Contact Only (RESOLVED)
**File:** `backend/campaigns/management/commands/process_campaigns.py:126-127`
**Issue:** The 10-second main loop sleep made all campaigns extremely slow regardless of the contact delay setting.
**Status:** Refactored the processor to use a faster main loop (1s when busy) and process up to 10 contacts per campaign per cycle.
**Impact:** Significantly improved campaign throughput while still respecting inter-message delays.

### 12. No Retry Logic for Failed Contacts (RESOLVED)
**File:** `backend/campaigns/management/commands/process_campaigns.py:117-123`
**Issue:** Failed contacts were marked failed with no retry mechanism.
**Status:** Added `updated_at` to `CampaignContact` and modified processor to retry contacts that failed more than 1 hour ago.
**Impact:** Temporary failures (network, SMTP) are now automatically retried, increasing campaign reliability.

### 13. Missing Updated_at in Campaign Updates (RESOLVED)
**File:** `backend/campaigns/serializers.py:78-85`
**Issue:** `updated_at` was missing from `read_only_fields`.
**Status:** Added `updated_at` to `read_only_fields` in `CampaignSerializer`.
**Impact:** Consistent timestamp handling in API responses.

## Frontend Connectivity Bugs

### 14. Wizard: Template Filter Doesn't Refresh (RESOLVED)
**File:** `frontend/src/pages/Wizard.tsx:26-40`
**Issue:** Suspected missing dependency in `useEffect`.
**Status:** Verified that `[campaignType]` is present in the dependency array, ensuring templates refresh when the campaign type changes.
**Impact:** Templates now correctly update when switching between email and WhatsApp.

### 15. Wizard: WhatsApp Status Uses Wrong Endpoint
**File:** `frontend/src/pages/Wizard.tsx:36-38`
**Issue:** Calls `/status` without userId parameter:
```javascript
whatsappFetch("/api/whatsapp/status")  # Missing userId
```
**Impact:** WhatsApp status check fails for users.

### 16. Wizard: delayMs Not Passed To API
**File:** `frontend/src/pages/Wizard.tsx:64`
**Issue:** Parameter name mismatch - backend expects `delayMs`:
```javascript
formData.append("delayMs", delayMs);  # But Django expects integer
```
**Impact:** Delay setting may be ignored or cause type error.

### 17. Campaign Logs: Wrong API Path (RESOLVED)
**File:** `frontend/src/pages/CampaignLogs.tsx`
**Issue:** Logs fetching used native `fetch` with wrong host, missing trailing slash, and incorrect localStorage key (`token`).
**Status:** Fixed by using `apiFetch` which handles base URL, trailing slash, and correct `access_token` key.
**Impact:** Campaign logs now successfully load and refresh.

### 18. Identity Display Shows Wrong Field (RESOLVED)
**File:** `frontend/src/pages/Wizard.tsx:188`
**Issue:** Shows `identity.user` but field is actually `smtp_user`.
**Status:** Fixed by changing display field to `identity.smtp_user`.
**Impact:** Identity details now correctly display the SMTP username.

## Database/Connectivity Issues

### 19. Django WHATSAPP_API_KEY Not Passed To Docker (RESOLVED)
**File:** `docker-compose.yml:31`
**Issue:** Environment variable key mismatch was suspected.
**Status:** Verified that `docker-compose.yml` and `settings.py` both use `WHATSAPP_API_KEY` consistently.
**Impact:** WhatsApp service can authenticate with Django backend.

### 20. WhatsApp Service URL Misconfiguration (RESOLVED)
**File:** `docker-compose.yml:30,45`
**Issue:** Suspected container name or URL mismatch.
**Status:** Verified that `WHATSAPP_SERVICE_URL` matches the service name in `docker-compose.yml`.
**Impact:** Backend successfully communicates with WhatsApp service.

### 21. WhatsApp Container Port Mismatch (RESOLVED)
**File:** `docker-compose.yml:48`
**Issue:** Suspected port mapping mismatch.
**Status:** Verified that `PORT=3001` is passed to the container and matches the `3001:3001` mapping.
**Impact:** Service starts and is accessible on the expected port.