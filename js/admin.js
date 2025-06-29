

/**
 * @file admin.js
 * @description Chứa các hàm dành riêng cho quản trị viên.
 */
import { db } from './firebase.js';
import { formatDate } from './utils.js';
import * as DOM from './dom.js';
import * as UI from './ui.js';
import { showNotification } from './notifications.js';

const ADMIN_SETTINGS_COLLECTION = 'admin_settings';
const GLOBAL_SETTINGS_DOC = 'global';


/**
 * Lấy và hiển thị thông tin của một người dùng dựa trên Email hoặc User ID nhập vào.
 */
export async function fetchUserDetailsForAdmin() {
    const searchInput = DOM.adminSearchUserInput.value.trim(); 
    if (!searchInput) {
        showNotification("Vui lòng nhập Email hoặc User ID của người dùng cần tìm.", "info");
        return;
    }

    DOM.adminUserDetailsContainer.style.display = 'block';
    DOM.adminUserDetailsDiv.innerHTML = `<p>Đang tìm kiếm người dùng: ${searchInput}...</p>`;
    DOM.adminUpdateStatusP.textContent = '';
    UI.showLoader();

    let profileRef;
    let targetUserId;
    let profileData = null;

    try {
        if (searchInput.includes('@')) {
            const emailQuery = db.collectionGroup('settings').where('email', '==', searchInput).limit(1);
            const querySnapshot = await emailQuery.get();
            
            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                 if (userDoc.ref.path.startsWith('users/') && userDoc.ref.path.includes('/settings/profile')) {
                    targetUserId = userDoc.ref.parent.parent.id; 
                    profileRef = userDoc.ref;
                    profileData = userDoc.data();
                } else {
                    console.warn("Unexpected document path for email query:", userDoc.ref.path);
                }
            }
        } else {
            targetUserId = searchInput;
            profileRef = db.collection('users').doc(targetUserId).collection('settings').doc('profile');
            const doc = await profileRef.get();
            if (doc.exists) {
                 profileData = doc.data();
            }
        }
        
        if (profileData) {
            UI.renderUserProfile(profileData, targetUserId, DOM.adminUserDetailsDiv);
            DOM.adminTargetUserIdInput.value = targetUserId; 
            if(DOM.adminDaysToExtendInput) DOM.adminDaysToExtendInput.value = ''; 
            if(DOM.adminUserStatusSelect) DOM.adminUserStatusSelect.value = profileData.status || 'active_trial';
        } else {
            DOM.adminUserDetailsDiv.innerHTML = `<p style="color: red;">Không tìm thấy người dùng với thông tin đã cung cấp.</p>`;
            if(DOM.adminTargetUserIdInput) DOM.adminTargetUserIdInput.value = '';
        }

    } catch (error) {
        console.error("Error fetching user details:", error);
        let userMessage = 'Đã xảy ra lỗi khi tìm kiếm người dùng.';
        if (error.code === 'permission-denied') {
            userMessage = 'Lỗi: Bạn không có quyền thực hiện hành động này.';
        } else if (error.message && error.message.includes("requires an index")) {
            // Firestore specific error for collectionGroup queries needing an index
            userMessage = 'Lỗi: Thao tác này yêu cầu một chỉ mục (index) trong Firestore. Vui lòng tạo chỉ mục theo link trong Console (F12).';
            console.warn("Firestore index missing for collectionGroup query on 'settings' with 'email' field. Please create the index in your Firebase console.");
        }
        DOM.adminUserDetailsDiv.innerHTML = `<p style="color: red;">${userMessage}</p>`;
    } finally {
        UI.hideLoader();
    }
}


/**
 * Cập nhật ngày hết hạn cho một người dùng bằng cách thêm số ngày.
 */
