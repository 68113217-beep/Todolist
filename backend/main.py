from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from backend.database import engine, get_db
from backend.models import Base, Task, User, Notification
from backend.auth import auth_router, get_current_user # อย่าลืมแก้ auth.py ด้วยนะครับ

# สร้างตารางอัตโนมัติ
Base.metadata.create_all(bind=engine)

# Migration: เพิ่มคอลัมน์ใหม่ให้กับ DB เดิมที่มีอยู่แล้ว
from sqlalchemy import text
with engine.connect() as conn:
    for col, col_type in [('priority', 'VARCHAR DEFAULT "high"'), ('start_date', 'VARCHAR'), ('due_date', 'VARCHAR')]:
        try:
            conn.execute(text(f'ALTER TABLE tasks ADD COLUMN {col} {col_type}'))
            conn.commit()
        except Exception:
            pass  # คอลัมน์มีอยู่แล้ว ข้ามไป

app = FastAPI(title="To-Do-List FastAPI")

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class LimitUploadSize(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "PUT" and "/profile" in str(request.url):
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > 5 * 1024 * 1024:
                return Response("ไฟล์ใหญ่เกิน 5MB", status_code=413)
        return await call_next(request)

app.add_middleware(LimitUploadSize)


# ✅ เปิด CORS ให้ Frontend คุยได้[cite: 5]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")

@app.get("/api/tasks")
async def get_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Task).filter(Task.user_id == current_user.id).all()

@app.post("/api/tasks", status_code=201)
async def add_task(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_task = Task(
        title=data['title'],
        status=data['status'],
        description=data.get('description'),

        priority=data.get('priority', 'high'),
        start_date=data.get('start_date'),
        due_date=data.get('due_date'),

        user_id=current_user.id
        

    )
    db.add(new_task)
    db.commit()
    return {"msg": "สร้างงานสำเร็จ"}

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task: raise HTTPException(404, "ไม่พบงาน")
    task.title = data.get('title', task.title)
    task.description = data.get('description', task.description)
    task.status = data.get('status', task.status)

    task.priority = data.get('priority', task.priority)
    task.start_date = data.get('start_date', task.start_date)
    task.due_date = data.get('due_date', task.due_date)

    db.commit()
    return {"msg": "อัปเดตงานสำเร็จ"}

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task: raise HTTPException(404, "ไม่พบงาน")
    db.delete(task)
    db.commit()
    return {"msg": "ลบสำเร็จ"}

# เพิ่มส่วนนี้ในไฟล์ backend/main.py
@app.get("/api/stats")
async def get_system_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # ตรวจสอบสิทธิ์ว่าต้องเป็น Admin เท่านั้นถึงจะดูได้
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึงข้อมูลนี้")

    total_users = db.query(User).count() # นับจำนวนผู้ใช้ทั้งหมด[cite: 4]
    total_tasks = db.query(Task).count() # นับงานทั้งหมดในระบบ[cite: 4]
    
    # คำนวณอัตราความสำเร็จ[cite: 4]
    done_tasks = db.query(Task).filter(Task.status == 'done').count()
    completion_rate = 0
    if total_tasks > 0:
        completion_rate = round((done_tasks / total_tasks) * 100, 1)

    return {
        "total_users": total_users,
        "total_tasks": total_tasks,
        "active_today": total_users,  # ใช้จำนวนผู้ใช้จริงแทนเลข
        "completion_rate": completion_rate
    }

@app.get("/api/admin/users")
async def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # ตรวจสอบว่าคนเรียกต้องเป็น Admin เท่านั้น
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง")
    
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "avatar_url": u.avatar_url,
        }
        for u in users
    ]

@app.delete("/api/admin/users/{user_id}")
async def delete_user_by_admin(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # ตรวจสอบสิทธิ์ Admin[cite: 8]
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึง")
    
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="ไม่พบผู้ใช้งานที่ต้องการลบ")
        
    db.delete(user_to_delete)
    db.commit()
    return {"msg": "ลบผู้ใช้งานเรียบร้อยแล้ว"}

@app.get("/api/notifications")
async def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # สร้างการแจ้งเตือนงานใกล้กำหนดส่งอัตโนมัติ
    from datetime import date, timedelta
    today = date.today()
    soon = today + timedelta(days=3)
    
    urgent_tasks = db.query(Task).filter(
        Task.user_id == current_user.id,
        Task.due_date != None,
        Task.status != 'done'
    ).all()

    for task in urgent_tasks:
        try:
            due = date.fromisoformat(task.due_date[:10])
            if due < today:
                msg = f"⚠️ งาน \"{task.title}\" เลยกำหนดส่งแล้ว! ({task.due_date[:10]})"
            elif due <= soon:
                msg = f"🔔 งาน \"{task.title}\" ใกล้ถึงกำหนดส่ง ({task.due_date[:10]})"
            else:
                continue
            # เช็คว่ามีการแจ้งเตือนนี้แล้วหรือยัง (ป้องกันซ้ำ)
            exists = db.query(Notification).filter(
                Notification.user_id == current_user.id,
                Notification.message == msg
            ).first()
            if not exists:
                db.add(Notification(message=msg, user_id=current_user.id))
        except Exception:
            pass
    db.commit()

    notis = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    return [{"id": n.id, "message": n.message, "is_read": n.is_read, "created_at": str(n.created_at)} for n in notis]

@app.delete("/api/notifications/clear")
async def clear_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"msg": "ล้างการแจ้งเตือนทั้งหมดแล้ว"}

@app.put("/api/notifications/read-all")
async def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"msg": "อ่านทั้งหมดแล้ว"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)