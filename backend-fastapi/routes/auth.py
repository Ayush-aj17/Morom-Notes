from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from database.db import get_db
from database.models import User
from services.auth import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from services.otp_service import generate_otp, get_otp_expiry_time, verify_otp
from services.email_service import EmailService
from core.config import settings
from datetime import timedelta
from typing import List, Optional
from jose import jwt, JWTError
import logging

logger = logging.getLogger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

router = APIRouter(prefix="/auth", tags=["auth"])

def get_current_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Extract and validate user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    email: str  # Email is now required
    password: str

    class Config:
        str_min_length = 3

class UserLogin(BaseModel):
    email: str  # Login using email
    password: str

class OTPRequest(BaseModel):
    email: str  # Request OTP using email
    password: str

class OTPVerification(BaseModel):
    email: str
    otp: str

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    email: str
    email_verified: bool
    user_id: int

class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    email_verified: bool
    created_at: str

    class Config:
        from_attributes = True

class VerifyEmailRequest(BaseModel):
    otp: str

class DeleteAccountRequest(BaseModel):
    password: str
    confirmation: str = "DELETE"  # User must type "DELETE" to confirm

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ChangeUsernameRequest(BaseModel):
    new_username: str

class ForgotPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

def find_user_by_email(db: Session, email: str) -> Optional[User]:
    """Find user by email"""
    return db.query(User).filter(User.email == email).first()

@router.post("/signup")
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user - Returns success only after OTP verification.
    Step 1: Create account and send OTP
    """
    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=400, 
            detail="Account with this email already exists"
        )
    
    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user_data.username).first()
    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already taken"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        email_verified=False  # Not verified until OTP is confirmed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate and send OTP
    otp = generate_otp()
    otp_expires_at = get_otp_expiry_time(minutes=5)
    
    new_user.otp = otp
    new_user.otp_expires_at = otp_expires_at
    db.commit()
    
    # Send OTP via email
    email_sent = False
    if settings.email_sender:
        email_service = EmailService(
            smtp_server=settings.smtp_server,
            smtp_port=settings.smtp_port,
            sender_email=settings.email_sender,
            sender_password=settings.email_password,
        )
        email_sent = email_service.send_otp_email(new_user.email, otp, validity_minutes=5)
        logger.info(f"OTP sent to {new_user.email} for signup")
    
    if not email_sent and settings.email_sender:
        logger.warning(f"Failed to send OTP email to {new_user.email}")
    
    return {
        "message": "Account created! OTP sent to your email. Verify your email to login.",
        "email": new_user.email,
        "next_step": "verify-otp"
    }

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login with email and password - Returns token directly.
    No OTP required for normal login.
    """
    # Find user by email
    db_user = find_user_by_email(db, credentials.email)
    
    if not db_user:
        raise HTTPException(
            status_code=401, 
            detail="Account not found with this email"
        )
    
    # Verify password
    if not verify_password(credentials.password, db_user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Password is incorrect"
        )
    
    # Create and return access token directly
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user.username,
        "email": db_user.email,
        "email_verified": db_user.email_verified,
        "user_id": db_user.id
    }