export async function updateUserExpiryByAdmin() {
    const targetUserId = DOM.adminTargetUserIdInput.value;
    if (!targetUserId) {
        showNotification("Vui lòng tìm kiếm người dùng trước khi cập nhật.", 'info');
        return;
    }
    
    const daysToExtendInput = DOM.adminDaysToExtendInput;
    if (!daysToExtendInput || !daysToExtendInput.value) {
        showNotification("Vui lòng nhập số ngày muốn gia hạn.", 'info');
        return;
    }

    const daysToExtend = parseInt(daysToExtendInput.value);
    if (isNaN(daysToExtend) || daysToExtend <= 0) {
        showNotification("Vui lòng nhập một số ngày hợp lệ (lớn hơn 0) để gia hạn.", 'error');
        return;
    }

    const profileRef = db.collection('users').doc(targetUserId).collection('settings').doc('profile');
    
    UI.showLoader();
    try {
        const userProfileDoc = await profileRef.get();
        let currentExpiryDate;

        if (userProfileDoc.exists && userProfileDoc.data().validUntil) {
            currentExpiryDate = userProfileDoc.data().validUntil.toDate();
            if (currentExpiryDate < new Date()) {
                currentExpiryDate = new Date();
                currentExpiryDate.setHours(0,0,0,0); 
            }
        } else {
            currentExpiryDate = new Date(); 
            currentExpiryDate.setHours(0,0,0,0); 
        }

        const newExpiryDate = new Date(currentExpiryDate);
        newExpiryDate.setDate(currentExpiryDate.getDate() + daysToExtend);
        newExpiryDate.setHours(23, 59, 59, 999); 

        const newExpiryTimestamp = firebase.firestore.Timestamp.fromDate(newExpiryDate);
        
        await profileRef.update({ validUntil: newExpiryTimestamp, status: 'active_paid' }); // Also update status to active_paid on extension
        
        const successMessage = `Cập nhật thành công! Hạn mới: ${formatDate(newExpiryDate)}. Gia hạn thêm ${daysToExtend} ngày. Trạng thái: active_paid.`;
        DOM.adminUpdateStatusP.textContent = successMessage;
        showNotification('Cập nhật hạn sử dụng và trạng thái thành công!', 'success');
        
        const updatedDoc = await profileRef.get();
        if(updatedDoc.exists) {
            UI.renderUserProfile(updatedDoc.data(), targetUserId, DOM.adminUserDetailsDiv);
            if(DOM.adminUserStatusSelect) DOM.adminUserStatusSelect.value = updatedDoc.data().status || 'active_trial';
        }
        daysToExtendInput.value = ''; 

    } catch (error) {
        console.error("Error updating expiry date:", error);
        const message = error.code === 'permission-denied' 
            ? 'Cập nhật thất bại: Không có quyền.' 
            : 'Cập nhật thất bại. Vui lòng thử lại.';
        DOM.adminUpdateStatusP.textContent = message;
        showNotification(message, 'error');
    } finally {
        UI.hideLoader();
    }
}

/**
 * Tải cài đặt toàn cục của admin (ví dụ: số ngày dùng thử mặc định).
 */
export async function loadGlobalAdminSettings() {
    if (!DOM.adminDefaultTrialDaysInput) return;
    try {
        const docRef = db.collection(ADMIN_SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const settings = docSnap.data();
            DOM.adminDefaultTrialDaysInput.value = settings.defaultTrialDays || 7;
        } else {
            DOM.adminDefaultTrialDaysInput.value = 7; // Default if not set
            console.warn(`Admin global settings document (${ADMIN_SETTINGS_COLLECTION}/${GLOBAL_SETTINGS_DOC}) not found. Using default trial days (7).`);
        }
    } catch (error) {
        console.error("Lỗi tải cài đặt toàn cục:", error);
        DOM.adminDefaultTrialDaysInput.value = 7; // Default on error
        // Check if it's a permission error, which is common for admin-only data
        if (error.code === 'permission-denied' || error.message.toLowerCase().includes('permission')) {
             showNotification("Không thể tải cài đặt toàn cục: Không có quyền truy cập. Đây có thể là cài đặt chỉ dành cho Admin.", "warning");
        } else {
            showNotification("Không thể tải cài đặt toàn cục.", "error");
        }
    }
}

/**
 * Lưu cài đặt toàn cục của admin.
 */
export async function saveGlobalAdminSettings() {
    if (!DOM.adminDefaultTrialDaysInput || !DOM.adminGlobalSettingsStatusP) return;

    const trialDays = parseInt(DOM.adminDefaultTrialDaysInput.value);
    if (isNaN(trialDays) || trialDays <= 0) {
        showNotification("Số ngày dùng thử phải là một số dương.", "error");
        return;
    }

    UI.showLoader();
    DOM.adminGlobalSettingsStatusP.textContent = '';
    try {
        const docRef = db.collection(ADMIN_SETTINGS_COLLECTION).doc(GLOBAL_SETTINGS_DOC);
        await docRef.set({ defaultTrialDays: trialDays }, { merge: true });
        DOM.adminGlobalSettingsStatusP.textContent = "Đã lưu cài đặt toàn cục thành công!";
        DOM.adminGlobalSettingsStatusP.style.color = "var(--success-color)";
        showNotification("Đã lưu cài đặt toàn cục.", "success");
    } catch (error) {
        console.error("Lỗi lưu cài đặt toàn cục:", error);
        DOM.adminGlobalSettingsStatusP.textContent = "Lưu thất bại: " + error.message;
        DOM.adminGlobalSettingsStatusP.style.color = "var(--danger-color)";
        showNotification("Lưu cài đặt toàn cục thất bại.", "error");
    } finally {
        UI.hideLoader();
    }
}

