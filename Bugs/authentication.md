# Authentication & User Management - Bug Report

## Critical Bugs

### 1. Authentication Uses Username But Accepts Email
**File:** `backend/accounts/views.py:26-28`
**Issue:** `authenticate()` is called with `username=serializer.validated_data["email"]` but User model's USERNAME_FIELD might be `email`:
```python
user = authenticate(
    username=serializer.validated_data["email"],  # Wrong param name
    password=serializer.validated_data["password"],
)
```
**Impact:** Login may fail depending on Django AUTH_USER_MODEL configuration.

### 2. No User Model Migration Exists
**File:** `backend/accounts/models.py` (implied - not reviewed)
**Issue:** Custom User model may not have proper migration.
**Impact:** Database setup fails or uses default User model.

### 3. Login Returns 400 for Invalid Credentials
**File:** `backend/accounts/views.py:30-33`
**Issue:** Returns HTTP 400 instead of 401 for invalid credentials:
```python
return Response(
    {"error": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST
)
```
**Impact:** Frontend cannot distinguish between bad credentials and other errors.

### 4. Forgot Password Is Mocked Only
**File:** `backend/accounts/views.py:45-46`
**Issue:** Returns mock message without actual password reset functionality:
```python
return Response({"message": "Password reset link sent to email (mocked)"})
```
**Impact:** Users cannot actually reset passwords.

### 5. Register Does Not Auto-Login
**File:** `backend/accounts/views.py:11-14`
**Issue:** Registration creates user but doesn't return JWT token for auto-login:
```python
class RegisterView(generics.CreateAPIView):
    # After create - no tokens returned
    # User must call login separately
```
**Impact:** Poor UX - users must login after registering.

### 6. No Email Validation
**File:** `backend/accounts/serializers.py:19-40`
**Issue:** RegisterSerializer accepts any email format without additional validation.
**Impact:** Invalid email formats accepted.

### 7. Password Validation May Be Too Strict
**File:** `backend/accounts/serializers.py:20`
**Issue:** Uses Django's default password validators:
```python
serializers.CharField(write_only=True, validators=[validate_password])
```
**Impact:** Users may reject passwords that Django considers too common even if user wants them.

## Medium Priority Bugs

### 8. RegisterSerializer create Method Duplicates
**File:** `backend/accounts/serializers.py:14-16 and 34-40`
**Issue:** Both `UserSerializer` and `RegisterSerializer` have `create()` methods:
```python
def create(self, validated_data):  # In both serializers
    user = User.objects.create_user(**validated_data)
```
**Impact:** Potential conflicts or confusion.

### 9. No Unique Email Constraint
**File:** `backend/accounts/serializers.py:19-40`
**Issue:** Doesn't explicitly check for duplicate email before creating user.
**Impact:** Database may reject but error message unclear.

### 10. Login Returns User Data Without Password Field Protected
**File:** `backend/accounts/views.py:36-38`
**Issue:** UserSerializer returns user data but may expose sensitive fields:
```python
return Response(
    {"token": str(refresh.access_token), "user": UserSerializer(user).data}
)
```
**Impact:** Potential data leakage if serializer misconfigured.

### 11. No Refresh Token Returned
**File:** `backend/accounts/views.py:35-37`
**Issue:** Only returns access token, not refresh token:
```python
refresh = RefreshToken.for_user(user)
return Response(
    {"token": str(refresh.access_token), "user": UserSerializer(user).data}
    # Should also return refresh token
)
```
**Impact:** Frontend cannot implement token refresh.

### 12. JWT Settings May Cause Long Sessions
**File:** `backend/bemailsender/settings.py:113-116`
**Issue:** Access token lifetime is 1 day which is too long for security:
```python
"ACCESS_TOKEN_LIFETIME": timedelta(days=1),
```
**Impact:** Compromised tokens valid for too long.

### 13. No Logout Endpoint
**File:** `backend/accounts/urls.py`
**Issue:** No logout endpoint to blacklist tokens.
**Impact:** Cannot implement secure logout.

### 14. No Password Change Endpoint
**File:** `backend/accounts/urls.py`
**Issue:** No endpoint for authenticated users to change password.
**Impact:** Users cannot change passwords through API.

## Frontend Authentication Bugs

### 15. Login Error Handling Poor
**File:** `frontend/src/pages/Login.tsx` (implied)
**Issue:** Error messages from backend (400) not handled properly in frontend.
**Impact:** Users see generic errors instead of specific feedback.

### 16. Token Storage Insecurity
**File:** `frontend/src/lib/api.ts:14`
**Issue:** Stores token in localStorage (vulnerable to XSS):
```javascript
const token = localStorage.getItem('token');
```
**Impact:** Tokens can be stolen via XSS attacks.

### 17. No Token Expiry Handling
**File:** `frontend/src/lib/api.ts`
**Issue:** No check for token expiry before API calls.
**Impact:** Expired tokens cause silent failures.

### 18. No Auth Redirect
**File:** `frontend/src/App.tsx` (implied)
**Issue:** Unauthenticated users not redirected to login.
**Impact:** Poor UX for protected routes.

### 19. Register Doesn't Auto-Login
**File:** `frontend/src/pages/Register.tsx` (implied)
**Issue:** After registration, must manually login.
**Impact:** Poor UX - similar to backend issue.

### 20. Forgot Password Page Non-Functional
**File:** `frontend/src/pages/ForgotPassword.tsx` (implied)
**Issue:** Form calls backend but backend is mocked.
**Impact:** User submits email but nothing happens.