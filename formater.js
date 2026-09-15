/**
 * formater.js - Konversi format otomatis dari format.json ke hasil cetak emboss/inkjet (realtime)
 */

const MONTHS_MMM = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function pad2(num) {
  return String(num).padStart(2, '0');
}

/**
 * Mendapatkan shift otomatis berdasarkan waktu dan hari
 * Senin-Jum'at:
 *   SHIFT 1 : 06:00 - 14:00
 *   SHIFT 2 : 14:00 - 22:00
 *   SHIFT 3 : 22:00 - 06:00
 * Sabtu:
 *   SHIFT 1 : 06:00 - 11:00
 *   SHIFT 2 : 11:00 - 16:00
 *   SHIFT 3 : 16:00 - 21:00
 */
function getShiftFromTime(dateObj, timeStr) {
  const d = dateObj || new Date();
  const dayOfWeek = d.getDay(); // 0 = Minggu, 6 = Sabtu
  const isSaturday = dayOfWeek === 6;

  let hours = d.getHours();
  let minutes = d.getMinutes();
  if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h)) hours = h;
    if (!isNaN(m)) minutes = m;
  }

  const timeMinutes = hours * 60 + minutes;

  if (isSaturday) {
    if (timeMinutes >= 360 && timeMinutes < 660) return 1; // 06:00 - 11:00
    if (timeMinutes >= 660 && timeMinutes < 960) return 2; // 11:00 - 16:00
    return 3; // 16:00 - 21:00 (dan shift malam)
  } else {
    if (timeMinutes >= 360 && timeMinutes < 840) return 1; // 06:00 - 14:00
    if (timeMinutes >= 840 && timeMinutes < 1320) return 2; // 14:00 - 22:00
    return 3; // 22:00 - 06:00
  }
}

/**
 * Menghitung tanggal berdasarkan offset tahun/bulan dan opsi ACT (+1 hari jika jam 00:00 - 05:59)
 */
function getDateObj(baseDate, yearsOffset = 0, monthsOffset = 0, isAct = false, timeStr = null) {
  const d = new Date(baseDate.getTime());
  
  if (isAct) {
    let hours = d.getHours();
    if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
      const parsedHours = parseInt(timeStr.split(':')[0], 10);
      if (!isNaN(parsedHours)) {
        hours = parsedHours;
      }
    }
    // Jam 00:00 - 05:59 (JAM 00 +1)
    if (hours >= 0 && hours < 6) {
      d.setDate(d.getDate() + 1);
    }
  }

  if (yearsOffset !== 0) {
    d.setFullYear(d.getFullYear() + yearsOffset);
  }

  if (monthsOffset !== 0) {
    d.setMonth(d.getMonth() + monthsOffset);
  }

  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const mmm = MONTHS_MMM[d.getMonth()];
  const yyyy = String(d.getFullYear());
  const yy = yyyy.slice(-2);

  return {
    DD: dd,
    MM: mm,
    MMM: mmm,
    YY: yy,
    YYYY: yyyy,
    DDMMYY: `${dd}${mm}${yy}`,
    DDMMMYY: `${dd}${mmm}${yy}`,
    DDMMYYYY: `${dd}${mm}${yyyy}`,
    DDMMMYYYY: `${dd}${mmm}${yyyy}`
  };
}

/**
 * Mendapatkan kode mesin ({MC}) dari objek mesin
 * - jika K1 atau X1 maka tampilkan seluruh nama mesinya contoh K1, X1
 * - jika AST maka tampilkan nomor mesinya saja contoh : AST 33-16L maka 33
 * - jika APK maka tampilkan nomor mesinya saja contoh : APK 31 maka 31
 */
function getMcCode(machine) {
  if (!machine) return 'MC';
  const name = (typeof machine === 'string' ? machine : (machine.name || machine.id || '')).trim();
  if (!name) return 'MC';

  const astMatch = name.match(/AST\s*(\d+)/i);
  if (astMatch) return astMatch[1];

  const apkMatch = name.match(/APK\s*(\d+)/i);
  if (apkMatch) return apkMatch[1];

  const shortCodeMatch = name.match(/^([A-Za-z]\d+)$/i);
  if (shortCodeMatch) return shortCodeMatch[1].toUpperCase();

  const numMatch = name.match(/\b\d+\b/);
  if (numMatch && !name.includes(' ')) return name;

  return name;
}

/**
 * Mendapatkan kode line ({LINE}) dari objek mesin
 * diambil dari workstation / line mesin yang dipilih (misal: 0A, 1A, 1C). Dibalik tampilannya (0A -> A0, 1C -> C1)
 */