/**
 * Tổng hợp và hiển thị thống kê người dùng.
 */
export async function fetchAndDisplayUserStatistics() {
    if (!DOM.statsTotalUsersSpan) return; // Check if elements exist

    UI.showLoader();
    DOM.statsTotalUsersSpan.textContent = 'Đang tải...';
    DOM.statsActiveUsersSpan.textContent = 'Đang tải...';
    DOM.statsExpiredLockedUsersSpan.textContent = 'Đang tải...';
    DOM.statsNewLast7DaysSpan.textContent = 'Đang tải...';

    try {
        // Query the 'settings' collection group directly.
        // The client-side filter will ensure only 'profile' documents are processed.
        const usersSnapshot = await db.collectionGroup('settings').get();

        let totalUsers = 0;
        let activeUsers = 0;
        let expiredOrLockedUsers = 0;
        let newLast7Days = 0;
        const now = new Date();
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

        usersSnapshot.forEach(doc => {
            // Ensure we're only processing 'profile' documents within 'settings' subcollection
            // of a 'users/{userId}' path.
            if (doc.ref.path.match(/^users\/[^/]+\/settings\/profile$/)) {
                totalUsers++;
                const data = doc.data();
                const validUntil = data.validUntil ? data.validUntil.toDate() : null;
                const createdAt = data.accountCreatedAt ? data.accountCreatedAt.toDate() : null;

                if (validUntil && validUntil > now && (data.status === 'active_trial' || data.status === 'active_paid')) {
                    activeUsers++;
                } else if (validUntil && validUntil <= now && data.status !== 'disabled' && data.status !== 'suspended') { // Count as expired if not explicitly disabled/suspended
                    expiredOrLockedUsers++;
                } else if (data.status === 'suspended' || data.status === 'disabled') { // Count explicitly disabled/suspended
                    expiredOrLockedUsers++;
                }


                if (createdAt && createdAt >= sevenDaysAgo) {
                    newLast7Days++;
                }
            }
        });

        DOM.statsTotalUsersSpan.textContent = totalUsers;
        DOM.statsActiveUsersSpan.textContent = activeUsers;
        DOM.statsExpiredLockedUsersSpan.textContent = expiredOrLockedUsers;
        DOM.statsNewLast7DaysSpan.textContent = newLast7Days;

    } catch (error) {
        console.error("Lỗi tổng hợp thống kê:", error);
        showNotification("Không thể tải thống kê người dùng. " + error.message, "error");
        DOM.statsTotalUsersSpan.textContent = 'Lỗi';
        DOM.statsActiveUsersSpan.textContent = 'Lỗi';
        DOM.statsExpiredLockedUsersSpan.textContent = 'Lỗi';
        DOM.statsNewLast7DaysSpan.textContent = 'Lỗi';
    } finally {
        UI.hideLoader();
    }
}

/**
 * Cập nhật trạng thái tài khoản của người dùng.
 */
export async function updateUserStatusByAdmin() {
    const targetUserId = DOM.adminTargetUserIdInput.value;
    if (!targetUserId) {
        showNotification("Vui lòng tìm kiếm người dùng trước khi cập nhật trạng thái.", 'info');
        return;
    }

    const newStatus = DOM.adminUserStatusSelect.value;
    if (!newStatus) {
        showNotification("Vui lòng chọn một trạng thái hợp lệ.", 'error');
        return;
    }

    const profileRef = db.collection('users').doc(targetUserId).collection('settings').doc('profile');
    UI.showLoader();
    DOM.adminUpdateStatusP.textContent = '';

    try {
        await profileRef.update({ status: newStatus });
        const successMessage = `Đã cập nhật trạng thái tài khoản thành "${newStatus}".`;
        DOM.adminUpdateStatusP.textContent = successMessage;
        DOM.adminUpdateStatusP.style.color = "var(--success-color)";
        showNotification(successMessage, 'success');

        // Refresh displayed user details to show new status
        const updatedDoc = await profileRef.get();
        if(updatedDoc.exists) {
            UI.renderUserProfile(updatedDoc.data(), targetUserId, DOM.adminUserDetailsDiv);
            // Ensure the select dropdown also reflects the new status if the user details are re-rendered
             if(DOM.adminUserStatusSelect) DOM.adminUserStatusSelect.value = updatedDoc.data().status || 'active_trial';
        }
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái người dùng:", error);
        const message = error.code === 'permission-denied' 
            ? 'Cập nhật thất bại: Không có quyền.' 
            : 'Cập nhật trạng thái thất bại. Vui lòng thử lại.';
        DOM.adminUpdateStatusP.textContent = message;
        DOM.adminUpdateStatusP.style.color = "var(--danger-color)";
        showNotification(message, 'error');
    } finally {
        UI.hideLoader();
    }
}
