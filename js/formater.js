/**
 * Formater.js - Engine Pemformat Kode Produksi & Expired Date
 * Liquid 3 (Lokal & Ekspor)
 * Mengacu pada struktur standar format.json (metadata, kamus_kode, items).
 */
(function (global) {
  'use strict';

  const MONTH_NAMES_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  /**
   * Helper penambahan bulan akurat untuk perhitungan expired date
   */
  function addMonths(date, months) {
    const d = new Date(date.getTime());
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d;
  }

  /**
   * Sub-modul Logika Khusus Format Lokal
   */
  const Lokal = {
    getShiftLetter(shift) {
      const s = parseInt(shift, 10);
      if (s === 1) return 'D';
      if (s === 2) return 'E';
      return '_';
    },

    getMachineCode(machine, fallback = '05') {
      if (!machine) return fallback;
      const str = String(machine.code || machine.name || machine.id || machine.workstation || '').trim();
      // Tangkap nomor mesin utama sebelum tanda strip (-) atau spasi, contoh: "AST 03-16L" -> "03", "AST 33-16L" -> "33", "APK 26" -> "26"
      const match = str.match(/^[A-Za-z\s]*(\d+)/);
      if (match && match[1]) {
        return match[1].padStart(2, '0').slice(-2);
      }
      const digits = str.replace(/\D/g, '');
      if (digits) {
        return digits.padStart(2, '0').slice(-2);
      }
      return fallback;
    },

    getLineCode(machine, fallback = '1B') {
      if (!machine) return fallback;
      let rawCode = '';
      if (machine.workstation) rawCode = String(machine.workstation).trim();
      else if (machine.line_code) rawCode = String(machine.line_code).trim();
      else {
        const mName = String(machine.name || machine.id || '').toUpperCase();
        const mLine = String(machine.line || '').toUpperCase();

        if (mLine.includes('LINE C') || mName.startsWith('APK 2') || mName.startsWith('APK 3')) return '';
        if (mLine.includes('LINE A')) rawCode = '0A';
        else if (mLine.includes('LINE B')) rawCode = '0B';
        else rawCode = fallback;
      }

      // Format terbalik untuk workstation mesin (contoh: 1A -> A1, 0A -> A0, 2B -> B2, 1C -> C1)
      const match = rawCode.match(/^(\d+)([A-Za-z]+)$/);
      if (match) {
        return `${match[2]}${match[1]}`;
      }
      return rawCode;
    },

    isManualCutoff(timeStr) {
      if (!timeStr) return false;
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10);
      return h >= 0 && h < 6;
    }
  };

  /**
   * Sub-modul Logika Khusus Format Ekspor
   */
  const Ekspor = {
    getNumericShift(shift) {
      const s = parseInt(shift, 10);
      return (s === 1 || s === 2 || s === 3) ? String(s) : '1';
    },

    getMonthName(monthIndex) {
      return MONTH_NAMES_EN[monthIndex] || 'JAN';
    }
  };

  /**
   * Engine Inti Formater
   */
  const Formater = {
    Lokal,
    Ekspor,

    /**
     * Hitung shift otomatis dari waktu dan hari
     */
    getShiftFromTime(dateObj = new Date(), timeStr = null) {
      const d = dateObj instanceof Date ? dateObj : new Date();
      let hours = d.getHours();
      let minutes = d.getMinutes();

      if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
        const parts = timeStr.split(':');
        hours = parseInt(parts[0], 10) || 0;
        minutes = parseInt(parts[1], 10) || 0;
      }

      const curMinutes = hours * 60 + minutes;
      const dayOfWeek = d.getDay(); // 0: Minggu, 5: Jumat

      if (dayOfWeek === 5) {
        if (curMinutes >= 6 * 60 && curMinutes < 14 * 60 + 30) return 1;
        if (curMinutes >= 14 * 60 + 30 && curMinutes < 22 * 60) return 2;
        return 3;
      }

      if (curMinutes >= 6 * 60 && curMinutes < 14 * 60) return 1;
      if (curMinutes >= 14 * 60 && curMinutes < 22 * 60) return 2;
      return 3;
    },

    /**
     * Cari definisi item format berdasarkan ID, MID, atau format alias
     */
    findFormatItem(formatsData, identifier) {
      if (!formatsData || !identifier) return null;
      const key = String(identifier).trim().toLowerCase();

      // Jika formatData dalam format array items
      const list = Array.isArray(formatsData)
        ? formatsData
        : (Array.isArray(formatsData.items)
          ? formatsData.items
          : Object.values(formatsData));

      // 1. Cari exact match id / format
      let match = list.find(item => item && (
        String(item.id || '').toLowerCase() === key ||
        String(item.format || '').toLowerCase() === key
      ));
      if (match) return match;

      // 2. Cari berdasarkan MID
      match = list.find(item => item && Array.isArray(item.mid) && item.mid.includes(identifier));
      if (match) return match;

      return null;
    },

    /**
     * Format template kode printing
     */
    formatCode(template, options = {}) {
      if (!template || typeof template !== 'string') return '-';

      const date = options.date instanceof Date ? options.date : new Date();
      const shift = parseInt(options.shift, 10) || 1;
      const machine = options.machine || null;
      const isSekunder = !!options.isSekunder;
      const isManual = !!options.isManual;
      const formatKey = String(options.formatKey || '').toLowerCase();

      // Format Waktu Realtime / Input
      let timeStr = options.customTime || '';
      if (!timeStr) {
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        timeStr = `${hh}:${mm}`;
      }

      // Cut-off 06:00 untuk manual sekunder
      let effectiveDate = date;
      if (isSekunder && isManual) {
        if (Lokal.isManualCutoff(timeStr)) {
          effectiveDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
        }
      }

      // Komponen Tanggal Produksi
      const DD = String(effectiveDate.getDate()).padStart(2, '0');
      const MM = String(effectiveDate.getMonth() + 1).padStart(2, '0');
      const YY = String(effectiveDate.getFullYear()).slice(-2);
      const YYYY = String(effectiveDate.getFullYear());
      const MMM = Ekspor.getMonthName(effectiveDate.getMonth());

      // Expired 2 Tahun (24 Bulan)
      const exp2Date = addMonths(effectiveDate, 24);
      const EXP2_DD = String(exp2Date.getDate()).padStart(2, '0');
      const EXP2_MM = String(exp2Date.getMonth() + 1).padStart(2, '0');
      const EXP2_YY = String(exp2Date.getFullYear()).slice(-2);
      const EXP2_YYYY = String(exp2Date.getFullYear());
      const EXP2_MMM = Ekspor.getMonthName(exp2Date.getMonth());

      // Expired 2.5 Tahun (30 Bulan)
      const exp25Date = addMonths(effectiveDate, 30);
      const EXP25_DD = String(exp25Date.getDate()).padStart(2, '0');
      const EXP25_MM = String(exp25Date.getMonth() + 1).padStart(2, '0');
      const EXP25_YY = String(exp25Date.getFullYear()).slice(-2);
      const EXP25_YYYY = String(exp25Date.getFullYear());
      const EXP25_MMM = Ekspor.getMonthName(exp25Date.getMonth());

      // Shift
      const txtShift = Lokal.getShiftLetter(shift);
      const numShift = Ekspor.getNumericShift(shift);

      // Kode Mesin 2 Digit (contoh: AST 03-16L -> "03", AST 33-16L -> "33", APK 26 -> "26")
      const mcCode = Lokal.getMachineCode(machine, '05');

      // Deteksi Line Mesin
      const mLine = machine ? String(machine.line || '').toUpperCase() : '';
      const mName = machine ? String(machine.name || '').toUpperCase() : '';
      const isLineC = mLine.includes('LINE C') || mName.startsWith('APK 2') || mName.startsWith('APK 3');

      // Token Line untuk Kardus
      let lineCode = '';
      if (!isLineC) {
        lineCode = Lokal.getLineCode(machine, mLine.includes('LINE B') ? 'B4' : 'B1');
      }

      // Waktu opsional untuk Pouch
      const timePouch = isLineC ? (timeStr ? `\n${timeStr}` : '') : '';

      // Tentukan apakah format merupakan ekspor 2.5 tahun atau 2 tahun
      const isEkspor25 = template.includes('EXP25') ||
        formatKey.startsWith('x') ||
        formatKey.includes('wld') ||
        formatKey.includes('ssl') ||
        template.includes('PROD DDMMMYYYY') ||
        template.includes('EXP ddmmmyyyy');

      const expDD = isEkspor25 ? EXP25_DD : EXP2_DD;
      const expMM = isEkspor25 ? EXP25_MM : EXP2_MM;
      const expYY = isEkspor25 ? EXP25_YY : EXP2_YY;
      const expYYYY = isEkspor25 ? EXP25_YYYY : EXP2_YYYY;
      const expMMM = isEkspor25 ? EXP25_MMM : EXP2_MMM;

      // Kamus Token Lengkap
      const tokenReplacements = {
        // Tag terformat eksplisit
        '{DDMMYY}': `${DD}${MM}${YY}`,
        '{DDMMYYYY}': `${DD}${MM}${YYYY}`,
        '{DDMMMYYYY}': `${DD}${MMM}${YYYY}`,
        '{DDMMMYY}': `${DD}${MMM}${YY}`,
        '{YYYY}': YYYY,
        '{YY}': YY,
        '{MM}': MM,
        '{DD}': DD,
        '{MMM}': MMM,

        '{EXP2_DDMMYY}': `${EXP2_DD}${EXP2_MM}${EXP2_YY}`,
        '{EXP2_DDMMYYYY}': `${EXP2_DD}${EXP2_MM}${EXP2_YYYY}`,
        '{EXP2_DDMMMYYYY}': `${EXP2_DD}${EXP2_MMM}${EXP2_YYYY}`,
        '{EXP2_DDMMMYY}': `${EXP2_DD}${EXP2_MMM}${EXP2_YY}`,

        '{EXP25_DDMMYY}': `${EXP25_DD}${EXP25_MM}${EXP25_YY}`,
        '{EXP25_DDMMYYYY}': `${EXP25_DD}${EXP25_MM}${EXP25_YYYY}`,
        '{EXP25_DDMMMYYYY}': `${EXP25_DD}${EXP25_MMM}${EXP25_YYYY}`,
        '{EXP25_DDMMMYY}': `${EXP25_DD}${EXP25_MMM}${EXP25_YY}`,

        '{TXT_SHIFT}': txtShift,
        '{NUM_SHIFT}': numShift,
        '{MC}': mcCode,
        '{LINE}': lineCode,
        '{TIME}': timeStr,
        '{TIMEPOUCH}': timePouch,

        // Format teks natural dari kamus_kode (urutkan dari yang paling spesifik / panjang)
        'DDMMMYYYY': `${DD}${MMM}${YYYY}`,
        'ddmmmyyyy': `${expDD}${expMMM}${expYYYY}`,
        'DDMMYYYY': `${DD}${MM}${YYYY}`,
        'ddmmyyyy': `${expDD}${expMM}${expYYYY}`,
        'DDMMMYY': `${DD}${MMM}${YY}`,
        'ddmmmyy': `${expDD}${expMMM}${expYY}`,
        'DDMMYY': `${DD}${MM}${YY}`,
        'ddmmyy': `${expDD}${expMM}${expYY}`,
        '(No Mesin)': mcCode,
        'No Mesin': mcCode,
        'M2': `${mcCode}2`,
        'MS2': `${mcCode}${txtShift}2`,
        '[TIME]': timePouch,
        '[L]': lineCode ? ` ${lineCode}` : '',
        ' L': lineCode ? ` ${lineCode}` : '',
        'TIME': timeStr,
        'Time': timeStr,
        'Shift': numShift,
        'SHIFT2': `${txtShift}2`,
        '(Shift)': `0${numShift}`,
        ' S': isManual ? ` ${numShift}` : ` ${txtShift}`,
        'BATCH': `BATCH ${numShift}`
      };

      let result = template;

      // Substitusi token terlebih dahulu
      for (const [key, val] of Object.entries(tokenReplacements)) {
        result = result.split(key).join(val);
      }

      // Khusus Mozambique (Prod DD MM YY Exp dd mm yy)
      if (template.toLowerCase().includes('prod dd mm yy')) {
        result = result
          .replace(/DD/g, DD)
          .replace(/MM/g, MM)
          .replace(/YY/g, YY)
          .replace(/dd/g, expDD)
          .replace(/mm/g, expMM)
          .replace(/yy/g, expYY);
      }

      // Ganti separator multi-baris jika masih ada tanda pipa '|'
      result = result.replace(/\s*\|\s*/g, '\n');

      // Pembersihan baris dan spasi berlebih
      result = result
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0)
        .join('\n');

      return result;
    }
  };

  // Ekspor ke lingkungan browser (window/self) maupun Node.js (global)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formater;
  }
  if (typeof window !== 'undefined') {
    window.Formater = Formater;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.Formater = Formater;
  } else if (typeof global !== 'undefined') {
    global.Formater = Formater;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
