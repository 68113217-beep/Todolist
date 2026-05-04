const API_URL = 'https://todolist-au7k.onrender.com/api';
let currentAvatarBase64 = null;

window.onload = () => {
    const token = localStorage.getItem('token');
    if (token) showDashboard();
};

function toggleAuth(mode) { 
    document.getElementById('login-page').classList.toggle('hidden', mode === 'register');
    document.getElementById('register-page').classList.toggle('hidden', mode === 'login');
}

// ระบบจัดการผู้ใช้ (Auth)
async function handleRegister() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = 'user';
    const msgDiv = document.getElementById('register-msg');

    // ✅ ล้างค่าเก่าและซ่อนไว้ก่อนเริ่มทำงานใหม่
    msgDiv.classList.add('hidden');
    msgDiv.className = "text-sm p-3 rounded-lg mb-4 text-center font-bold";

    if(!username || !email || !password) { msgDiv.classList.add('bg-red-100', 'text-red-600'); msgDiv.innerText = "ข้อมูลไม่ครบ"; return; }
    try {
        const response = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password, role }) });
        const d = await response.json();
        if (response.ok) { msgDiv.classList.add('bg-green-100', 'text-green-600'); msgDiv.innerText = "สมัครสำเร็จ! กำลังพาไปหน้า Login..."; setTimeout(() => toggleAuth('login'), 1500); }
        else {
            // ❌ ถ้าไม่สำเร็จ: แสดงสีแดง[cite: 3]
            msgDiv.classList.add('bg-red-100', 'text-red-600');
            msgDiv.innerText = d.msg || "เกิดข้อผิดพลาดในการสมัคร";
            msgDiv.classList.remove('hidden');
        }
    } catch (err) { alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้"); }
}

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');
    try {
        const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const data = await res.json();
        if (res.ok) { localStorage.setItem('token', data.access_token); localStorage.setItem('user', JSON.stringify(data.user)); showDashboard(); }
        else { errorDiv.innerText = data.msg; errorDiv.classList.remove('hidden'); }
    } catch (err) { errorDiv.innerText = "Server Error"; }
}

function handleLogout() { localStorage.clear(); location.reload(); }

// ✅ แก้ไขฟังก์ชัน showDashboard() ใน app.js ให้เหลือแค่ชุดเดียว
function showDashboard() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('register-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('display-username').innerText = user.username; //มือถือ
    const mobAv = document.getElementById('mob-avatar');//มือถือ
    if(mobAv) mobAv.innerText = user.username.charAt(0).toUpperCase();
    document.getElementById('display-role').innerText = user.role === 'admin' ? 'แอดมิน' : 'ผู้ใช้งาน';
    
    // เติมข้อมูลในหน้า Profile
    document.getElementById('profile-username').value = user.username;
    document.getElementById('profile-email').value = user.email || 'ไม่มีอีเมล';
    if (user.job_title) document.getElementById('profile-jobtitle').value = user.job_title;

    // แสดงบทบาทแบบ read-only
    const roleDisplay = document.getElementById('profile-role-display');
    if (roleDisplay) roleDisplay.value = user.role === 'admin' ? '👑 แอดมิน (Admin)' : '👤 ผู้ใช้งาน (User)';

    // โหลดรูปโปรไฟล์จาก localStorage ที่บันทึกไว้
    if (user.avatar_url) {
        currentAvatarBase64 = user.avatar_url;
        updateAvatarDisplay(user.avatar_url);
    }
    
    // 🛡️ ส่วนควบคุมสิทธิ์ Admin (เปิด/ปิดเมนู)
    const adminTab = document.getElementById('tab-admin-panel');
    const metricsTab = document.getElementById('tab-system-metrics');

    const mobAdminTab = document.getElementById('mob-tab-admin');
    const mobMetricsTab = document.getElementById('mob-tab-metrics');
    
    //มือถือ
    if (user.role === 'admin') { 
    if(adminTab) adminTab.classList.remove('hidden');
    if(metricsTab) metricsTab.classList.remove('hidden');
    if(mobAdminTab) mobAdminTab.classList.remove('hidden');
    if(mobMetricsTab) mobMetricsTab.classList.remove('hidden');
    fetchSystemStats();
} else {
    if(adminTab) adminTab.classList.add('hidden');
    if(metricsTab) metricsTab.classList.add('hidden');
    if(mobAdminTab) mobAdminTab.classList.add('hidden');
    if(mobMetricsTab) mobMetricsTab.classList.add('hidden');
}

    fetchNotifications(); // โหลดการแจ้งเตือนทุกครั้งที่เปิด app
    switchTab('my-tasks');
}