@router.post("/forgot-password")
def forgot_password(email_request: dict, db: Session = Depends(get_db)):
    """
    Request OTP to reset forgotten password.
    Sends OTP only if account exists with that email.
    """
    email = email_request.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    db_user = find_user_by_email(db, email)
    
    if not db_user:
        # Don't reveal if email exists or not for security, but still return generic message
        return {
            "message": "If an account exists with this email, you will receive an OTP",
            "email": email
        }
    
    # Generate and store OTP
    otp = generate_otp()
    otp_expires_at = get_otp_expiry_time(minutes=10)
    
    db_user.otp = otp
    db_user.otp_expires_at = otp_expires_at
    db.commit()
    
    # Send OTP via email
    email_sent = False
    if settings.email_sender:
        email_service = EmailService(
            smtp_server=settings.smtp_server,
            smtp_port=settings.smtp_port,
            sender_email=settings.email_sender,
            sender_password=settings.email_password,
        )
        email_sent = email_service.send_otp_email(db_user.email, otp, validity_minutes=10)
        logger.info(f"Password reset OTP sent to {db_user.email}")
    
    if not email_sent and settings.email_sender:
        logger.warning(f"Failed to send password reset OTP to {email}")
    
    return {
        "message": "If an account exists with this email, you will receive an OTP",
        "email": email
    }

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@router.post("/reset-password", response_model=Token)
def reset_password(reset_req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password using OTP and email.
    """
    db_user = find_user_by_email(db, reset_req.email)
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Account not found")
    
    # Verify OTP
    is_valid, message = verify_otp(reset_req.otp, db_user.otp, db_user.otp_expires_at)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail=message)
    
    # Update password
    db_user.hashed_password = get_password_hash(reset_req.new_password)
    
    # Clear OTP after successful reset
    db_user.otp = None
    db_user.otp_expires_at = None
    db.commit()
    
    # Create and return access token for immediate login
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    logger.info(f"Password reset successful for {db_user.email}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user.username,
        "email": db_user.email,
        "email_verified": db_user.email_verified,
        "user_id": db_user.id
    }

@router.post("/verify-otp", response_model=Token)
def verify_signup_otp(verification: OTPVerification, db: Session = Depends(get_db)):
    """Verify OTP for signup email verification and return access token"""
    db_user = find_user_by_email(db, verification.email)
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Account not found")
    
    is_valid, message = verify_otp(verification.otp, db_user.otp, db_user.otp_expires_at)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail=message)
    
    # Mark email as verified after successful OTP verification (signup)
    db_user.email_verified = True
    
    # Clear OTP after successful verification
    db_user.otp = None
    db_user.otp_expires_at = None
    db.commit()
    
    # Create and return access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.email}, expires_delta=access_token_expires
    )
    
    logger.info(f"User {db_user.username} verified email and completed signup")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user.username,
        "email": db_user.email,
        "email_verified": db_user.email_verified,
        "user_id": db_user.id
    }

@router.post("/request-email-verification")
def request_email_verification(db: Session = Depends(get_db), current_user_id: int = None):
    """Request OTP for email verification"""
    # In a real app, you'd get current_user from auth header
    # For now, we'll need to modify this
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db_user = db.query(User).filter(User.id == current_user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if db_user.email_verified:
        return {"message": "Email already verified"}
    
    # Generate and store OTP
    otp = generate_otp()
    otp_expires_at = get_otp_expiry_time(minutes=10)
    
    db_user.otp = otp
    db_user.otp_expires_at = otp_expires_at
    db.commit()
    
    # Send OTP via email
    email_sent = False
    if db_user.email and settings.email_sender:
        email_service = EmailService(
            smtp_server=settings.smtp_server,
            smtp_port=settings.smtp_port,
            sender_email=settings.email_sender,
            sender_password=settings.email_password,
        )
        email_sent = email_service.send_otp_email(db_user.email, otp, validity_minutes=10)
    
    if not email_sent and settings.email_sender:
        logger.warning(f"Failed to send verification email to {db_user.email}")
    
    return {
        "message": "OTP sent to your email"
    }

@router.post("/verify-email", response_model=dict)
def verify_email(verification: VerifyEmailRequest, db: Session = Depends(get_db), current_user_id: int = None):
    """Verify email with OTP"""
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db_user = db.query(User).filter(User.id == current_user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_valid, message = verify_otp(verification.otp, db_user.otp, db_user.otp_expires_at)
    
    if not is_valid:
        raise HTTPException(status_code=401, detail=message)
    
    # Mark email as verified
    db_user.email_verified = True
    db_user.otp = None
    db_user.otp_expires_at = None
    db.commit()
    
    return {"message": "Email verified successfully", "email_verified": True}

@router.get("/profile", response_model=UserProfile)
def get_user_profile(db: Session = Depends(get_db), current_user_id: int = None):
    """Get current user profile"""
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db_user = db.query(User).filter(User.id == current_user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserProfile(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        phone=db_user.phone,
        email_verified=db_user.email_verified,
        created_at=db_user.created_at.isoformat()
    )

@router.post("/delete-account")
def delete_account(
    delete_request: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Delete user account completely - requires password verification"""
    
    # Verify password
    if not verify_password(delete_request.password, current_user.hashed_password):
        logger.warning(f"Failed password verification for delete account: {current_user.username}")
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Verify confirmation
    if delete_request.confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail='You must type "DELETE" to confirm account deletion'
        )
    
    # Delete all user data (cascading deletes will handle notes, folders, etc.)
    username_to_delete = current_user.username
    user_id = current_user.id
    
    try:
        logger.info(f"Deleting account for user: {username_to_delete} (ID: {user_id})")
        db.delete(current_user)
        db.commit()
        logger.info(f"✓ Successfully deleted account: {username_to_delete}")
        
        return {
            "message": "Account deleted successfully",
            "detail": f"All data for user {username_to_delete} has been permanently deleted"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting account {username_to_delete}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete account. Please try again."
        )

@router.post("/change-password")
def change_password(
    change_req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Change user password - requires current password verification"""
    
    # Verify current password
    if not verify_password(change_req.current_password, current_user.hashed_password):
        logger.warning(f"Failed password verification for change password: {current_user.username}")
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password
    if len(change_req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    if change_req.new_password == change_req.current_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    try:
        # Hash and update password
        current_user.hashed_password = get_password_hash(change_req.new_password)
        db.commit()
        logger.info(f"✓ Password changed successfully for user: {current_user.username}")
        
        return {
            "message": "Password changed successfully",
            "detail": "Your password has been updated"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error changing password for {current_user.username}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to change password. Please try again."
        )

@router.get("/me", response_model=UserProfile)
def get_current_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Get current authenticated user profile"""
    return UserProfile(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        email_verified=current_user.email_verified,
        created_at=current_user.created_at.isoformat()
    )

@router.post("/change-username")
def change_username(
    change_req: ChangeUsernameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_token)
):
    """Change user username - requires unique new username"""
    
    # Validate new username
    if not change_req.new_username or len(change_req.new_username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    if len(change_req.new_username) > 20:
        raise HTTPException(status_code=400, detail="Username must be at most 20 characters")
    
    new_username = change_req.new_username.strip()
    
    if new_username == current_user.username:
        raise HTTPException(status_code=400, detail="New username must be different from current username")
    
    # Check if new username already exists
    existing_user = db.query(User).filter(User.username == new_username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    try:
        # Update username
        current_user.username = new_username
        db.commit()
        logger.info(f"✓ Username changed successfully to: {new_username}")
        
        return {
            "message": "Username changed successfully",
            "new_username": new_username
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error changing username: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to change username. Please try again."
        )

@router.post("/forgot-password/verify-otp")
def forgot_password_verify_otp(
    forgot_req: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Verify OTP and change password without requiring current password"""
    
    # Find user by email
    user = find_user_by_email(db, forgot_req.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify OTP
    if not verify_otp(user.id, forgot_req.otp, db):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    
    # Validate new password
    if len(forgot_req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    try:
        # Hash and update password
        user.hashed_password = get_password_hash(forgot_req.new_password)
        db.commit()
        logger.info(f"✓ Password changed via forgot-password for user: {user.username}")
        
        return {
            "message": "Password changed successfully",
            "detail": "Your password has been reset"
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error changing password via forgot-password: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to change password. Please try again."
        )