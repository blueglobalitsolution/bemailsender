# Templates Feature - Bug Report

## Critical Bugs

### 1. Template subject Can Be Null for Email (RESOLVED)
**File:** `backend/campaigns/serializers.py:25-30`
**Issue:** Subject was nullable in model and not enforced in API.
**Status:** Added validation in `TemplateSerializer` to require `subject` if `type == 'email'`.
**Impact:** Prevents invalid email templates from breaking campaigns.

### 2. Design Field Not Validated (RESOLVED)
**File:** `backend/campaigns/serializers.py:18-24`
**Issue:** Design is JSONField with no validation.
**Status:** Implemented `validate_design` in serializer to enforce correct structure (body/pages) for email designs.
**Impact:** Prevents corrupt designs from crashing the frontend editor.

### 3. Template Type Changes After Creation (RESOLVED)
**File:** `backend/campaigns/serializers.py:31-33`
**Issue:** Can update template type after creation.
**Status:** Added validation to prohibit changing `type` after a template is created.
**Impact:** Preserves data integrity between email and WhatsApp formats.

### 4. Template List Endpoint Missing Pagination
**File:** `backend/campaigns/views.py:23-32`
**Issue:** No pagination for templates list:
```python
def get_queryset(self):
    queryset = Template.objects.filter(user=self.request.user)
    # Returns all templates - potential performance issue
```
**Impact:** Performance degrades with many templates.

### 5. Template Delete Cascades Incorrectly (RESOLVED)
**File:** `backend/campaigns/views.py:44-48`
**Issue:** Deleting template doesn't check for active campaigns.
**Status:** Overrode `perform_destroy` in `TemplateViewSet` to block deletion if linked to any campaigns.
**Impact:** Prevents campaign failures due to missing templates.

## Medium Priority Bugs

### 6. Template Serializer Missing Updated Field (RESOLVED)
**File:** `backend/campaigns/serializers.py:16`
**Issue:** `updated_at` not included in serialization.
**Status:** Added `updated_at` to `TemplateSerializer` fields.
**Impact:** Frontend can now display accurate "Last Updated" information.

### 7. Duplicate Template Names Allowed (RESOLVED)
**File:** `backend/campaigns/models.py:27`
**Issue:** No unique constraint on template name per user.
**Status:** Added `unique_together = ("user", "name")` to `Template` model metadata.
**Impact:** Improved user experience and data organization.

### 8. Template Body Not Sanitized
**File:** `backend/campaigns/models.py:16`
**Issue:** Body content not sanitized for XSS:
```python
body = models.TextField()  # Stores raw HTML
```
**Impact:** Stored XSS if using in HTML emails.

### 9. No Template Preview Endpoint
**File:** `backend/campaigns/urls.py`
**Issue:** No endpoint to preview rendered template with variables.
**Impact:** Cannot test template before campaign.

### 10. Template Filter Uses Query Params Incorrectly (RESOLVED)
**File:** `backend/campaigns/views.py:31`
**Issue:** Filter parameter name mismatch.
**Status:** Verified frontend and backend both use `?type=` correctly for filtering.
**Impact:** Template filtering works as expected.

## Frontend Template Bugs

### 11. Email Editor Key Not Unique
**File:** `frontend/src/pages/Templates.tsx:216-221`
**Issue:** Editor component key doesn't change when editing different templates:
```javascript
<EmailEditor
  key={editingId || 'new'}  // Same key for new and edit
  ref={emailEditorRef}
```
**Impact:** Editor state persists incorrectly between templates.

### 12. Editor Design Load Not Working
**File:** `frontend/src/pages/Templates.tsx:100-104`
**Issue:** `loadDesign` called but may not work properly:
```javascript
const onReady = () => {
  if (newTemplate.design && emailEditorRef.current?.editor) {
    emailEditorRef.current.editor.loadDesign(newTemplate.design);
  }
};
```
**Impact:** Cannot edit existing email designs.

### 13. Design Save Not Triggered for New Templates
**File:** `frontend/src/pages/Templates.tsx:48-56`
**Issue:** `exportHtml` callback may not resolve properly:
```javascript
if (newTemplate.type === 'email' && emailEditorRef.current?.editor) {
  emailEditorRef.current.editor.exportHtml(async (data) => {
    const { design, html } = data;
    await saveTemplate(html, design);
  });
}
```
**Impact:** Save may fail silently.

### 14. Template Filter Button Not Updating URL
**File:** `frontend/src/pages/Templates.tsx:130-148`
**Issue:** Filter selection doesn't update URL params:
```javascript
onClick={() => setFilterType('email')}  // Only local state
```
**Impact:** Filter reset on page reload.

### 15. Template Name Required Validation Missing in UI
**File:** `frontend/src/pages/Templates.tsx:190-196`
**Issue:** Required indicator shown but form may submit without name:
```javascript
<input ... required />  // But may not enforce
```
**Impact:** Empty templates can be created.

### 16. Editor Min Height Too Large
**File:** `frontend/src/pages/Templates.tsx:220`
**Issue:** Min height causes scroll issues:
```javascript
minHeight={600}
```
**Impact:** Poor UI layout on smaller screens.

### 17. WhatsApp Templates Not Properly Previewed
**File:** `frontend/src/pages/Templates.tsx:295-297`
**Issue:** HTML tags stripped incorrectly for preview:
```javascript
{template.body.replace(/<[^>]*>?/gm, '').substring(0, 150)}...
```
**Impact:** Preview doesn't match actual rendered content.

### 18. Template Type Switching Loses Content
**File:** `frontend/src/pages/Templates.tsx:172-186`
**Issue:** Switching from email to WhatsApp loses editor content:
```javascript
onClick={() => setNewTemplate({ ...newTemplate, type: 'whatsapp' })}
// Body and subject not cleared but email formatting lost
```
**Impact:** Confusing UI state.

### 19. Content-Type Header Conflict
**File:** `frontend/src/pages/Templates.tsx:69-75`
**Issue:** Sets JSON content type but FormData might be used:
```javascript
headers: {
  "Content-Type": "application/json",
}
```
**Impact:** Request fails if mixed with FormData.

### 20. No Unsaved Changes Warning
**File:** `frontend/src/pages/Templates.tsx`
**Issue:** Navigating away doesn't warn about unsaved changes.
**Impact:** Lost work if user forgets to save.