function getAuthHeaders() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }; }

async function addTaskFromPage() {

    if (editingTaskId) {
        return updateTask(); 
    }

    const title = document.getElementById('page-task-title').value;
    const status = document.getElementById('page-task-status').value;
    const desc = document.getElementById('page-task-desc').value;
    const priorityEl = document.querySelector('input[name="priority"]:checked');
    const priority = priorityEl ? priorityEl.value : 'high';
    const start_date = document.getElementById('page-task-start-date') ? document.getElementById('page-task-start-date').value || null : null;
    const due_date = document.getElementById('page-task-due-date') ? document.getElementById('page-task-due-date').value || null : null;
    
    if (!title) return alert('กรุณาระบุชื่องาน');

    try {
        const res = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, status, description: desc, priority, start_date, due_date })
        });
        if (res.ok) {
            alert('บันทึกงานสำเร็จ!');
            resetTaskForm();
            switchTab('my-tasks');
        }
    } catch (err) { console.error(err); }
}

// ✅ ใช้ฟังก์ชัน fetchTasks ชุดนี้ชุดเดียวเท่านั้น (ลบของเก่าที่ซ้ำกันออกให้หมดก่อนวาง)
async function fetchTasks() {
    const res = await fetch(`${API_URL}/tasks`, { headers: getAuthHeaders() });
    if (res.ok) {
        const tasks = await res.json();
        
        const colTodo = document.getElementById('col-todo');
        const colInpro = document.getElementById('col-inprogress');
        const colDone = document.getElementById('col-done');

        if (colTodo) colTodo.innerHTML = '';
        if (colInpro) colInpro.innerHTML = '';
        if (colDone) colDone.innerHTML = '';

        let doneCount = 0;

        const statusLabel = { todo: 'สิ่งที่ต้องทำ', inprogress: 'กำลังดำเนินการ', done: 'เสร็จสิ้น' };
        const priorityCfg = {
            high:   { label: 'สูง',     cls: 'text-red-500 bg-red-50' },
            medium: { label: 'ปานกลาง', cls: 'text-yellow-500 bg-yellow-50' },
            low:    { label: 'ต่ำ',     cls: 'text-green-500 bg-green-50' }
        };

        tasks.forEach(t => {
            if(t.status === 'done') doneCount++;

            const p = priorityCfg[t.priority] || priorityCfg.high;

            let dateDisplay = 'ไม่กำหนดวันที่';
            if (t.status === 'done' && t.due_date) {
                const d = new Date(t.due_date + 'T00:00:00');
                dateDisplay = '✅ เสร็จสิ้นเมื่อ: ' + d.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'});
            } else if (t.due_date) {
                const d = new Date(t.due_date + 'T00:00:00');
                const today = new Date(); today.setHours(0,0,0,0);
                const diffDays = Math.ceil((d - today) / (1000*60*60*24));
                if (diffDays < 0) {
                    dateDisplay = '🔴 เลยกำหนด: ' + d.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'});
                } else if (diffDays === 0) {
                    dateDisplay = '🔴 ครบกำหนดวันนี้!';
                } else if (diffDays <= 3) {
                    dateDisplay = '🟡 กำหนดส่ง: ' + d.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'}) + ` (อีก ${diffDays} วัน)`;
                } else {
                    dateDisplay = 'กำหนดส่ง: ' + d.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'});
                }
            } else if (t.start_date) {
                const d = new Date(t.start_date + 'T00:00:00');
                dateDisplay = 'เริ่ม: ' + d.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'numeric'});
            }

            const taskHtml = `
                <div onclick="viewTaskDetail(${t.id})" class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm mb-4 transition-all hover:shadow-md cursor-pointer">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold px-2 py-1 rounded-lg ${p.cls}">● ${p.label}</span>
                        <div class="flex space-x-2">
                            <button onclick="event.stopPropagation(); editTask(${t.id})" class="text-blue-500 hover:text-blue-700">
                                <i class="fa-solid fa-pen-to-square text-base"></i>
                            </button>
                            <button onclick="event.stopPropagation(); deleteTask(${t.id})" class="text-red-400 hover:text-red-600">
                                <i class="fa-solid fa-trash-can text-base"></i>
                            </button>
                        </div>
                    </div>
                    <h4 class="font-black text-gray-800 dark:text-white text-base mt-2 mb-1">${t.title}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">${t.description || 'ไม่มีรายละเอียด'}</p>
                    <div class="flex justify-between items-center text-[11px] font-bold text-gray-400">
                        <span><i class="fa-regular fa-calendar mr-1"></i>${dateDisplay}</span>
                        <span class="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-lg">${statusLabel[t.status] || t.status}</span>
                    </div>
                </div>`;

            const col = document.getElementById('col-' + t.status);
            if (col) col.innerHTML += taskHtml;
        });

        const doneLabel = document.getElementById('profile-tasks-done');
        const prodLabel = document.getElementById('profile-productivity');
        if (doneLabel) doneLabel.innerText = doneCount;
        if (prodLabel) prodLabel.innerText = tasks.length ? Math.round((doneCount/tasks.length)*100)+'%' : '0%';
    }
}

