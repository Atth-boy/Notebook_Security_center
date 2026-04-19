// ============================================================
//  Apps Script สำหรับ page2.html — บันทึกผู้เข้าสถานีไฟฟ้า
//  Sheet ID: ดูใน page2.html บรรทัด SHEET_ID
// ============================================================

const SHEET_NAME = 'บันทึก';

const HEADERS = [
  'timestamp', 'area', 'name', 'empId',
  'site', 'dept', 'div', 'tel',
  'dateFrom', 'dateTo', 'timeFrom', 'timeTo', 'workDetail'
];

// col index (1-based) ตาม HEADERS
const COL = {
  timestamp:1, area:2, name:3, empId:4,
  site:5, dept:6, div:7, tel:8,
  dateFrom:9, dateTo:10, timeFrom:11, timeTo:12, workDetail:13
};

// ---------- doGet: อ่านข้อมูลอย่างเดียว ----------
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);
    return handleRead(sheet);
  } catch(err) {
    return jsonOk({ status: 'error', msg: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ---------- doPost: เขียนข้อมูล (add / update / delete) ----------
function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || '';

  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);

    if (action === 'add')    return handleAdd(sheet, params);
    if (action === 'update') return handleUpdate(sheet, params);
    if (action === 'delete') return handleDelete(sheet, params);

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

  // เช็คว่า header มีครบไหม — ถ้าขาดให้เพิ่มอัตโนมัติ
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  HEADERS.forEach((h, i) => {
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

// ---------- Read: คืน records ทั้งหมด ----------
function handleRead(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonOk([]);
  const headers = data[0];
  const timeFields = ['timeFrom', 'timeTo'];
  const rows = data.slice(1).map((r, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, j) => {
      if (!h) return;
      obj[h] = timeFields.includes(h) ? cellToTime(r[j]) : (r[j] || '');
    });
    return obj;
  });
  return jsonOk(rows);
}

// ---------- Add: เพิ่ม record ใหม่ ----------
function handleAdd(sheet, params) {
  const data = JSON.parse(params.data || '{}');
  const now  = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
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
  // force tel/timeFrom/timeTo columns เป็น plain text เพื่อป้องกัน Sheets แปลงเป็น decimal
  const newRow = sheet.getLastRow();
  sheet.getRange(newRow, COL.tel).setNumberFormat('@');
  sheet.getRange(newRow, COL.tel).setValue(data.tel || '');
  sheet.getRange(newRow, COL.timeFrom).setNumberFormat('@');
  sheet.getRange(newRow, COL.timeTo).setNumberFormat('@');
  sheet.getRange(newRow, COL.timeFrom).setValue(data.timeFrom || '');
  sheet.getRange(newRow, COL.timeTo).setValue(data.timeTo || '');
  return jsonOk({ status: 'ok' });
}

// ---------- Update: แก้ไขแถวที่ระบุ ----------
function handleUpdate(sheet, params) {
  const row = parseInt(params.row);
  if (!row || row < 2) return jsonOk({ status: 'error', msg: 'invalid row' });
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
function handleDelete(sheet, params) {
  const row = parseInt(params.row);
  if (!row || row < 2) return jsonOk({ status: 'error', msg: 'invalid row' });
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
function testRead() {
  Logger.log(doGet({ parameter: {} }).getContent());
}

function testAdd() {
  const mock = {
    parameter: {
      action: 'add',
      data: JSON.stringify({
        area: 'บางแค', name: 'ทดสอบ ระบบ', empId: '9999999',
        site: 'สถานีย่อยบางแค', dept: 'ฝทดสอบ', div: 'กทดสอบ',
        tel: '099-999-9999', dateFrom: '2026-04-18', dateTo: '2026-04-18',
        timeFrom: '08:00', timeTo: '17:00', workDetail: 'ทดสอบระบบ\nบรรทัดที่สอง'
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
//  1. เปิด Google Sheet แล้วไปที่ Extensions > Apps Script
//  2. ลบ code เดิมออก แล้ววาง code นี้ทั้งหมด (ยกเว้น comment นี้)
//  3. Save (Ctrl+S)
//  4. รัน testAdd() เพื่อ authorize และทดสอบ
//  5. Deploy > New deployment
//     - Type: Web app
//     - Execute as: Me
//     - Who has access: Anyone
//  6. Copy URL แล้วใส่ใน page2.html บรรทัด:
//       let SCRIPT_URL = 'https://script.google.com/macros/s/xxx.../exec';
//
//  === กรณีอัปเดต Script ที่ deploy ไปแล้ว ===
//  1. วาง code ใหม่ > Save
//  2. Deploy > Manage deployments > Edit (ดินสอ) > Version: New version > Deploy
//  3. *** ไม่ต้องเปลี่ยน URL ใน page2.html ***
//
//  หมายเหตุ: doGet = อ่านข้อมูลเท่านั้น (ไม่ cache ปัญหา)
//            doPost = เขียนข้อมูล add/update/delete
//
//  === อัปเดต Google Sheet (เพิ่มคอลัมน์ใหม่) ===
//  Script จะเพิ่ม header คอลัมน์ให้อัตโนมัติเมื่อรันครั้งแรก
//  หรือเพิ่มเองที่ sheet "บันทึก" คอลัมน์ K=timeFrom, L=timeTo, M=workDetail
//
// ============================================================
