
/**
 * @file fontUtils.js
 * @description Utility for loading fonts for PDF generation.
 */

let loadedFontDataPromise = null;

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const loadFont = async (url) => {
    const fontResponse = await fetch(url);
    if (!fontResponse.ok) throw new Error(`Network response was not ok for ${url}`);
    const fontBuffer = await fontResponse.arrayBuffer();
    return arrayBufferToBase64(fontBuffer);
};

export async function getLoadedFontData() {
    if (!loadedFontDataPromise) {
        loadedFontDataPromise = new Promise(async (resolve, reject) => {
            try {
                console.log("Loading PDF fonts for the first time...");
                const [
                    robotoRegularBase64, 
                    robotoBoldBase64, 
                    robotoItalicBase64, 
                    robotoBoldItalicBase64
                ] = await Promise.all([
                    loadFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf'),
                    loadFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf'), // Using Medium for Bold
                    loadFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Italic.ttf'),
                    loadFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-MediumItalic.ttf') // Using MediumItalic for BoldItalic
                ]);
                console.log("PDF fonts loaded and cached.");
                resolve({ 
                    robotoRegularBase64, 
                    robotoBoldBase64, 
                    robotoItalicBase64, 
                    robotoBoldItalicBase64 
                });
            } catch (error) {
                console.error("Lỗi tải phông chữ:", error);
                // alert("Không thể tải phông chữ cần thiết để xuất PDF. Vui lòng kiểm tra kết nối mạng và thử lại.");
                reject(error); // Reject the promise so callers can handle it
            }
        });
    }
    return loadedFontDataPromise;
}
