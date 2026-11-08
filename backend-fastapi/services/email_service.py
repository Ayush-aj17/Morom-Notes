import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class EmailService:
    """Service to send emails for OTP verification"""
    
    def __init__(
        self,
        smtp_server: str = "smtp.gmail.com",
        smtp_port: int = 587,
        sender_email: Optional[str] = None,
        sender_password: Optional[str] = None,
    ):
        """
        Initialize email service with SMTP credentials.
        
        For Gmail:
        - Generate an App Password: https://myaccount.google.com/apppasswords
        - Use your email as sender_email
        - Use the generated app password as sender_password
        """
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.sender_email = sender_email
        self.sender_password = sender_password
    
    def send_otp_email(
        self,
        recipient_email: str,
        otp: str,
        validity_minutes: int = 5,
    ) -> bool:
        """
        Send OTP to user's email.
        
        Args:
            recipient_email: Email address to send OTP to
            otp: The OTP code
            validity_minutes: How long the OTP is valid for
            
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.sender_email or not self.sender_password:
            logger.warning("Email service not configured. Skipping OTP email.")
            return False
        
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = "Your Login OTP - Project Notes"
            message["From"] = self.sender_email
            message["To"] = recipient_email
            
            # Plain text version
            text = f"""
Your One-Time Password (OTP) for Morom Notes Login:

{otp}

This OTP will expire in {validity_minutes} minutes.
If you didn't request this, please ignore this email.

Do not share your OTP with anyone.
            """
            
            # HTML version
            html = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #2563eb;">Morom Notes - Login Verification</h2>
                  <p>Your One-Time Password (OTP) for login is:</p>
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <p style="font-size: 32px; font-weight: bold; letter-spacing: 2px; margin: 0; color: #2563eb;">{otp}</p>
                  </div>
                  <p style="color: #666;">This OTP will expire in <strong>{validity_minutes} minutes</strong>.</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                  <p style="font-size: 12px; color: #999;">
                    If you didn't request this login code, please ignore this email.<br>
                    Do not share your OTP with anyone.
                  </p>
                </div>
              </body>
            </html>
            """
            
            part1 = MIMEText(text, "plain")
            part2 = MIMEText(html, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.set_debuglevel(0)
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(
                    self.sender_email,
                    recipient_email,
                    message.as_string()
                )
            
            logger.info("OTP email accepted by SMTP server for %s", recipient_email)
            return True
            
        except smtplib.SMTPAuthenticationError:
            logger.error("SMTP authentication failed. Check your email credentials.")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Failed to send OTP email: {str(e)}")
            return False
    
    def send_welcome_email(self, recipient_email: str, username: str) -> bool:
        """Send welcome email to new user"""
        if not self.sender_email or not self.sender_password:
            logger.warning("Email service not configured. Skipping welcome email.")
            return False
        
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = "Welcome to Project Notes!"
            message["From"] = self.sender_email
            message["To"] = recipient_email
            
            text = f"""
Welcome to Morom Notes, {username}!

Your account has been successfully created.
You can now login and start taking notes.

Happy note-taking!
            """
            
            html = f"""
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #2563eb;">Welcome to Morom Notes!</h2>
                  <p>Hello <strong>{username}</strong>,</p>
                  <p>Your account has been successfully created. You can now login and start taking notes.</p>
                  <p style="margin-top: 20px;">Happy note-taking!</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                  <p style="font-size: 12px; color: #999;">
                    Questions? Contact support@projectnotes.com
                  </p>
                </div>
              </body>
            </html>
            """
            
            part1 = MIMEText(text, "plain")
            part2 = MIMEText(html, "html")
            message.attach(part1)
            message.attach(part2)
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.sender_email, self.sender_password)
                server.sendmail(
                    self.sender_email,
                    recipient_email,
                    message.as_string()
                )
            
            logger.info(f"Welcome email sent to {recipient_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send welcome email: {str(e)}")
            return False
