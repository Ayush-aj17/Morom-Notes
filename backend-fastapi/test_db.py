"""Legacy helper script used for quick manual database experiments.

This file is no longer required by the application and can be safely deleted
or ignored. It contains simple prints for educational purposes.
"""

import sys
import traceback
from database.db import SessionLocal
from database.models import User
from services.auth import get_password_hash

# note: the code below is intentionally commented out to avoid accidental
# execution. It demonstrates how to insert a user record manually.
#
# db = SessionLocal()
# try:
#     hashed = get_password_hash("123")
#     db_user = db.query(User).filter(User.username == "ayush999").first()
#     new_user = User(username="ayush999", hashed_password=hashed)
#     db.add(new_user)
#     db.commit()
# except Exception as e:
#     traceback.print_exc()
# finally:
#     db.close()