function getLineCode(machine) {
  if (!machine) return 'LINE';
  const ws = (machine.workstation || '').trim();
  if (ws) {
    const match = ws.match(/^(\d+)([A-Za-z]+)$/);
    if (match) {
      return `${match[2]}${match[1]}`;
    }
    if (ws.length === 2) {
      return ws[1] + ws[0];
    }
    return ws;
  }
  if (machine.line) {
    return machine.line.replace('LINE ', '').trim();
  }
  return 'A0';
}

/**
 * Fungsi Utama Konversi Template Format Kode
 */
function formatCode(template, options = {}) {
  if (!template) return '';

  const now = options.date || new Date();
  const timeStr = options.customTime || `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  
  let shiftNum = options.shift;
  if (!shiftNum) {
    shiftNum = getShiftFromTime(now, timeStr);
  }
  shiftNum = parseInt(shiftNum, 10) || 1;

  // Cek apakah waktu saat ini berada di jam 00:00 - 05:59 (JAM 00 +1)
  let isActTime = false;
  let parsedHours = now.getHours();
  if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
    const ph = parseInt(timeStr.split(':')[0], 10);
    if (!isNaN(ph)) parsedHours = ph;
  }
  if (parsedHours >= 0 && parsedHours < 6) {
    isActTime = true;
  }

  // Jika opsi isSekunder aktif (atau template mengandung TIME) dan waktu aktual jam 00:00-05:59,
  // tanggal di sekunder otomatis mengikuti tanggal aktual (+1 hari)
  const useActForSecondary = options.isSekunder !== undefined ? options.isSekunder : (template.includes('TIME') || template.includes('{TIME}'));

  // SHIFT 1 : D, SHIFT 2 : E, SHIFT 3 : _
  const shiftTxtMap = { 1: 'D', 2: 'E', 3: '_' };
  const shiftTxt = shiftTxtMap[shiftNum] !== undefined ? shiftTxtMap[shiftNum] : 'D';

  const machine = options.machine || null;
  const numLot = options.numLot !== undefined && options.numLot !== '' ? String(options.numLot) : '1';

  // Logika Huruf Lot: 1=A, 2=B, 3=C, dst. Jika options.txtLot disediakan pakai itu, jika tidak hitung dari numLot
  let txtLot = 'A';
  if (options.txtLot !== undefined && options.txtLot !== '') {
    txtLot = String(options.txtLot).toUpperCase();
  } else {
    const n = parseInt(numLot, 10);
    if (!isNaN(n) && n >= 1) {
      // 1 -> A (65), 2 -> B (66), ...
      txtLot = String.fromCharCode(65 + ((n - 1) % 26));
    }
  }

  // 1. Tanggal Tetap & 2. Tanggal ACT (JAM 00 +1)
  const dFixed = getDateObj(now, 0, 0, false, timeStr);
  const dAct = getDateObj(now, 0, 0, true, timeStr);

  // 3. & 4. EXP 2 TAHUN
  const dExp2Fixed = getDateObj(now, 2, 0, false, timeStr);
  const dExp2Act = getDateObj(now, 2, 0, true, timeStr);

  // 5. & 6. EXP 1 TAHUN
  const dExp1Fixed = getDateObj(now, 1, 0, false, timeStr);
  const dExp1Act = getDateObj(now, 1, 0, true, timeStr);

  // 7. & 8. EXP 2.5 TAHUN (2 tahun 6 bulan = 30 bulan)
  const dExp25Fixed = getDateObj(now, 2, 6, false, timeStr);
  const dExp25Act = getDateObj(now, 2, 6, true, timeStr);

  // 10. & 11. LOT TANGGAL TETAP (Sesuai kesepakatan: tanggal produksi yang sama)
  const dLotFixed = dFixed;
  const dExp2LotFixed = dExp2Fixed;

  // Tanggal yang digunakan untuk token standar pada sekunder jika jam 00:00 - 05:59
  const effectiveDFixed = (useActForSecondary && isActTime) ? dAct : dFixed;
  const effectiveDExp2Fixed = (useActForSecondary && isActTime) ? dExp2Act : dExp2Fixed;
  const effectiveDExp1Fixed = (useActForSecondary && isActTime) ? dExp1Act : dExp1Fixed;
  const effectiveDExp25Fixed = (useActForSecondary && isActTime) ? dExp25Act : dExp25Fixed;
  const effectiveDLotFixed = (useActForSecondary && isActTime) ? dAct : dLotFixed;
  const effectiveDExp2LotFixed = (useActForSecondary && isActTime) ? dExp2Act : dExp2LotFixed;

  const mcCode = getMcCode(machine);
  const lineCode = getLineCode(machine);

  const replacements = {
    // 1. TANGGAL TETAP (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{DD}': effectiveDFixed.DD,
    '{MM}': effectiveDFixed.MM,
    '{MMM}': effectiveDFixed.MMM,
    '{YY}': effectiveDFixed.YY,
    '{YYYY}': effectiveDFixed.YYYY,
    '{DDMMYY}': effectiveDFixed.DDMMYY,
    '{DDMMMYY}': effectiveDFixed.DDMMMYY,
    '{DDMMYYYY}': effectiveDFixed.DDMMYYYY,
    '{DDMMMYYYY}': effectiveDFixed.DDMMMYYYY,

    // 2. TANGGAL MENGIKUTI JAM (JAM 00 +1)
    '{ACT_DD}': dAct.DD,
    '{ACT_MM}': dAct.MM,
    '{ACT_MMM}': dAct.MMM,
    '{ACT_YY}': dAct.YY,
    '{ACT_YYYY}': dAct.YYYY,
    '{ACT_DDMMYY}': dAct.DDMMYY,
    '{ACT_DDMMMYY}': dAct.DDMMMYY,
    '{ACT_DDMMYYYY}': dAct.DDMMYYYY,
    '{ACT_DDMMMYYYY}': dAct.DDMMMYYYY,

    // 3. EXP 2 TAHUN - TANGGAL TETAP (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{EXP2_DD}': effectiveDExp2Fixed.DD,
    '{EXP2_MM}': effectiveDExp2Fixed.MM,
    '{EXP2_MMM}': effectiveDExp2Fixed.MMM,
    '{EXP2_YY}': effectiveDExp2Fixed.YY,
    '{EXP2_YYYY}': effectiveDExp2Fixed.YYYY,
    '{EXP2_DDMMYY}': effectiveDExp2Fixed.DDMMYY,
    '{EXP2_DDMMMYY}': effectiveDExp2Fixed.DDMMMYY,
    '{EXP2_DDMMYYYY}': effectiveDExp2Fixed.DDMMYYYY,
    '{EXP2_DDMMMYYYY}': effectiveDExp2Fixed.DDMMMYYYY,

    // 4. EXP 2 TAHUN - TANGGAL MENGIKUTI JAM (JAM 00 +1)
    '{EXP2_ACT_DD}': dExp2Act.DD,
    '{EXP2_ACT_MM}': dExp2Act.MM,
    '{EXP2_ACT_MMM}': dExp2Act.MMM,
    '{EXP2_ACT_YY}': dExp2Act.YY,
    '{EXP2_ACT_YYYY}': dExp2Act.YYYY,
    '{EXP2_ACT_DDMMYY}': dExp2Act.DDMMYY,
    '{EXP2_ACT_DDMMMYY}': dExp2Act.DDMMMYY,
    '{EXP2_ACT_DDMMYYYY}': dExp2Act.DDMMYYYY,
    '{EXP2_ACT_DDMMMYYYY}': dExp2Act.DDMMMYYYY,

    // 5. EXP 1 TAHUN - TANGGAL TETAP (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{EXP1_DD}': effectiveDExp1Fixed.DD,
    '{EXP1_MM}': effectiveDExp1Fixed.MM,
    '{EXP1_MMM}': effectiveDExp1Fixed.MMM,
    '{EXP1_YY}': effectiveDExp1Fixed.YY,
    '{EXP1_YYYY}': effectiveDExp1Fixed.YYYY,
    '{EXP1_DDMMYY}': effectiveDExp1Fixed.DDMMYY,
    '{EXP1_DDMMMYY}': effectiveDExp1Fixed.DDMMMYY,
    '{EXP1_DDMMYYYY}': effectiveDExp1Fixed.DDMMYYYY,
    '{EXP1_DDMMMYYYY}': effectiveDExp1Fixed.DDMMMYYYY,

    // 6. EXP 1 TAHUN - TANGGAL MENGIKUTI JAM (JAM 00 +1)
    '{EXP1_ACT_DD}': dExp1Act.DD,
    '{EXP1_ACT_MM}': dExp1Act.MM,
    '{EXP1_ACT_MMM}': dExp1Act.MMM,
    '{EXP1_ACT_YY}': dExp1Act.YY,
    '{EXP1_ACT_YYYY}': dExp1Act.YYYY,
    '{EXP1_ACT_DDMMYY}': dExp1Act.DDMMYY,
    '{EXP1_ACT_DDMMMYY}': dExp1Act.DDMMMYY,
    '{EXP1_ACT_DDMMYYYY}': dExp1Act.DDMMYYYY,
    '{EXP1_ACT_DDMMMYYYY}': dExp1Act.DDMMMYY,

    // 7. EXP 2.5 TAHUN - TANGGAL TETAP (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{EXP25_DD}': effectiveDExp25Fixed.DD,
    '{EXP25_MM}': effectiveDExp25Fixed.MM,
    '{EXP25_MMM}': effectiveDExp25Fixed.MMM,
    '{EXP25_YY}': effectiveDExp25Fixed.YY,
    '{EXP25_YYYY}': effectiveDExp25Fixed.YYYY,
    '{EXP25_DDMMYY}': effectiveDExp25Fixed.DDMMYY,
    '{EXP25_DDMMMYY}': effectiveDExp25Fixed.DDMMMYY,
    '{EXP25_DDMMYYYY}': effectiveDExp25Fixed.DDMMYYYY,
    '{EXP25_DDMMMYYYY}': effectiveDExp25Fixed.DDMMMYYYY,

    // 8. EXP 2.5 TAHUN - TANGGAL MENGIKUTI JAM (JAM 00 +1)
    '{EXP25_ACT_DD}': dExp25Act.DD,
    '{EXP25_ACT_MM}': dExp25Act.MM,
    '{EXP25_ACT_MMM}': dExp25Act.MMM,
    '{EXP25_ACT_YY}': dExp25Act.YY,
    '{EXP25_ACT_YYYY}': dExp25Act.YYYY,
    '{EXP25_ACT_DDMMYY}': dExp25Act.DDMMYY,
    '{EXP25_ACT_DDMMMYY}': dExp25Act.DDMMMYY,
    '{EXP25_ACT_DDMMYYYY}': dExp25Act.DDMMYYYY,
    '{EXP25_ACT_DDMMMYYYY}': dExp25Act.DDMMMYYYY,

    // 9. SHIFT, MESIN, LINE, TIME
    '{NUM_SHIFT}': String(shiftNum),
    '{TXT_SHIFT}': shiftTxt,
    '{MC}': mcCode,
    '{LINE}': lineCode,
    '{TIMEPOUCH}': timeStr,
    '{TIME}': timeStr,

    // 10. LOT VARIABLES (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{LOT_DD}': effectiveDLotFixed.DD,
    '{LOT_MM}': effectiveDLotFixed.MM,
    '{LOT_MMM}': effectiveDLotFixed.MMM,
    '{LOT_YY}': effectiveDLotFixed.YY,
    '{LOT_YYYY}': effectiveDLotFixed.YYYY,
    '{LOT_DDMMYY}': effectiveDLotFixed.DDMMYY,
    '{LOT_DDMMMYY}': effectiveDLotFixed.DDMMMYY,
    '{LOT_DDMMYYYY}': effectiveDLotFixed.DDMMYYYY,
    '{LOT_DDMMMYYYY}': effectiveDLotFixed.DDMMMYYYY,

    // 11. EXP 2 TAHUN LOT (otomatis +1 pada sekunder jika jam 00:00 - 05:59)
    '{EXP2_LOT_DD}': effectiveDExp2LotFixed.DD,
    '{EXP2_LOT_MM}': effectiveDExp2LotFixed.MM,
    '{EXP2_LOT_MMM}': effectiveDExp2LotFixed.MMM,
    '{EXP2_LOT_YY}': effectiveDExp2LotFixed.YY,
    '{EXP2_LOT_YYYY}': effectiveDExp2LotFixed.YYYY,
    '{EXP2_LOT_DDMMYY}': effectiveDExp2LotFixed.DDMMYY,
    '{EXP2_LOT_DDMMMYY}': effectiveDExp2LotFixed.DDMMMYY,
    '{EXP2_LOT_DDMMYYYY}': effectiveDExp2LotFixed.DDMMYYYY,
    '{EXP2_LOT_DDMMMYYYY}': effectiveDExp2LotFixed.DDMMMYYYY,

    // 12. LOT NUM & TXT
    '{NUM_LOT}': numLot,
    '{TXT_LOT}': txtLot,
    '(TXT_LOT}': txtLot
  };

  let result = template;
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (result.includes(key)) {
      result = result.split(key).join(replacements[key]);
    }
  }

  // Ganti kata 'TIME' dengan waktu jam aktual jika ada
  // Contoh: 'ED 080728 TIME A0' -> 'ED 080728 12:00 A0'
  // atau 'TIME/BATCH 2/MADE IN INDONESIA' -> '14:30/BATCH 2/MADE IN INDONESIA'
  result = result.replace(/\bTIME\b/g, timeStr);

  return result;
}

if (typeof window !== 'undefined') {
  window.Formater = { formatCode, getDateObj, getShiftFromTime, getMcCode, getLineCode };
}
if (typeof globalThis !== 'undefined') {
  globalThis.Formater = { formatCode, getDateObj, getShiftFromTime, getMcCode, getLineCode };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatCode, getDateObj, getShiftFromTime, getMcCode, getLineCode };
}