async function deleteTask(id) { if(confirm('ลบงาน?')) { await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); fetchTasks(); } }

// ส่วน Profile และอื่นๆ ยังคงเดิม (เหมือนใน source: 6)
function updateAvatarDisplay(url, name) {
    const img = document.getElementById('profile-avatar-img');
    const icon = document.getElementById('profile-avatar-icon');
    const nav = document.getElementById('user-avatar-initial');
    if(url) { img.src = url; img.classList.remove('hidden'); icon.classList.add('hidden'); nav.innerHTML = `<img src="${url}" class="w-full h-full object-cover">`; }
    else { img.classList.add('hidden'); icon.classList.remove('hidden'); nav.innerHTML = name ? name.charAt(0).toUpperCase() : 'U'; }
}

function previewAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 300;
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
            else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            currentAvatarBase64 = canvas.toDataURL('image/jpeg', 0.7);
            updateAvatarDisplay(currentAvatarBase64);
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}


function removeAvatar() { currentAvatarBase64 = null; updateAvatarDisplay(null, document.getElementById('profile-username').value); }
function togglePasswordInput() { document.getElementById('password-edit-area').classList.toggle('hidden'); }

async function saveProfile() {
    const newPwd = document.getElementById('profile-new-password').value;
    const confirmPwd = document.getElementById('profile-confirm-password') ? document.getElementById('profile-confirm-password').value : '';
    
    // ตรวจสอบรหัสผ่านใหม่ถ้ามีการกรอก
    if (newPwd.trim() !== '') {
        if (newPwd.length < 6) { alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
        if (confirmPwd && newPwd !== confirmPwd) { alert('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน'); return; }
    }

    const payload = { 
        job_title: document.getElementById('profile-jobtitle').value
    };
    if (currentAvatarBase64) payload.avatar_url = currentAvatarBase64;
    if (newPwd.trim() !== '') payload.new_password = newPwd;

    try {
        const res = await fetch(`${API_URL}/auth/profile`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
        if (res.ok) { 
            const data = await res.json();
            localStorage.setItem('user', JSON.stringify(data.user));
            // อัปเดต UI โดยไม่ต้อง reload หน้า
            document.getElementById('display-username').innerText = data.user.username;
            if (data.user.avatar_url) updateAvatarDisplay(data.user.avatar_url);
            // ล้างช่องรหัสผ่านหลังบันทึก
            document.getElementById('profile-new-password').value = '';
            const confirmEl = document.getElementById('profile-confirm-password');
            if (confirmEl) confirmEl.value = '';
            document.getElementById('password-edit-area').classList.add('hidden');
            alert('บันทึกเรียบร้อย!');
        } else {
            const err = await res.json();
            alert('บันทึกไม่สำเร็จ: ' + (err.detail || err.msg || 'Unknown error'));
        }
    } catch (err) { alert('Server Error'); }
}

async function deleteAccount() {
    if (confirm('⚠️ คุณแน่ใจหรือไม่ที่จะลบบัญชี? ข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้')) {
        try {
            const res = await fetch(`${API_URL}/auth/profile`, { 
                method: 'DELETE', 
                headers: getAuthHeaders() // ต้องส่ง Token ไปด้วยเพื่อให้ระบบรู้ว่าลบใคร[cite: 3]
            });
            
            if (res.ok) {
                alert('ลบบัญชีของคุณเรียบร้อยแล้ว');
                handleLogout(); // ✅ ลบสำเร็จแล้วต้องเตะออกจากระบบทันที[cite: 3]
            } else {
                const errorData = await res.json();
                alert('เกิดข้อผิดพลาด: ' + errorData.msg);
            }
        } catch (err) {
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
    }
}

async function fetchNotifications() {
    try {
        const res = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
        if (res.ok) {
            const notis = await res.json();
            const list = document.getElementById('noti-list');
            const badge = document.getElementById('noti-badge');
            const unreadCount = notis.filter(n => !n.is_read).length;
            
            if (unreadCount > 0) {
                badge.classList.remove('hidden');
                badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
            } else {
                badge.classList.add('hidden');
            }

            if (notis.length > 0) {
                list.innerHTML = notis.map(n => {
                    const isUrgent = n.message.startsWith('⚠️');
                    const isDue = n.message.startsWith('🔔');
                    let bgClass = n.is_read ? '' : 'bg-blue-50';
                    if (isUrgent) bgClass = 'bg-red-50';
                    else if (isDue) bgClass = 'bg-yellow-50';
                    return `
                    <div class="p-3 text-sm border-b last:border-0 rounded-lg ${bgClass}">
                        <p class="${n.is_read && !isUrgent && !isDue ? 'text-gray-400' : 'font-bold text-gray-800'}">${n.message}</p>
                        <p class="text-xs text-gray-400 mt-1">${new Date(n.created_at).toLocaleString('th-TH')}</p>
                    </div>`;
                }).join('');
                // เพิ่มปุ่มล้างการแจ้งเตือน
                list.innerHTML += `<div class="p-2 text-center">
                    <button onclick="clearNotifications()" class="text-xs text-red-400 hover:text-red-600 font-bold">ล้างการแจ้งเตือนทั้งหมด</button>
                </div>`;
            } else {
                list.innerHTML = '<p class="text-center text-xs text-gray-400 py-4 italic">ไม่มีการแจ้งเตือน</p>';
            }
        }
    } catch(err) { console.error('โหลดการแจ้งเตือนไม่สำเร็จ', err); }
}

async function clearNotifications() {
    if (!confirm('ล้างการแจ้งเตือนทั้งหมด?')) return;
    await fetch(`${API_URL}/notifications/clear`, { method: 'DELETE', headers: getAuthHeaders() });
    fetchNotifications();
}

function toggleNotifications() {
    const dropdown = document.getElementById('noti-dropdown');
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
        fetchNotifications();
        fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: getAuthHeaders() })
            .then(() => { document.getElementById('noti-badge').classList.add('hidden'); });
    }
}

