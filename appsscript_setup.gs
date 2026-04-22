// ============================================================
//  Apps Script — ศูนย์รักษาความปลอดภัย กสฟ.
//  Handles: verify login + CRUD for page2.html
// ============================================================

// ---------- Token Config ----------
// แก้ token ที่นี่ที่เดียว — ไม่ต้องแก้ HTML
// role: 'master' = ดูได้ทุก area | 'user' = ล็อกตาม area
const TOKEN_CONFIG = {
  'mea':  { role: 'master', area: null          },
  '0414': { role: 'user',   area: 'บางแค'       },
  '0415': { role: 'user',   area: 'บางบัวทอง'   },
  '0418': { role: 'user',   area: 'พระประแดง'   },
  '0500': { role: 'user',   area: 'ภาพรวม'      },  // ภาพรวม = ดูได้ทุก area เหมือน master
};

const SHEET_NAME = 'บันทึก';

const HEADERS = [
  'timestamp', 'area', 'name', 'empId',
  'site', 'dept', 'div', 'tel',
  'dateFrom', 'dateTo', 'timeFrom', 'timeTo', 'workDetail'
];

const COL = {
  timestamp:1, area:2, name:3, empId:4,
  site:5, dept:6, div:7, tel:8,
  dateFrom:9, dateTo:10, timeFrom:11, timeTo:12, workDetail:13
};

// ---------- Token Verification ----------
function verifyToken(token) {
  if (!token) return null;
  return TOKEN_CONFIG[String(token).trim()] || null;
}

// user token ที่ต้อง filter area (ภาพรวม = ไม่ filter)
function getFilterArea(info) {
  if (!info) return null;
  if (info.role === 'master') return null;
  if (info.area === 'ภาพรวม') return null;
  return info.area;
}

