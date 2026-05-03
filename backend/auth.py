from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt
from datetime import datetime, timedelta
from backend.database import get_db
from backend.models import User, Notification

# ตั้งค่าสำหรับการเข้ารหัส
SECRET_KEY = "super-secret-key-todolist-1234"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

auth_router = APIRouter()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8')) 

auth_router = APIRouter()

# ฟังก์ชันช่วยจัดการ Password และ Token
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=1)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token ไม่ถูกต้อง")
        user = db.query(User).filter(User.id == int(user_id)).first()
        if user is None:
            raise HTTPException(status_code=401, detail="ไม่พบผู้ใช้")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token หมดอายุหรือผิดพลาด")

# ✅ 1. สมัครสมาชิก (Register)[cite: 1, 2]
@auth_router.post("/register", status_code=201)
async def register(data: dict, db: Session = Depends(get_db)):
    if db.query(User).filter((User.email == data['email']) | (User.username == data['username'])).first():
        raise HTTPException(status_code=400, detail="ชื่อผู้ใช้หรืออีเมลนี้มีในระบบแล้ว")
    
    new_user = User(
        username=data['username'],
        email=data['email'],
        password_hash=pwd_context.hash(data['password']),
        role=data.get('role', 'user')
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # สร้างการแจ้งเตือนต้อนรับ[cite: 2]
    welcome_noti = Notification(
        message=f"ยินดีต้อนรับคุณ {new_user.username} เข้าสู่ระบบ To-Do-List!",
        user_id=new_user.id
    )
    db.add(welcome_noti)
    db.commit()
    return {"msg": "สมัครสมาชิกสำเร็จ"}

# ✅ 2. เข้าสู่ระบบ (Login)[cite: 1, 2]
@auth_router.post("/login")
async def login(data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data['email']).first()
    if not user or not pwd_context.verify(data['password'], user.password_hash):
        raise HTTPException(status_code=401, detail="อีเมลหรือรหัสผ่านไม่ถูกต้อง")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "job_title": user.job_title,
            "department": user.department,
            "avatar_url": user.avatar_url
        }
    }

# ✅ 3. จัดการโปรไฟล์ (Update/Delete)[cite: 2, 9]
@auth_router.put("/profile")
async def update_profile(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if 'job_title' in data: current_user.job_title = data['job_title']
    if 'department' in data: current_user.department = data['department']
    if 'avatar_url' in data: current_user.avatar_url = data['avatar_url']
    if 'new_password' in data and data['new_password']:
        hashed = pwd_context.hash(data['new_password'])
        current_user.password_hash = hashed
        db.flush()  # บังคับเขียน password_hash ลง DB ทันที
        
    db.commit()
    db.refresh(current_user)  # โหลดข้อมูลล่าสุดจาก DB กลับมา
    return {"msg": "อัปเดตโปรไฟล์สำเร็จ", "user": {
        "id": current_user.id, "username": current_user.username, "email": current_user.email,
        "role": current_user.role, "job_title": current_user.job_title, 
        "department": current_user.department, "avatar_url": current_user.avatar_url
    }}

@auth_router.delete("/profile")
async def delete_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.delete(current_user)
    db.commit()
    return {"msg": "ลบบัญชีเรียบร้อยแล้ว"}