// ปิด notification เมื่อคลิกข้างนอก มือถือ
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('noti-dropdown');
    const bell = e.target.closest('[onclick="toggleNotifications()"]');
    if (!bell && dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
    }
});

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

window.addEventListener('DOMContentLoaded', () => {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.documentElement.classList.add('dark');
    updateThemeIcon(isDark);
});


let editingTaskId = null; // ตัวแปรเก็บ ID งานที่กำลังแก้ไข

// ✅ 1. ฟังก์ชันตอนกด "แก้ไข"
async function editTask(id) {
    const res = await fetch(`${API_URL}/tasks`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const tasks = await res.json();
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id; // เซ็ตก่อน switchTab เพื่อกัน resetTaskForm ทับ

    document.getElementById('page-task-title').value = task.title;
    document.getElementById('page-task-desc').value = task.description || '';
    document.getElementById('page-task-status').value = task.status;

    const startEl = document.getElementById('page-task-start-date');
    const dueEl = document.getElementById('page-task-due-date');
    if (startEl) startEl.value = task.start_date || '';
    if (dueEl) dueEl.value = task.due_date || '';

    // เซ็ต priority radio
    const pVal = task.priority || 'high';
    const pRadio = document.querySelector(`input[name="priority"][value="${pVal}"]`);
    if (pRadio) { pRadio.checked = true; if(typeof updatePriorityStyle==='function') updatePriorityStyle(pRadio); }

    // เปลี่ยนหัวข้อและปุ่ม
    const formTitle = document.getElementById('task-form-title');
    if (formTitle) formTitle.innerText = 'แก้ไขงาน';
    const btn = document.getElementById('main-task-btn');
    if (btn) {
        btn.innerText = 'บันทึกการเปลี่ยนแปลง';
        btn.setAttribute('onclick', 'updateTask()');
        btn.classList.remove('hidden');
    }

    // ปลดล็อก input (กรณีมาจาก viewTaskDetail)
    document.getElementById('page-task-title').readOnly = false;
    document.getElementById('page-task-desc').readOnly = false;
    document.getElementById('page-task-status').disabled = false;

    switchTab('add-task');
}


// ✅ 3. แก้ไขฟังก์ชัน switchTab เพื่อให้ล้างฟอร์มทุกครั้งที่กด "เพิ่มงานใหม่"
function switchTab(tabId) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600', 'bg-blue-50');
        btn.classList.add('text-gray-400'); 
    });

    const targetView = document.getElementById('view-' + tabId);
    if (targetView) targetView.classList.remove('hidden');

    const activeBtn = document.getElementById('tab-' + tabId);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-blue-600', 'bg-blue-50');
    }

    // ถ้ากด "เพิ่มงานใหม่" จากเมนู → เคลียร์ state เก่าทิ้งเสมอ
    if (tabId === 'add-task' && editingTaskId === null) {
        resetTaskForm();
    }
    
    if (tabId === 'my-tasks') fetchTasks();
    if (tabId === 'calendar') loadCalendarTasks();

    //มือถือ
    if (tabId === 'admin-panel') fetchUsers();
    if (tabId === 'system-metrics') fetchSystemStats();
    document.querySelectorAll('#mobile-nav button').forEach(b => b.classList.remove('active'));
    const mobMap = {'my-tasks':'mob-tab-tasks','add-task':'mob-tab-add','profile':'mob-tab-profile','admin-panel':'mob-tab-admin','system-metrics':'mob-tab-metrics'};
    if (mobMap[tabId]) { const el = document.getElementById(mobMap[tabId]); if(el) el.classList.add('active'); }

}