// ---------- doGet ----------
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || '';
  const token  = params.token  || '';

  // Login endpoint — index.html ยิงมาตรวจสอบ token
  if (action === 'verify') {
    const info = verifyToken(token);
    if (!info) return jsonOk({ valid: false });
    return jsonOk({ valid: true, role: info.role, area: info.area });
  }

  // Read endpoint — ต้องผ่าน token
  const info = verifyToken(token);
  if (!info) return jsonOk({ status: 'error', msg: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);
    return handleRead(sheet, info);
  } catch(err) {
    return jsonOk({ status: 'error', msg: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ---------- doPost ----------
function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || '';
  const token  = params.token  || '';

  const info = verifyToken(token);
  if (!info) return jsonOk({ status: 'error', msg: 'unauthorized' });

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);

    if (action === 'add')    return handleAdd(sheet, params, info);
    if (action === 'update') return handleUpdate(sheet, params, info);
    if (action === 'delete') return handleDelete(sheet, params, info);

    return jsonOk({ status: 'error', msg: 'unknown action: ' + action });
  } catch(err) {
    return jsonOk({ status: 'error', msg: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ---------- สร้าง / เช็ค Sheet ----------
function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold')
         .setBackground('#374151')
         .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  HEADERS.forEach(h => {
    if (!existingHeaders.includes(h)) {
      const newCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, newCol).setValue(h)
           .setFontWeight('bold')
           .setBackground('#374151')
           .setFontColor('#ffffff');
    }
  });
  return sheet;
}

// ---------- แปลง Sheets time (decimal) → "HH:MM" ----------
function cellToTime(val) {
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  return val ? String(val) : '';
}

// ---------- Read: คืน records (filter area ถ้าเป็น user token) ----------
function handleRead(sheet, info) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonOk([]);

  const headers    = data[0];
  const timeFields = ['timeFrom', 'timeTo'];
  const filterArea = getFilterArea(info);

  const rows = data.slice(1)
    .map((r, i) => {
      const obj = { _row: i + 2 };
      headers.forEach((h, j) => {
        if (!h) return;
        obj[h] = timeFields.includes(h) ? cellToTime(r[j]) : (r[j] || '');
      });
      return obj;
    })
    .filter(obj => !filterArea || obj.area === filterArea);

  return jsonOk(rows);
}

// ---------- Add: เพิ่ม record ใหม่ ----------
function handleAdd(sheet, params, info) {
  const data = JSON.parse(params.data || '{}');

  // user token (ไม่ใช่ภาพรวม) → ห้ามบันทึก area อื่น
  const filterArea = getFilterArea(info);
  if (filterArea && data.area !== filterArea) {
    return jsonOk({ status: 'error', msg: 'unauthorized: area mismatch' });
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
  sheet.appendRow([
    now,
    data.area       || '',
    data.name       || '',
    data.empId      || '',
    data.site       || '',
    data.dept       || '',
    data.div        || '',
    data.tel        || '',
    data.dateFrom   || '',
    data.dateTo     || '',
    data.timeFrom   || '',
    data.timeTo     || '',
    data.workDetail || '',
  ]);

  // force plain text ป้องกัน Sheets แปลงเบอร์โทร/เวลาเป็น decimal
  const newRow = sheet.getLastRow();
  sheet.getRange(newRow, COL.tel).setNumberFormat('@').setValue(data.tel || '');
  sheet.getRange(newRow, COL.timeFrom).setNumberFormat('@').setValue(data.timeFrom || '');
  sheet.getRange(newRow, COL.timeTo).setNumberFormat('@').setValue(data.timeTo || '');

  return jsonOk({ status: 'ok' });
}

// ---------- Update: แก้ไขแถวที่ระบุ ----------
function handleUpdate(sheet, params, info) {
  const row = parseInt(params.row);
  if (!row || row < 2) return jsonOk({ status: 'error', msg: 'invalid row' });

  // ตรวจสอบว่า user token มีสิทธิ์แก้ไขแถวนี้
  const filterArea = getFilterArea(info);
  if (filterArea) {
    const rowArea = sheet.getRange(row, COL.area).getValue();
    if (rowArea !== filterArea) {
      return jsonOk({ status: 'error', msg: 'unauthorized: area mismatch' });
    }
  }

  const data = JSON.parse(params.data || '{}');
  const updatableFields = [
    'area','name','empId','site','dept','div','tel',
    'dateFrom','dateTo','timeFrom','timeTo','workDetail'
  ];
  const textFields = ['tel', 'timeFrom', 'timeTo'];
  updatableFields.forEach(key => {
    if (data[key] !== undefined) {
      const cell = sheet.getRange(row, COL[key]);
      if (textFields.includes(key)) cell.setNumberFormat('@');
      cell.setValue(data[key]);
    }
  });
  return jsonOk({ status: 'ok' });
}

// ---------- Delete: ลบแถวที่ระบุ ----------
function handleDelete(sheet, params, info) {
  const row = parseInt(params.row);
  if (!row || row < 2) return jsonOk({ status: 'error', msg: 'invalid row' });

  // ตรวจสอบว่า user token มีสิทธิ์ลบแถวนี้
  const filterArea = getFilterArea(info);
  if (filterArea) {
    const rowArea = sheet.getRange(row, COL.area).getValue();
    if (rowArea !== filterArea) {
      return jsonOk({ status: 'error', msg: 'unauthorized: area mismatch' });
    }
  }

  sheet.deleteRow(row);
  return jsonOk({ status: 'ok' });
}

// ---------- Helper ----------
function jsonOk(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- ทดสอบ (รันใน Apps Script Editor) ----------
function testVerify() {
  Logger.log(doGet({ parameter: { action: 'verify', token: 'mea' } }).getContent());
  Logger.log(doGet({ parameter: { action: 'verify', token: '0414' } }).getContent());
  Logger.log(doGet({ parameter: { action: 'verify', token: 'wrong' } }).getContent());
}

function testRead() {
  Logger.log(doGet({ parameter: { token: 'mea' } }).getContent());
}

function testReadArea() {
  // user token 0414 ควรเห็นเฉพาะ area=บางแค
  Logger.log(doGet({ parameter: { token: '0414' } }).getContent());
}

function testAdd() {
  const mock = {
    parameter: {
      action: 'add',
      token: 'mea',
      data: JSON.stringify({
        area: 'บางแค', name: 'ทดสอบ ระบบ', empId: '9999999',
        site: 'สถานีย่อยบางแค', dept: 'ฝทดสอบ', div: 'กทดสอบ',
        tel: '099-999-9999', dateFrom: '2026-04-22', dateTo: '2026-04-22',
        timeFrom: '08:00', timeTo: '17:00', workDetail: 'ทดสอบระบบ'
      })
    }
  };
  Logger.log(doPost(mock).getContent());
}

// ============================================================
//  ขั้นตอนติดตั้ง / อัปเดต
// ============================================================
//
//  === กรณีติดตั้งใหม่ ===
//  1. เปิด Google Sheet → Extensions > Apps Script
//  2. วาง code นี้ทั้งหมด > Save (Ctrl+S)
//  3. รัน testVerify() เพื่อ authorize และตรวจสอบ
//  4. Deploy > New deployment
//     - Type: Web app
//     - Execute as: Me
//     - Who has access: Anyone
//  5. Copy URL ใส่ใน index.html และ page2.html (บรรทัด SCRIPT_URL)
//
//  === กรณีอัปเดต Script ที่ deploy ไปแล้ว ===
//  1. วาง code ใหม่ > Save
//  2. Deploy > Manage deployments > Edit (ดินสอ) > Version: New version > Deploy
//  3. *** ไม่ต้องเปลี่ยน URL ใน HTML ***
//
//  === Flow หลังอัปเดต ===
//  index.html  → fetch SCRIPT_URL?action=verify&token=xxx  (แทน SHA-256)
//  page2.html  → ส่ง token ทุก request (doGet และ doPost)
//
//  === เพิ่ม / แก้ Token ===
//  แก้ที่ TOKEN_CONFIG ด้านบนเท่านั้น → Deploy เวอร์ชันใหม่
//
// ============================================================
