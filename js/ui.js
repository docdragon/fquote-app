


/**
 * @file ui.js
 * @description Chứa các logic liên quan đến giao diện người dùng (UI) chung.
 * CẬP NHẬT: Tái cấu trúc logic tạo PDF để gọi API server-side,
 * loại bỏ thư viện jsPDF phía client, giúp code gọn gàng, chuyên nghiệp hơn.
 */
import * as DOM from './dom.js';
import { db } from './firebase.js';
import { showNotification } from './notifications.js';

// --- UTILITY FUNCTIONS ---
export function showLoader() {
    if (DOM.loader) DOM.loader.style.display = 'flex';
}

export function hideLoader() {
    if (DOM.loader) DOM.loader.style.display = 'none';
}

export function openTab(tabName) {
    if (!tabName) {
        console.error("openTab: Tên tab không được cung cấp.");
        return;
    }
    DOM.tabContents.forEach(content => {
        if (content) content.classList.remove('active');
    });
    DOM.tabButtons.forEach(button => {
        if (button) button.classList.remove('active');
    });
    const activeTabContent = document.getElementById(tabName);
    if (activeTabContent) {
        activeTabContent.classList.add('active');
    }
    const activeButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// ===================================================================================
// ========================== DARK MODE LOGIC ========================================
// ===================================================================================

export async function saveThemePreference(userId, isDark) {
    if (!userId) return;
    try {
        const profileRef = db.collection('users').doc(userId).collection('settings').doc('profile');
        await profileRef.set({ darkModeEnabled: isDark }, { merge: true });
    } catch (error) {
        console.error("Could not save theme preference:", error);
    }
}

export function applyDarkMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    if (DOM.globalDarkModeToggleButton) {
        DOM.globalDarkModeToggleButton.textContent = isDark ? '☀️' : '🌙';
        DOM.globalDarkModeToggleButton.title = isDark ? 'Chuyển chế độ sáng' : 'Chuyển chế độ tối';
    }
}

export async function loadAndApplyTheme(userId) {
    if (!userId) {
        applyDarkMode(false); // Default to light mode if no user
        return;
    }
    try {
        const profileRef = db.collection('users').doc(userId).collection('settings').doc('profile');
        const docSnap = await profileRef.get();
        if (docSnap.exists) {
            const settings = docSnap.data();
            applyDarkMode(settings.darkModeEnabled === true);
        } else {
            applyDarkMode(false); // Default for new or non-existent profile
        }
    } catch (error) {
        console.error("Could not load theme preference:", error);
        applyDarkMode(false); // Default on error
    }
}

export function toggleDarkMode(userId) {
    const isDarkMode = !document.body.classList.contains('dark-mode');
    applyDarkMode(isDarkMode);
    if (userId) {
        saveThemePreference(userId, isDarkMode);
    }
}

// ===================================================================================
// ========================== GENERIC ACTION MENU LOGIC ==============================
// ===================================================================================
const ICONS = {
    edit: `<svg class="menu-item-icon-svg" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>`,
    delete: `<svg class="menu-item-icon-svg" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`,
    load: `<svg class="menu-item-icon-svg" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1.5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708-.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>`,
    duplicate: `<svg class="menu-item-icon-svg" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5-.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM8 7a.5.5 0 0 1 .5.5V9H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V10H6a.5.5 0 0 1 0-1h1.5V7.5A.5.5 0 0 1 8 7z"/></svg>`,
    save: `<svg class="menu-item-icon-svg" viewBox="0 0 16 16"><path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1H2zM6.5 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3a.5.5 0 0 1 .5-.5z"/></svg>`,
};

