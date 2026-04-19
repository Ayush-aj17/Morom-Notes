import random
import string
from datetime import datetime, timedelta
from typing import Optional, Tuple

def generate_otp(length: int = 6) -> str:
    """Generate a random OTP of specified length"""
    return ''.join(random.choices(string.digits, k=length))

def is_otp_expired(otp_expires_at: Optional[datetime]) -> bool:
    """Check if OTP has expired (5 minutes validity)"""
    if not otp_expires_at:
        return True
    return datetime.utcnow() > otp_expires_at

def get_otp_expiry_time(minutes: int = 5) -> datetime:
    """Get OTP expiry time"""
    return datetime.utcnow() + timedelta(minutes=minutes)

def verify_otp(provided_otp: str, stored_otp: str, otp_expires_at: Optional[datetime]) -> Tuple[bool, str]:
    """
    Verify OTP
    Returns: (is_valid, message)
    """
    if not stored_otp:
        return False, "No OTP found. Please request a new OTP."
    
    if is_otp_expired(otp_expires_at):
        return False, "OTP has expired. Please request a new OTP."
    
    if provided_otp != stored_otp:
        return False, "Invalid OTP. Please try again."
    
    return True, "OTP verified successfully."
