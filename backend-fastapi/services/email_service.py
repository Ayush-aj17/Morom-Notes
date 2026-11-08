
import logging
import os
from typing import Optional
from html import escape

import resend

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for OTP verification using Resend API."""

    def __init__(
        self,
        smtp_server: str = "smtp.gmail.com",
        smtp_port: int = 587,
        sender_email: Optional[str] = None,
        sender_password: Optional[str] = None,
    ):
        # Keep old constructor arguments to avoid breaking existing code.
        # Gmail SMTP is no longer used.

        api_key = os.getenv("RESEND_API_KEY")

        if api_key:
            resend.api_key = api_key

        self.sender_email = sender_email or os.getenv("EMAIL_FROM") or "onboarding@resend.dev"

    def send_otp_email(
        self,
        recipient_email: str,
        otp: str,
        validity_minutes: int = 5,
    ) -> bool:

        if not os.getenv("RESEND_API_KEY"):
            logger.error("RESEND_API_KEY is not configured.")
            return False

        try:
            text = f"""
Your One-Time Password (OTP) for Morom Notes:

{otp}

This OTP will expire in {validity_minutes} minutes.

If you didn't request this, please ignore this email.
Do not share your OTP with anyone.
"""

            html = f"""
            <html>
              <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px;">
                  <h2 style="color: #2563eb;">
                    Morom Notes - Email Verification
                  </h2>

                  <p>Your One-Time Password (OTP) is:</p>

                  <div style="
                    background: #f3f4f6;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                  ">
                    <p style="
                      font-size: 32px;
                      font-weight: bold;
                      letter-spacing: 4px;
                      color: #2563eb;
                    ">
                      {escape(otp)}
                    </p>
                  </div>

                  <p>
                    This OTP expires in
                    <strong>{validity_minutes} minutes</strong>.
                  </p>

                  <p style="font-size: 12px; color: #999;">
                    Do not share this code with anyone.
                  </p>
                </div>
              </body>
            </html>
            """

            result = resend.Emails.send({
                "from": self.sender_email,
                "to": [recipient_email],
                "subject": "Your Morom Notes Verification Code",
                "text": text,
                "html": html,
            })

            email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
            logger.info("OTP email accepted by Resend. Email ID: %s", email_id)

            return True

        except Exception:
            logger.exception(
                "Failed to send OTP email to %s",
                recipient_email
            )
            return False

    def send_welcome_email(
        self,
        recipient_email: str,
        username: str,
    ) -> bool:

        if not os.getenv("RESEND_API_KEY"):
            logger.error("RESEND_API_KEY is not configured.")
            return False

        try:
            safe_username = escape(username)

            text = f"""
Welcome to Morom Notes, {username}!

Your account has been successfully created.
You can now log in and start taking notes.

Happy note-taking!
"""

            html = f"""
            <html>
              <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: auto; padding: 20px;">
                  <h2 style="color: #2563eb;">
                    Welcome to Morom Notes!
                  </h2>

                  <p>Hello <strong>{safe_username}</strong>,</p>

                  <p>
                    Your account has been successfully created.
                    You can now log in and start taking notes.
                  </p>

                  <p>Happy note-taking!</p>
                </div>
              </body>
            </html>
            """

            result = resend.Emails.send({
                "from": self.sender_email,
                "to": [recipient_email],
                "subject": "Welcome to Morom Notes!",
                "text": text,
                "html": html,
            })

            email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
            logger.info("Welcome email accepted by Resend. Email ID: %s", email_id)

            return True

        except Exception:
            logger.exception(
                "Failed to send welcome email to %s",
                recipient_email
            )
            return False
