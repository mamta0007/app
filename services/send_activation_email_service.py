from email.message import EmailMessage
import smtplib
from fastapi import HTTPException
from dotenv import load_dotenv
import os

load_dotenv()

def send_activation_email(email, token):
    base=os.getenv("BASE_URL")
    activation_link = f"{base}:5500/activate?token={token}"
    app_password = os.getenv("APP_PASSWORD") 
    msg = EmailMessage()
    msg.set_content(f"""
Hello,
Click the link below to activate your account:
{activation_link}

This link expires in 5 minutes.
""")

    msg['From'] = "mamtachoudhary7764@gmail.com"
    msg['To'] = email
    msg['Subject'] = "Email verification"

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        
        server.login("mamtachoudhary7764@gmail.com",app_password)
        server.sendmail(msg['From'], email, msg.as_string())
        server.quit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {str(e)}")
    return {"message": "Activation email sent successfully"}
