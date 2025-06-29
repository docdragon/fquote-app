
/**
 * @file b2Storage.js
 * @description Handles file uploads by sending them to a secure backend proxy.
 * This client-side script NO LONGER contains sensitive API keys.
 */

import { showNotification } from './notifications.js';
import * as UI from './ui.js';

/**
 * Converts a File object to a Base64 encoded string.
 * @param {File} file The file to convert.
 * @returns {Promise<string>} A promise that resolves with the Base64 string.
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // result is "data:mime/type;base64,the-real-base64-string"
            // We only want the part after the comma.
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
}


/**
 * Public function to upload an image file via the secure backend proxy.
 * @param {File} file The file object to upload.
 * @param {string} targetPath The desired path/name for the file in B2 (e.g., "logos/company_logo.png").
 * @returns {Promise<string|null>} The public URL of the uploaded file or null on failure.
 */
export async function uploadImageToB2(file, targetPath) {
    if (!file) {
        console.warn("uploadImageToB2: No file provided.");
        return null;
    }

    UI.showLoader(); // Show loader during upload

    try {
        // Convert the file to a Base64 string to send in JSON body
        const base64Data = await fileToBase64(file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileData: base64Data,
                fileName: targetPath,
                mimeType: file.type || 'application/octet-stream'
            }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Upload failed.');
        }

        console.log('File uploaded via proxy. URL:', result.url);
        showNotification('Tải ảnh lên thành công!', 'success');
        return result.url;

    } catch (error) {
        console.error('Lỗi khi tải ảnh lên qua proxy:', error);
        showNotification(`Tải ảnh lên thất bại: ${error.message}`, 'error');
        return null;
    } finally {
        UI.hideLoader(); // Hide loader after operation
    }
}
