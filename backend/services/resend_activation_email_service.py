from datetime import datetime, timedelta
import secrets

from services.send_activation_email_service import send_activation_email

def resend_activation(user, db):

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    user.activation_token = token
    user.token_expires_at = expires_at
    

    db.commit()
    return send_activation_email(user.email,token)