async function updateTask() {
    const title = document.getElementById('page-task-title').value;
    const description = document.getElementById('page-task-desc').value;
    const status = document.getElementById('page-task-status').value;
    const priorityEl = document.querySelector('input[name="priority"]:checked');
    const priority = priorityEl ? priorityEl.value : 'high';
    const start_date = document.getElementById('page-task-start-date') ? document.getElementById('page-task-start-date').value || null : null;
    const due_date = document.getElementById('page-task-due-date') ? document.getElementById('page-task-due-date').value || null : null;

    if (!title) return alert('กรุณาระบุชื่องาน');

    try {
        const res = await fetch(`${API_URL}/tasks/${editingTaskId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title, status, description, priority, start_date, due_date })
        });

        if (res.ok) {
            alert('อัปเดตงานสำเร็จ!');
            resetTaskForm(); 
            switchTab('my-tasks');
        } else {
            const err = await res.json();
            alert('แก้ไขไม่สำเร็จ: ' + (err.detail || 'Unknown error'));
        }
    } catch (err) { 
        console.error(err); 
    }
}



async function viewTaskDetail(id) {
    const res = await fetch(`${API_URL}/tasks`, { headers: getAuthHeaders() });
    if (res.ok) {
        const tasks = await res.json();
        const task = tasks.find(t => t.id === id);
        
        if (task) {
            editingTaskId = null; // ดูอย่างเดียว ไม่ใช่แก้ไข

            document.getElementById('page-task-title').value = task.title;
            document.getElementById('page-task-desc').value = task.description || '';
            document.getElementById('page-task-status').value = task.status;

            const startEl = document.getElementById('page-task-start-date');
            const dueEl = document.getElementById('page-task-due-date');
            if (startEl) startEl.value = task.start_date || '';
            if (dueEl) dueEl.value = task.due_date || '';

            // set priority radio (read-only display)
            const pVal = task.priority || 'high';
            const pRadio = document.querySelector(`input[name="priority"][value="${pVal}"]`);
            if (pRadio) pRadio.checked = true;
            
            // ตั้งค่า Read-only
            document.getElementById('page-task-title').readOnly = true;
            document.getElementById('page-task-desc').readOnly = true;
            document.getElementById('page-task-status').disabled = true;
            
            // เปลี่ยนหัวข้อ + ซ่อนปุ่มบันทึก
            const formTitle = document.getElementById('task-form-title');
            if (formTitle) formTitle.innerText = 'รายละเอียดงาน';
            const btn = document.getElementById('main-task-btn');
            if (btn) btn.classList.add('hidden');
            
            switchTab('add-task');
        }
    }
}



// ดักจับการพิมพ์ในช่องค้นหาแบบ Real-time
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        // เลือก Card งานทั้งหมดที่แสดงอยู่ในหน้า "งานของฉัน"
        const allTasks = document.querySelectorAll('#view-my-tasks .bg-white, #view-my-tasks .dark\\:bg-slate-800');

        allTasks.forEach(card => {
            const title = card.querySelector('h4').innerText.toLowerCase();
            const description = card.querySelector('p').innerText.toLowerCase();

            // ถ้าชื่อหรือรายละเอียดมีคำที่ตรงกัน ให้แสดงผล ถ้าไม่ตรงให้ซ่อน
            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    });
}
// ฟังก์ชันดึงสถิติรวมทั้งระบบ (สำหรับ Admin เท่านั้น)[cite: 1, 4]
async function fetchSystemStats() {
    try {
        const res = await fetch(`${API_URL}/stats`, { 
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
        });
        if (res.ok) {
            const data = await res.json();
            // 📍 นำข้อมูลจริงมาใส่ใน ID ที่เราตั้งไว้ใน HTML[cite: 1]
            document.getElementById('total-users-count').innerText = data.total_users; // จำนวนผู้ใช้จริง
            document.getElementById('total-tasks-count').innerText = data.total_tasks; // จำนวนงานจริง
            document.getElementById('system-health').innerText = data.completion_rate + '%'; // อัตราสำเร็จจริง

            const activeEl = document.getElementById('active-users-count');
            if(activeEl) activeEl.innerText = data.active_today;
        }
    } catch (err) {
        console.error("ไม่สามารถเชื่อมต่อข้อมูลสถิติจริงได้");
    }
}

// ฟังก์ชันดึงรายชื่อผู้ใช้ (ใช้ id="user-list-table")
async function fetchUsers() {
    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const users = await res.json();
            const tableBody = document.getElementById('user-list-table');
            
            // อัปเดตตัวเลขจำนวนผู้ใช้ตรง Badge
            if(document.getElementById('user-count-badge')) 
                document.getElementById('user-count-badge').innerText = users.length;

            tableBody.innerHTML = ''; 
            users.forEach(user => {
                const row = `
                    <tr class="hover:bg-blue-50/20 transition-all duration-200">
                        <td class="px-8 py-5">
                            <div class="flex items-center gap-4">
                                ${user.avatar_url
                                    ? `<img src="${user.avatar_url}" class="w-10 h-10 rounded-full object-cover border border-blue-200 shadow-sm" />`
                                    : `<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs border border-blue-200 shadow-sm">${user.username.charAt(0).toUpperCase()}</div>`
                                }
                                <span class="font-bold text-gray-800">${user.username}</span>
                            </div>
                        </td>
                        <td class="px-8 py-5">
                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}">
                                ${user.role}
                            </span>
                        </td>
                        <td class="px-8 py-5">
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-green-500"></span>
                                <span class="text-xs font-bold text-gray-500 italic">Active</span>
                            </div>
                        </td>
                        <td class="px-8 py-5 text-right">
                            <button onclick="changeRole(${user.id}, '${user.role}')" class="p-2 text-gray-300 hover:text-blue-500 transition-all" title="เปลี่ยน Role">
                                <span class="material-symbols-outlined text-lg">swap_horiz</span>
                            </button>
                            <button onclick="deleteUser(${user.id})" class="p-2 text-gray-300 hover:text-red-500 transition-all" title="ลบผู้ใช้">
                                <span class="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </td>
                    </tr>`;
                tableBody.insertAdjacentHTML('beforeend', row);
            });
        }
    } catch (err) { console.error("ดึงข้อมูลไม่สำเร็จ"); }
}

// ฟังก์ชันค้นหา (Search Filter)
function filterUsers() {
    const input = document.getElementById('user-search-input');
    const filter = input.value.toLowerCase();
    const table = document.getElementById('user-list-table');
    const tr = table.getElementsByTagName('tr');

    for (let i = 0; i < tr.length; i++) {
        const textContent = tr[i].textContent.toLowerCase();
        tr[i].style.display = textContent.includes(filter) ? "" : "none";
    }
}

async function changeRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`เปลี่ยน role เป็น "${newRole}" ใช่ไหม?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}/role`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });
        if (res.ok) { alert('เปลี่ยน role สำเร็จ'); fetchUsers(); }
        else { const e = await res.json(); alert('ผิดพลาด: ' + (e.detail || e.msg)); }
    } catch (err) { alert('เชื่อมต่อไม่ได้'); }
}

// ฟังก์ชันลบผู้ใช้งาน (สำหรับ Admin เท่านั้น)
// แก้ไขฟังก์ชัน deleteUser ในไฟล์ app_9.js
async function deleteUser(id) {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser && currentUser.id === id) {
        alert("คุณไม่สามารถลบบัญชีของตัวเองได้");
        return;
    }

    if (confirm('⚠️ ยืนยันการลบผู้ใช้งาน? ข้อมูลทั้งหมดจะหายไปถาวร')) {
        try {
            // เรียกไปที่ /admin/users/ ตาม Route ที่เราเพิ่มใน main.py
            const res = await fetch(`${API_URL}/admin/users/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders() 
            });

            if (res.ok) {
                alert('ลบผู้ใช้งานเรียบร้อยแล้ว');
                fetchUsers(); // รีเฟรชตาราง[cite: 9]
            } else {
                const errorData = await res.json().catch(() => ({}));
                // FastAPI จะส่งข้อความผิดพลาดกลับมาในตัวแปร detail[cite: 8]
                const errorMsg = errorData.detail || errorData.msg || 'เกิดข้อผิดพลาดในการลบ';
                alert('เกิดข้อผิดพลาด: ' + errorMsg);
            }
        } catch (err) {
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
        }
    }
}

