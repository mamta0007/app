from models.user import User
import secrets
from fastapi import HTTPException, status
from datetime import datetime, timedelta
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv
import os

load_dotenv()

def for_forgot_password(email, db):
    user=db.query(User).filter(User.email==email.email).first()
        
    if not user:
        raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="user not found"
            )
            
    if not user.status:
        raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email first."
            )
            
            
    reset_token=secrets.token_urlsafe(32)
    reset_token_expires_at=datetime.utcnow()+timedelta(minutes=5)
    user.reset_token=reset_token
    user.reset_token_expires_at=reset_token_expires_at
    db.commit()
    base=os.getenv("BASE_URL")
    
    sender_email = "mamtachoudhary7764@gmail.com"
    reciver_email = email.email
    app_password = os.getenv("APP_PASSWORD")  # Replace with your actual app password     
    reset_link = f"{base}:5500/reset-password?token={reset_token}"
    body = f"""
Click the link below to reset your password.

{reset_link}

This link expires in 5 minutes.
"""
    msg = EmailMessage()
    msg["From"] = sender_email
    msg["To"] = reciver_email
    msg["Subject"] = "Password Reset Request"
    msg.set_content(body)
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    
    server.login(sender_email, app_password)
    server.sendmail(sender_email, reciver_email, msg.as_string())   
    server.quit()
    
    return {"message": "Password reset email sent successfully. Please check your inbox."}
            