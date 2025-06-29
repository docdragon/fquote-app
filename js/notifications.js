
/**
 * @file notifications.js
 * @description Quản lý việc hiển thị thông báo toast.
 */

const notificationContainer = document.getElementById('notification-container');

/**
 * Hiển thị một thông báo toast.
 * @param {string} message - Nội dung thông báo.
 * @param {'info' | 'success' | 'error'} type - Loại thông báo.
 * @param {number} duration - Thời gian hiển thị (ms).
 */
export function showNotification(message, type = 'info', duration = 4000) {
    if (!notificationContainer) return;

    // Tạo phần tử toast
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    // Thêm vào container
    notificationContainer.appendChild(toast);

    // Tự động xóa sau một khoảng thời gian
    setTimeout(() => {
        toast.remove();
    }, duration + 500); // Thêm 500ms cho animation
}
