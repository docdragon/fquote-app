/**
 * @file _utils-for-api.js
 * @description Tiện ích cho các API endpoint chạy trên môi trường Node.js.
 * KHÔNG SỬ DỤNG TRỰC TIẾP TRÊN CLIENT.
 */

const formatCurrency = (number, showSymbol = true) => {
    if (typeof number !== 'number' || isNaN(number)) return showSymbol ? '0 ₫' : '0';
    // Manual formatting to avoid Intl issues in serverless env
    const formatted = Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return showSymbol ? `${formatted} ₫` : formatted;
};

const formatDate = (dateInput) => {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        // Manual formatting to avoid Intl issues in serverless env
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
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

module.exports = {
    formatCurrency,
    formatDate,
    numberToRoman,
};