function resetTaskForm() {
    editingTaskId = null;
    const titleInput = document.getElementById('page-task-title');
    const descInput = document.getElementById('page-task-desc');
    const statusInput = document.getElementById('page-task-status');
    const startDate = document.getElementById('page-task-start-date');
    const dueDate = document.getElementById('page-task-due-date');
    
    if (titleInput) { titleInput.readOnly = false; titleInput.value = ''; }
    if (descInput) { descInput.readOnly = false; descInput.value = ''; }
    if (statusInput) { statusInput.disabled = false; statusInput.value = 'todo'; }
    if (startDate) startDate.value = '';
    if (dueDate) dueDate.value = '';

    // รีเซ็ต priority กลับเป็น "สูง"
    const highRadio = document.querySelector('input[name="priority"][value="high"]');
    if (highRadio) { highRadio.checked = true; if(typeof updatePriorityStyle==='function') updatePriorityStyle(highRadio); }

    const formTitle = document.getElementById('task-form-title');
    if (formTitle) formTitle.innerText = 'เพิ่มงานใหม่';
    
    const btn = document.getElementById('main-task-btn');
    if (btn) {
        btn.innerText = 'บันทึก';
        btn.setAttribute('onclick', 'addTaskFromPage()');
        btn.classList.remove('hidden');
    }
}
// ==================== ปฏิทินงาน ====================
let calCurrentDate = new Date();
let calAllTasks = [];