export function showGenericActionsMenu(actions, triggerElement, context, callback) {
    document.querySelectorAll('.actions-menu').forEach(menu => menu.remove());

    const menu = document.createElement('div');
    menu.className = 'actions-menu';

    actions.forEach(action => {
        const item = document.createElement('button');
        item.className = 'actions-menu-item';
        if (action.class) item.classList.add(action.class);
        item.innerHTML = `${ICONS[action.icon] || ''}<span>${action.label}</span>`;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            callback(action.actionKey, context);
            closeMenu();
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    const rect = triggerElement.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    
    let top = rect.bottom + window.scrollY;
    let left = rect.left + window.scrollX;

    if (left + menuRect.width > window.innerWidth) {
        left = rect.right + window.scrollX - menuRect.width;
    }
    if (top + menuRect.height > window.innerHeight) {
        top = rect.top + window.scrollY - menuRect.height;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.opacity = '1';

    function closeMenu() {
        menu.remove();
        document.removeEventListener('mousedown', handleOutsideClick);
    }
    
    function handleOutsideClick(event) {
        if (!menu.contains(event.target)) {
            closeMenu();
        }
    }
    
    setTimeout(() => document.addEventListener('mousedown', handleOutsideClick), 0);
}

// ===================================================================================
// ========================== PDF GENERATION VIA API (NEW) ===========================
// ===================================================================================

/**
 * Core function to generate PDF by calling the server-side API.
 * @param {object} options - Configuration for output: { output: 'preview' | 'save' }.
 * @param {object} quoteData - The complete data object for the quote.
 */
async function generatePdfViaApi(options, quoteData) {
    showLoader();
    try {
        if (!quoteData || !quoteData.items || quoteData.items.length === 0) {
            showNotification('Không có hạng mục nào trong báo giá để tạo PDF.', 'info');
            return;
        }

        const response = await fetch('/api/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quoteData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText, error: '' }));
            console.error('PDF Generation API Error:', errorData);
            // Prioritize the more specific 'error' field from the robust server response, fallback to 'message'.
            const detailedErrorMessage = errorData.error || errorData.message || 'Không thể tạo PDF.';
            throw new Error(`Lỗi từ server: ${detailedErrorMessage}`);
        }

        const pdfBlob = await response.blob();
        const url = URL.createObjectURL(pdfBlob);
        
        if (options.output === 'save') {
             const fileName = `BaoGia_${quoteData.quoteId}_${quoteData.customerInfo.name.replace(/\s/g, '_')}.pdf`;
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoke after a short delay to ensure download starts
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } else { // 'preview'
            window.open(url, '_blank');
        }
    } catch (error) {
        console.error("Lỗi khi tạo PDF qua API:", error);
        showNotification(`Đã xảy ra lỗi khi tạo file PDF: ${error.message}`, 'error');
    } finally {
        hideLoader();
    }
}

/**
 * Triggers PDF generation for downloading.
 * @param {object} quoteData The data to be sent to the API.
 */
export async function exportToPdf(quoteData) {
    await generatePdfViaApi({ output: 'save' }, quoteData);
}

/**
 * Triggers PDF generation for previewing in a new tab.
 * @param {object} quoteData The data to be sent to the API.
 */
export async function previewPdf(quoteData) {
    await generatePdfViaApi({ output: 'preview' }, quoteData);
}

/**
 * Cập nhật thông tin người dùng trong mục admin.
 * @param {object} profileData Dữ liệu hồ sơ người dùng.
 * @param {string} userId ID của người dùng.
 * @param {HTMLElement} containerDiv Element để hiển thị thông tin.
 */
export function renderUserProfile(profileData, userId, containerDiv) {
    const validUntilDate = profileData.validUntil ? profileData.validUntil.toDate() : null;
    let statusClass = 'status-ok';
    let statusText = `Hoạt động (${profileData.status || 'N/A'})`;

    if (!validUntilDate || new Date() > validUntilDate) {
        statusClass = 'status-expired';
        statusText = `Hết hạn (${validUntilDate ? new Intl.DateTimeFormat('vi-VN').format(validUntilDate) : 'N/A'})`;
    } else if (['suspended', 'disabled'].includes(profileData.status)) {
        statusClass = 'status-expired';
        statusText = `Bị khóa (${profileData.status})`;
    }
    containerDiv.innerHTML = `
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Email:</strong> ${profileData.email}</p>
        <p><strong>Ngày tạo:</strong> ${profileData.accountCreatedAt ? new Intl.DateTimeFormat('vi-VN').format(profileData.accountCreatedAt.toDate()) : 'N/A'}</p>
        <p><strong>Hạn sử dụng:</strong> <span class="${statusClass}">${validUntilDate ? new Intl.DateTimeFormat('vi-VN').format(validUntilDate) : 'N/A'}</span></p>
        <p><strong>Trạng thái:</strong> <span class="${statusClass}">${statusText}</span></p>
    `;
}
