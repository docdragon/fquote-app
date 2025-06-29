
/**
 * @file utils.js
 * @description Chứa các hàm tiện ích chung cho ứng dụng.
 */

/**
 * Định dạng một số thành chuỗi tiền tệ VNĐ.
 * @param {number} number - Số cần định dạng.
 * @returns {string} - Chuỗi đã định dạng (ví dụ: "1.234.567 VNĐ").
 */
export function formatCurrency(number) {
    if (typeof number !== 'number' || isNaN(number)) return '0 VNĐ';
    return number.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

/**
 * Định dạng ngày tháng.
 * @param {string | number | Date} dateInput - Dữ liệu ngày đầu vào.
 * @returns {string} - Chuỗi ngày đã định dạng (ví dụ: "10/06/2025").
 */
export function formatDate(dateInput) {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return ''; // Kiểm tra ngày không hợp lệ
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return '';
    }
}

/**
 * Tạo một ID duy nhất với tiền tố.
 * @param {string} prefix - Tiền tố cho ID.
 * @returns {string} - ID duy nhất.
 */
export function generateUniqueId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Tạo ID báo giá chuyên nghiệp (cũ, có thể dùng làm fallback).
 * @returns {string} - ID báo giá (ví dụ: "BG-20250610-A1B2").
 */
export function generateProfessionalQuoteId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BG-${year}${month}${day}-${randomPart}`;
}


/**
 * Tạo ID báo giá theo yêu cầu.
 * @param {string} customerName - Tên khách hàng.
 * @param {string} quoteDateString - Ngày báo giá (YYYY-MM-DD).
 * @param {boolean} forPdf - Nếu true, bỏ phần random suffix.
 * @returns {string} ID báo giá.
 */
export function generateSimpleQuoteId(customerName, quoteDateString, forPdf = false) {
    let datePart = "DDMMYY";
    if (quoteDateString) {
        const parts = String(quoteDateString).split('-'); // YYYY-MM-DD
        if (parts.length === 3) {
            datePart = `${parts[2]}${parts[1]}${parts[0].substring(2)}`;
        }
    } else { 
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).substring(2);
        datePart = `${day}${month}${year}`;
    }

    let nameInitials = 'X'; // Default if no customer name
    if (customerName) {
        const nameParts = customerName.trim().split(/\s+/);
        if (nameParts.length > 0 && nameParts[0]) {
            nameInitials = nameParts.map(part => part.charAt(0).toUpperCase()).join('');
        }
    }
    
    if (forPdf) {
        return `${nameInitials}-${datePart}`;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${nameInitials}-${datePart}-${randomSuffix}`;
}


/**
 * Chuyển số sang chữ số La Mã.
 * @param {number} num - Số cần chuyển đổi.
 * @returns {string} - Chữ số La Mã.
 */
export function numberToRoman(num) {
    if (typeof num !== 'number' || isNaN(num) || num <= 0) return '';
    const roman = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
}

/**
 * Hiển thị số ngày còn lại của tài khoản.
 * @param {Date} validUntilDate - Ngày hết hạn.
 * @returns {string} - Chuỗi mô tả trạng thái (ví dụ: "Còn lại 5 ngày").
 */
export function formatRemainingDays(validUntilDate) {
    if (!validUntilDate) return 'Không xác định';
    const now = new Date();
    const expiry = new Date(validUntilDate);
    
    now.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return 'Đã hết hạn';
    } else if (diffDays === 0) {
        return 'Hết hạn hôm nay';
    } else {
        return `Còn lại ${diffDays} ngày`;
    }
}
