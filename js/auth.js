
/**
 * @file auth.js
 * @description Xử lý logic xác thực người dùng (Đăng ký, Đăng nhập, Đăng xuất, Quên mật khẩu).
 */
import { auth, db } from './firebase.js';
import { showNotification } from './notifications.js';
import * as DOM from './dom.js'; // Import DOM for password toggle

export function setupUI(user, { authModal, appContainer, authStatusEl, logoutButton }) {
    if (!authModal || !appContainer || !authStatusEl || !logoutButton) {
        return;
    }

    const userAvatarDiv = document.querySelector('.user-avatar'); // Get avatar div

    if (user) {
        let displayName = user.displayName;
        if (!displayName && user.email) {
            displayName = user.email.split('@')[0];
        }
        if (!displayName) {
            displayName = "Người dùng"; // Fallback
        }

        authStatusEl.innerHTML = `<span id="userDisplayName">${displayName}</span>`; // Only display name
        if (userAvatarDiv) {
            userAvatarDiv.textContent = displayName.charAt(0).toUpperCase(); // Set avatar initial
        }
        
        if (!user.emailVerified) {
             authStatusEl.innerHTML += ` <small style="color:orange; display:block;">(Chưa xác thực)</small>`;
        }
        logoutButton.style.display = 'inline-block';
        
        authModal.style.display = 'none';
        appContainer.style.display = 'block';
    } else {
        authStatusEl.textContent = 'Đang kết nối...';
        if (userAvatarDiv) {
            userAvatarDiv.textContent = '👤'; // Default avatar
        }
        authModal.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

export function initAuthForms({ loginForm, signupForm, loginErrorEl, signupErrorEl, showSignupLink, showLoginLink, logoutButton, rememberMeCheckbox }) {
    
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const loginPasswordInput = DOM.loginForm ? DOM.loginForm['login-password'] : null;
    const toggleLoginPasswordBtn = DOM.toggleLoginPasswordButton;


    if (!loginForm || !signupForm || !showSignupLink || !showLoginLink || !logoutButton || !forgotPasswordLink) {
        return;
    }

    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    });

    signupForm.addEventListener('submit', async (e) => { // Make async to await admin settings
        e.preventDefault();
        const email = signupForm['signup-email'].value;
        const password = signupForm['signup-password'].value;
        signupErrorEl.textContent = '';
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const createdUser = userCredential.user;
            const now = new Date();

            // Fetch default trial days from admin settings
            let defaultTrialDays = 7; // Fallback
            try {
                const adminSettingsRef = db.collection('admin_settings').doc('global');
                const adminSettingsSnap = await adminSettingsRef.get();
                if (adminSettingsSnap.exists && adminSettingsSnap.data().defaultTrialDays) {
                    defaultTrialDays = parseInt(adminSettingsSnap.data().defaultTrialDays) || 7;
                }
            } catch (adminError) {
                console.warn("Could not fetch admin default trial days during signup, using fallback.", adminError);
            }
            const validUntil = new Date(new Date().setDate(now.getDate() + defaultTrialDays)); 
            
            await createdUser.updateProfile({
                displayName: createdUser.email.split('@')[0]
            });
            
            const profileData = {
                email: createdUser.email,
                displayName: createdUser.email.split('@')[0], // Set initial displayName
                accountCreatedAt: firebase.firestore.Timestamp.fromDate(now),
                validUntil: firebase.firestore.Timestamp.fromDate(validUntil),
                status: 'active_trial', // Default status for new users
                darkModeEnabled: false // Default dark mode to false
            };
            await db.collection('users').doc(createdUser.uid).collection('settings').doc('profile').set(profileData);
            
            await createdUser.sendEmailVerification();
            
            auth.signOut();
            alert(`Đăng ký thành công! Bạn đã nhận được ${defaultTrialDays} ngày dùng thử. Vui lòng kiểm tra hộp thư để xác thực tài khoản, sau đó quay lại trang này để đăng nhập.`);
            signupForm.style.display = 'none';
            loginForm.style.display = 'block';

        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                signupErrorEl.textContent = 'Email này đã được sử dụng.';
            } else if (err.code === 'auth/weak-password') {
                 signupErrorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
            } else {
                signupErrorEl.textContent = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
            }
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginPasswordInput ? loginPasswordInput.value : '';
        loginErrorEl.textContent = '';
        const remember = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
        
        const persistence = remember 
            ? firebase.auth.Auth.Persistence.LOCAL 
            : firebase.auth.Auth.Persistence.SESSION;

        try {
            await auth.setPersistence(persistence);
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            if (!userCredential.user.emailVerified) {
                auth.signOut();
                showNotification('Tài khoản chưa được xác thực. Vui lòng kiểm tra email.', 'error');
            }
            // Successful login handled by onAuthStateChanged
        } catch (err) {
            let message = 'Đã có lỗi xảy ra. Vui lòng thử lại.'; 
            switch (err.code) {
                case 'auth/user-not-found':
                    message = 'Không tìm thấy tài khoản với email này.';
                    break;
                case 'auth/wrong-password':
                    message = 'Mật khẩu không chính xác. Vui lòng thử lại.';
                    break;
                case 'auth/invalid-email':
                    message = 'Địa chỉ email không hợp lệ.';
                    break;
                case 'auth/too-many-requests':
                    message = 'Phát hiện hoạt động bất thường. Tài khoản đã bị tạm khóa, vui lòng thử lại sau.';
                    break;
                case 'auth/invalid-credential': 
                    message = 'Thông tin đăng nhập không chính xác.';
                    break;
                case 'auth/user-disabled':
                     message = 'Tài khoản này đã bị vô hiệu hóa.';
                     break;
            }
            if(loginErrorEl) loginErrorEl.textContent = message;
        }
    });


    logoutButton.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
            auth.signOut();
        }
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        if (!email) {
            showNotification('Vui lòng nhập email của bạn vào ô Email để lấy lại mật khẩu.', 'error');
            loginForm['login-email'].focus();
            return;
        }

        auth.sendPasswordResetEmail(email)
            .then(() => {
                showNotification(`Đã gửi email đặt lại mật khẩu tới ${email}. Vui lòng kiểm tra hộp thư của bạn.`, 'success');
            })
            .catch((error) => {
                if (error.code === 'auth/user-not-found') {
                    showNotification('Không tìm thấy người dùng với email này.', 'error');
                } else {
                    showNotification('Lỗi khi gửi email. Vui lòng thử lại.', 'error');
                }
            });
    });

    if (toggleLoginPasswordBtn && loginPasswordInput) {
        toggleLoginPasswordBtn.addEventListener('click', () => {
            const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            loginPasswordInput.setAttribute('type', type);
            toggleLoginPasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
            toggleLoginPasswordBtn.setAttribute('aria-label', type === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
        });
    }
}