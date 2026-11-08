# OTP Email Setup with Resend

The backend sends signup, password-reset, and verification OTPs through the
Resend API.

## Configure the backend

Create `backend-fastapi/.env` locally, or add these variables to the hosting
provider:

```env
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=onboarding@resend.dev
```

For production, verify a domain in Resend and use a sender address on that
domain:

```env
EMAIL_FROM=Morom Notes <no-reply@your-verified-domain.com>
```

`onboarding@resend.dev` is suitable for testing and is subject to Resend's
recipient restrictions. Never commit `RESEND_API_KEY` or `.env`.

## Verify delivery

1. Restart or redeploy the backend after changing environment variables.
2. Submit the signup form.
3. Check backend logs for `Signup OTP accepted by Resend`.
4. If delivery fails, check logs for the Resend API error and inspect Resend's
   email logs and the recipient's spam/promotions folders.

The API only returns the OTP-success response after Resend accepts the request.
If the key is missing or Resend rejects the sender/recipient, signup returns
HTTP 503 and does not leave an unusable unverified account behind.
