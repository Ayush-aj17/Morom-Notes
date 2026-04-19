# OTP Email Setup Guide

## Problem Solved
Your OTP system was generating OTPs but **not sending them** to users. This guide implements email delivery for OTPs.

## Setup Instructions

### 1. **Gmail Setup (Recommended)**

#### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Sign in if needed
3. Enable "2-Step Verification"

#### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Windows Computer" (or your device)
3. Google will generate a **16-character password**
4. Copy this password

#### Step 3: Configure `.env` file
Create or edit `.env` in `backend-fastapi/` directory:

```env
EMAIL_SENDER=your-gmail@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

**Example:**
```env
EMAIL_SENDER=john.doe@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
```

### 2. **Other Email Providers**

If using a different provider, update the SMTP settings:

#### Outlook/Hotmail
```env
EMAIL_SENDER=your-email@outlook.com
EMAIL_PASSWORD=your-password
SMTP_SERVER=smtp-mail.outlook.com
SMTP_PORT=587
```

#### Yahoo
```env
EMAIL_SENDER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password  # Yahoo also requires App Password
SMTP_SERVER=smtp.mail.yahoo.com
SMTP_PORT=587
```

---

## Testing OTP Delivery

### Test Request
```bash
curl -X POST http://localhost:8000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "password123"
  }'
```

### Expected Response
```json
{
  "message": "OTP sent to your registered email",
  "identifier": "testuser"
}
```

Users will receive an email with their OTP code.

---

## How It Works

1. User requests OTP with credentials → `POST /auth/request-otp`
2. Server generates a 6-digit OTP (valid for 5 minutes)
3. **OTP is emailed** to registered email address
4. User enters OTP on frontend → `POST /auth/verify-otp`
5. Server verifies OTP and issues JWT token

---

## Frontend Changes Required

The Login component needs updating to hide the OTP in responses. Update [Login.jsx](../frontend/src/pages/Login.jsx):

Make sure the frontend **does NOT display** the OTP in the response (it's only for development/testing).

---

## Troubleshooting

### "SMTP authentication failed"
- ✗ Wrong email/password combination
- ✓ Make sure you're using the **App Password**, not your Gmail password
- ✓ Check that 2FA is enabled on the Gmail account

### Emails not sending
- Check that `EMAIL_SENDER` and `EMAIL_PASSWORD` are set in `.env`
- Verify SMTP settings are correct for your provider
- Check backend logs for errors: `docker logs backend` (or your log viewer)

### SSL/TLS Errors
- Make sure `SMTP_PORT=587` (not 465)
- The code uses `starttls()` which is correct for port 587

---

## Files Modified
- ✅ Created: `services/email_service.py` - Email sending logic
- ✅ Updated: `routes/auth.py` - Uses email service in OTP endpoints
- ✅ Updated: `core/config.py` - Email configuration settings
- ✅ Updated: `.env.example` - Template with email variables

## Security Notes
- ⚠️ Never commit `.env` to git (add to `.gitignore`)
- ⚠️ Use App Passwords, not your actual Gmail/account password
- ⚠️ In production, rotate app passwords regularly
- ⚠️ OTPs are valid for 5 minutes only
