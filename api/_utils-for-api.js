/**
 * @file _utils-for-api.js
 * @description Tiện ích cho các API endpoint chạy trên môi trường Node.js.
 * KHÔNG SỬ DỤNG TRỰC TIẾP TRÊN CLIENT.
 */

const formatCurrency = (number, showSymbol = true) => {
    if (typeof number !== 'number' || isNaN(number)) return showSymbol ? '0 ₫' : '0';
    try {
        // This may fail in Node.js environments without full ICU data
        const formatted = new Intl.NumberFormat('vi-VN').format(Math.round(number));
        return showSymbol ? `${formatted} ₫` : formatted;
    } catch (e) {
        console.warn("Intl.NumberFormat for 'vi-VN' failed, using fallback. Error:", e.message);
        // Fallback to basic formatting
        const formatted = Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return showSymbol ? `${formatted} ₫` : formatted;
    }
};

const formatDate = (dateInput) => {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        // This may fail in Node.js environments without full ICU data
        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
    } catch (e) {
        console.warn("Intl.DateTimeFormat for 'vi-VN' failed, using fallback. Error:", e.message);
        // Fallback to basic formatting
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return '';
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return '';
        }
    }
};

const numberToRoman = (num) => {
    if (typeof num !== 'number' || isNaN(num) || num <= 0) return '';
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
};

const formatNumber = (number, options = {}) => {
    if (typeof number !== 'number' || isNaN(number)) return '0';
    try {
        // This may fail in Node.js environments without full ICU data
        return number.toLocaleString('vi-VN', options);
    } catch (e) {
        console.warn(`toLocaleString for 'vi-VN' with options failed, using fallback. Error: ${e.message}`);
        // Fallback that mimics vi-VN format (e.g., 1.234,56)
        const numStr = String(number);
        const parts = numStr.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // dot for thousands
        return parts.join(','); // comma for decimal
    }
};

module.exports = {
    formatCurrency,
    formatDate,
    numberToRoman,
    formatNumber,
};