async function loadCalendarTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks`, { headers: getAuthHeaders() });
        if (res.ok) {
            calAllTasks = await res.json();
        }
    } catch(e) { console.error(e); }
    renderCalendar();
}

function changeMonth(delta) {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + delta);
    renderCalendar();
    document.getElementById('cal-tasks-panel').classList.add('hidden');
}

function renderCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();
    const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    document.getElementById('cal-month-label').innerText = `${monthNames[month]} ${year + 543}`;

    const grid = document.getElementById('cal-grid');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Build map: date string -> tasks
    const taskMap = {};
    calAllTasks.forEach(t => {
        if (t.due_date) {
            const key = t.due_date.split('T')[0];
            if (!taskMap[key]) taskMap[key] = [];
            taskMap[key].push(t);
        }
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="h-16"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        const hasTasks = taskMap[dateStr] && taskMap[dateStr].length > 0;
        const taskCount = hasTasks ? taskMap[dateStr].length : 0;
        const dotColor = hasTasks ? 'bg-blue-500' : '';

        grid.innerHTML += `
            <div onclick="selectCalDay('${dateStr}')" 
                class="h-16 flex flex-col items-center justify-start pt-2 rounded-xl cursor-pointer hover:bg-blue-50 transition
                ${isToday ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-gray-700 dark:text-gray-200'}">
                <span class="text-sm font-bold">${d}</span>
                ${hasTasks ? `<span class="mt-1 w-5 h-5 rounded-full bg-blue-${isToday ? '200' : '100'} text-blue-${isToday ? '900' : '600'} text-[10px] font-black flex items-center justify-center">${taskCount}</span>` : ''}
            </div>`;
    }
}

function selectCalDay(dateStr) {
    const panel = document.getElementById('cal-tasks-panel');
    const label = document.getElementById('cal-selected-date-label');
    const list = document.getElementById('cal-task-list');

    const d = new Date(dateStr + 'T00:00:00');
    const thaiDay = d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    label.innerText = `งานในวัน ${thaiDay}`;

    const tasks = calAllTasks.filter(t => t.due_date && t.due_date.split('T')[0] === dateStr);

    if (tasks.length === 0) {
        list.innerHTML = `<p class="text-sm text-gray-400 italic">ไม่มีงานในวันนี้</p>`;
    } else {
        const statusMap = { todo: { label: 'สิ่งที่ต้องทำ', color: 'bg-gray-100 text-gray-600' }, inprogress: { label: 'กำลังดำเนินการ', color: 'bg-blue-100 text-blue-600' }, done: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-600' } };
        list.innerHTML = tasks.map(t => {
            const s = statusMap[t.status] || { label: t.status, color: 'bg-gray-100 text-gray-600' };
            return `<div class="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                <div>
                    <p class="font-bold text-gray-800 text-sm">${t.title}</p>
                    <p class="text-xs text-gray-400 mt-1">${t.description || 'ไม่มีรายละเอียด'}</p>
                </div>
                <span class="px-3 py-1 rounded-full text-[10px] font-black ${s.color}">${s.label}</span>
            </div>`;
        }).join('');
    }

   // รีเซ็ต priority กลับเป็น "สูง"
    const highRadio = document.querySelector('input[name="priority"][value="high"]');
    if (highRadio) { highRadio.checked = true; updatePriorityStyle(highRadio); }
    
    const formTitle = document.getElementById('task-form-title') || document.querySelector('#view-add-task h2');
    if (formTitle) formTitle.innerText = "เพิ่มงานใหม่";
    
    const saveBtn = document.getElementById('main-task-btn') || 
                    document.querySelector('button[onclick="updateTask()"]') || 
                    document.querySelector('button[onclick="addTaskFromPage()"]');
    if (saveBtn) {
        saveBtn.innerText = "บันทึก";
        saveBtn.setAttribute('onclick', 'addTaskFromPage()');

    panel.classList.remove('hidden');
    }
}
