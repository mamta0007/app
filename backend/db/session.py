from .database import sessionlocal

def get_db():
    db=sessionlocal()
    try:
        yield db
    finally:
        db.close()
        