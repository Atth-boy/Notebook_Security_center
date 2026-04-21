# 🏛 ภาพรวมระบบ (System Overview)

| ไฟล์ | บทบาท |
|------|--------|
| `index.html` | Hub — Login + เลือกศูนย์ + Main Menu |
| `page2.html` | ระบบบันทึกผู้เข้าปฏิบัติงานในสถานีไฟฟ้า ✅ |
| `page3.html` | ระบบบันทึกรายการอุปกรณ์ขัดข้อง 🚧 *(อยู่ระหว่างดำเนินการ)* |
| `appsscript_setup.gs` | Backend — Google Apps Script (ตรวจ Token + จัดการ DB) |

---

## 🚶‍♂️ ลำดับการใช้งาน (User Journey)

### 1. เข้าเว็บครั้งแรก (`index.html`)

```
ด่านที่ 1 — Login
  └─ เช็ค Token ใน localStorage
     ├─ ไม่มี → แสดงกล่องกรอกรหัสผ่าน (เช่น mea2569)
     └─ มี    → ข้ามไปด่านถัดไป

ด่านที่ 2 — Area
  └─ แสดงหน้าจอเลือกศูนย์ (3 ศูนย์ + ภาพรวม)

ด่านที่ 3 — Menu
  └─ แสดงปุ่มเมนูเข้าใช้งาน
     ├─ 🔘 เมนู 1: ระบบบันทึกเข้าสถานีไฟฟ้า  → page2.html
     └─ 🔘 เมนู 2: ระบบติดตามงาน กสฟ.        → page3.html
```

> มุมขวาบน มีปุ่ม ⚙️ **"เปลี่ยนศูนย์ / ออกจากระบบ"** เสมอ

---

### 2. เข้าเมนู 1 (`page2.html`)

- ตรวจ Token + ชื่อศูนย์แบบไร้รอยต่อ (เงียบหลังบ้าน)
- ผ่าน → แสดงตารางข้อมูลของศูนย์นั้นทันที *(ไม่มีหน้าต่างให้พิมพ์รหัสซ้ำ)*
- ไม่มี Token → redirect กลับ `index.html` อัตโนมัติ

### 3. เข้าเมนู 2 (`page3.html`)

- ตรวจ Token เหมือน page2
- แสดงหน้า **🚧 "ระบบบันทึกรายการอุปกรณ์ขัดข้อง"** พร้อมปุ่ม **⬅️ กลับหน้าหลัก**

---

## 💻 โครงร่างเชิงเทคนิค (Technical Specs)

### 📄 `index.html` — Login & Menu Hub

| Function | หน้าที่ |
|----------|---------|
| `checkLogin()` | เช็ค `localStorage.getItem('mea_token')` |
| `verifyToken(token)` | ส่งรหัสไปเทียบกับ Apps Script (API) |
| `selectArea(areaName)` | `localStorage.setItem('mea_area', areaName)` แล้วโชว์ Main Menu |
| `logout()` | `localStorage.clear()` แล้วรีเฟรชหน้า |

> ไม่มีการเก็บรหัสผ่านจริงไว้ในโค้ด — รับค่าผ่าน `<input id="pwInput">` เท่านั้น

---

### 📄 `page2.html` — Station Entry System

**UI:** ลบ `#areaScreen` และ `#pwOverlay` ออก (ไม่ต้องมีหน้าต่างเลือกศูนย์/รหัสผ่านในหน้านี้)

**On Load Logic:**
```js
const token = localStorage.getItem('mea_token');
const area  = localStorage.getItem('mea_area');
if (!token || !area) { window.location.href = 'index.html'; }
```

**API Calls:** ทุก `fetch` ต้องแนบ query string ไปด้วยเสมอ:
```
?token=${token}&area=${area}
```

---

### 📄 `page3.html` — Under Construction

- UI เรียบง่าย ธีมสีเดียวกับ กสฟ.
- On Load: เช็ค `localStorage` เหมือน page2 (ป้องกันคนนอกเข้าดูโครงสร้าง)

---

### ⚙️ `Code.gs` — Google Apps Script

```js
const SECRET_TOKEN = "substation";  // ประตูด่านแรก

function doGet(e) {
  if (e.parameter.token !== SECRET_TOKEN) return /* Error */;
  // ...
}

function doPost(e) {
  if (e.parameter.token !== SECRET_TOKEN) return /* Error */;
  // ...
}
```

> `doGet` และ `doPost` ทุกฟังก์ชันต้องขึ้นต้นด้วยการเช็ค Token เสมอ
