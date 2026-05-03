import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ✅ 1. หาตำแหน่งของโฟลเดอร์ backend ปัจจุบันอัตโนมัติ
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# ✅ 2. รวมตำแหน่งเข้ากับชื่อไฟล์ เพื่อให้ได้ที่อยู่ที่ถูกต้องเป๊ะๆ
DB_PATH = os.path.join(BASE_DIR, "todolist.db")

# ✅ 3. ใช้ที่อยู่ที่เราสร้างขึ้น (ระบุ sqlite:///)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=True, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()