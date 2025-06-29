


/**
 * @file ui.js
 * @description Chứa các logic liên quan đến giao diện người dùng (UI) chung.
 * CẬP NHẬT: Tái cấu trúc logic tạo PDF để sử dụng jsPDF-AutoTable hiệu quả hơn,
 * phá vỡ phụ thuộc vòng và làm cho code gọn gàng, dễ bảo trì.
 */
import * as DOM from './dom.js';
import { db, auth } from './firebase.js';
import {
    formatDate,
    formatCurrency,
    numberToRoman,
} from './utils.js';
// REMOVED: import from './quote.js' to break circular dependency
import { getMainCategories } from './catalog.js';
import { getLoadedFontData } from './fontUtils.js';


// --- UTILITY FUNCTIONS ---
function formatNumberForTable(number) {
    if (typeof number !== 'number' || isNaN(number)) return '0';
    return number.toLocaleString('vi-VN');
}

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
// ========================== PDF GENERATION LOGIC (REFACTORED) ======================
// ===================================================================================

const PDF_SETTINGS = {
    margin: 15,
    primaryColor: '#1a73e8',
    secondaryColor: '#f1f3f4',
    textColor: '#202124',
    lightTextColor: '#5f6368',
};


/** Khởi tạo đối tượng jsPDF với fonts đã nạp */
function initializePdfDoc(fonts) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a3');
    doc.addFileToVFS('Roboto-Regular.ttf', fonts.robotoRegularBase64);
    doc.addFileToVFS('Roboto-Bold.ttf', fonts.robotoBoldBase64);
    doc.addFileToVFS('Roboto-Italic.ttf', fonts.robotoItalicBase64);
    doc.addFileToVFS('Roboto-BoldItalic.ttf', fonts.robotoBoldItalicBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.addFont('Roboto-Italic.ttf', 'Roboto', 'italic');
    doc.addFont('Roboto-BoldItalic.ttf', 'Roboto', 'bolditalic');
    doc.setFont('Roboto', 'normal');
    return doc;
}

/** Vẽ header của PDF */
function drawPdfHeader(doc, settings, y) {
    let logoHeight = 0;
    if (settings.logoDataUrl) {
        try {
            const imgProps = doc.getImageProperties(settings.logoDataUrl);
            const imgWidth = 30;
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
            logoHeight = Math.min(imgHeight, 25);
            doc.addImage(settings.logoDataUrl, 'PNG', PDF_SETTINGS.margin, y - 5, imgWidth, logoHeight);
        } catch (e) { console.warn("Không thể thêm logo.", e); }
    }
    const companyInfoX = PDF_SETTINGS.margin + 35;
    doc.setFont('Roboto', 'bold').setFontSize(14).setTextColor(PDF_SETTINGS.textColor);
    doc.text((settings.name || 'TÊN CÔNG TY').toUpperCase(), companyInfoX, y);
    doc.setFont('Roboto', 'normal').setFontSize(9).setTextColor(PDF_SETTINGS.lightTextColor);
    doc.text(settings.address || 'Địa chỉ công ty', companyInfoX, y + 7);
    doc.text(`ĐT: ${settings.phone || '[SĐT]'} | Email: ${settings.email || '[Email]'}`, companyInfoX, y + 12);
    if (settings.taxId) doc.text(`MST: ${settings.taxId}`, companyInfoX, y + 17);
    const newY = Math.max(y + 22, y + logoHeight);
    doc.setDrawColor(PDF_SETTINGS.secondaryColor).line(PDF_SETTINGS.margin, newY, doc.internal.pageSize.getWidth() - PDF_SETTINGS.margin, newY);
    return newY;
}

/** Vẽ tiêu đề và thông tin khách hàng */
function drawPdfTitleAndCustomerInfo(doc, quoteId, printOptions, y, customerInfo) {
    const pageContentWidth = doc.internal.pageSize.getWidth() - (PDF_SETTINGS.margin * 2);
    let currentY = y + 12;
    doc.setFont('Roboto', 'bold').setFontSize(22).setTextColor(PDF_SETTINGS.textColor);
    doc.text((printOptions.title || 'BÁO GIÁ').toUpperCase(), doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    
    currentY += 12;
    doc.setFont('Roboto', 'normal').setFontSize(10);
    doc.setDrawColor(PDF_SETTINGS.secondaryColor).setFillColor(PDF_SETTINGS.secondaryColor);
    doc.roundedRect(PDF_SETTINGS.margin, currentY, pageContentWidth, 20, 3, 3, 'F');
    
    const customerBoxY = currentY + 7;
    doc.setTextColor(PDF_SETTINGS.lightTextColor).setFont('Roboto', 'bold');
    doc.text('KHÁCH HÀNG:', PDF_SETTINGS.margin + 5, customerBoxY);
    doc.text('SỐ BÁO GIÁ:', PDF_SETTINGS.margin + pageContentWidth/2, customerBoxY);
    doc.text('NGÀY:', PDF_SETTINGS.margin + pageContentWidth/2, customerBoxY + 7);
    
    doc.setFont('Roboto', 'normal').setTextColor(PDF_SETTINGS.textColor);
    doc.text(customerInfo.name || '[Tên Khách hàng]', PDF_SETTINGS.margin + 30, customerBoxY);
    doc.text(customerInfo.address || '[Địa chỉ]', PDF_SETTINGS.margin + 30, customerBoxY + 7);
    doc.text(quoteId, PDF_SETTINGS.margin + pageContentWidth/2 + 25, customerBoxY);
    doc.text(formatDate(customerInfo.date), PDF_SETTINGS.margin + pageContentWidth/2 + 25, customerBoxY + 7);
    
    return currentY + 30;
}

/**
 * Xây dựng dữ liệu cho bảng báo giá sử dụng jsPDF-AutoTable.
 * @param {Array} quoteItems - Mảng các hạng mục trong báo giá.
 * @param {Array} mainCategories - Mảng các danh mục chính.
 * @returns {object} - Chứa { body, itemsForTable }.
 */
function buildPdfTableData(quoteItems, mainCategories) {
    const body = [];
    const groupedItems = new Map([['__none__', []]]);

    if (mainCategories) {
        mainCategories.forEach(cat => groupedItems.set(cat.id, []));
    }

    quoteItems.forEach(item => {
        const catId = item.mainCategoryId && groupedItems.has(item.mainCategoryId) ? item.mainCategoryId : '__none__';
        groupedItems.get(catId).push(item);
    });

    let categoryCounter = 0;
    let itemCounter = 0;
    
    const mapItemToRow = (item) => {
        itemCounter++;
        let displayedMeasureText = '';
        if (item.calculatedMeasure && typeof item.calculatedMeasure === 'number' && item.calcType !== 'unit') {
            let measureInMeters = item.calculatedMeasure;
            if (item.calcType === 'length') measureInMeters /= 1000;
            else if (item.calcType === 'area') measureInMeters /= 1000000;
            else if (item.calcType === 'volume') measureInMeters /= 1000000000;
            displayedMeasureText = `${parseFloat(measureInMeters.toFixed(4)).toLocaleString('vi-VN')}`;
        }
        
        return {
            stt: itemCounter.toString(),
            image: '', // Để trống, sẽ vẽ trong didDrawCell
            name: '', // Để trống, sẽ vẽ trong didDrawCell
            unit: item.unit,
            measure: displayedMeasureText,
            quantity: (item.quantity).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
            price: formatNumberForTable(item.price),
            total: formatNumberForTable(item.lineTotal),
            notes: item.notes || '',
            _raw: item, // Giữ lại item gốc để truy cập trong hook
        };
    };

    const processCategory = (itemsInCategory) => {
        itemsInCategory.forEach(item => {
            body.push(mapItemToRow(item));
        });
    };

    if (mainCategories) {
        mainCategories.forEach(category => {
            const items = groupedItems.get(category.id);
            if (items && items.length > 0) {
                categoryCounter++;
                const categoryTotal = items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                body.push({
                    stt: { content: `${numberToRoman(categoryCounter)}.`, styles: { fontStyle: 'bold', fontSize: 10, textColor: PDF_SETTINGS.primaryColor } },
                    image: { content: category.name.toUpperCase(), colSpan: 6, styles: { fontStyle: 'bold', fontSize: 10, textColor: PDF_SETTINGS.primaryColor } },
                    total: { content: formatNumberForTable(categoryTotal), styles: { fontStyle: 'bold', halign: 'right', fontSize: 10, textColor: PDF_SETTINGS.primaryColor } },
                    // notes is implicitly handled by colSpan
                });
                processCategory(items);
            }
        });
    }

    const itemsWithoutCategory = groupedItems.get('__none__');
    if (itemsWithoutCategory && itemsWithoutCategory.length > 0) {
        if (body.length > 0) { // Add a separator
            body.push([{ content: '', colSpan: 9, styles: { cellPadding: 1 } }]);
        }
        processCategory(itemsWithoutCategory);
    }

    return { body };
}


/** Vẽ phần tổng cộng và các điều khoản */
function drawPdfTotalsAndTerms(doc, totals, installments, companySettings, y) {
    let currentY = y + 7;
    const totalsX = doc.internal.pageSize.getWidth() / 2;
    const totalsWidth = doc.internal.pageSize.getWidth() / 2 - PDF_SETTINGS.margin;

    doc.autoTable({
        startY: currentY,
        body: [
            ['Tạm tính:', { content: formatCurrency(totals.subTotal), styles: { halign: 'right' } }],
            [`Giảm giá (${totals.discountType === 'percent' ? `${totals.discountValue}%` : formatCurrency(totals.discountValue)}):`, { content: formatCurrency(totals.discountAmount), styles: { halign: 'right' } }],
            [`Thuế VAT (${totals.taxPercent}%):`, { content: formatCurrency(totals.taxAmount), styles: { halign: 'right' } }],
        ],
        theme: 'plain',
        tableWidth: totalsWidth,
        margin: { left: totalsX },
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 1.5, fontStyle: 'normal' },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });
    currentY = doc.lastAutoTable.finalY;

    doc.setDrawColor(PDF_SETTINGS.textColor).setLineWidth(0.3);
    doc.line(totalsX, currentY + 1, doc.internal.pageSize.getWidth() - PDF_SETTINGS.margin, currentY + 1);

    doc.setFont('Roboto', 'bold').setFontSize(12);
    doc.text('TỔNG CỘNG:', totalsX, currentY + 7);
    doc.text(formatCurrency(totals.grandTotal), doc.internal.pageSize.getWidth() - PDF_SETTINGS.margin, currentY + 7, { align: 'right' });
    currentY += 12;

    const notesX = PDF_SETTINGS.margin;
    const notesWidth = doc.internal.pageSize.getWidth() - PDF_SETTINGS.margin * 2;
    
    // Default notes
    if (companySettings.defaultQuoteNotes) {
        doc.setFont('Roboto', 'bold').setFontSize(9).text('GHI CHÚ CHUNG:', notesX, currentY);
        currentY += 5;
        doc.setFont('Roboto', 'normal').setFontSize(9);
        const splitNotes = doc.splitTextToSize(companySettings.defaultQuoteNotes, notesWidth);
        doc.text(splitNotes, notesX, currentY);
        currentY += splitNotes.length * 4 + 5;
    }

    // Bank account info
    if (companySettings.bankAccount) {
        doc.setFont('Roboto', 'bold').setFontSize(9).text('THÔNG TIN CHUYỂN KHOẢN:', notesX, currentY);
        currentY += 5;
        doc.setFont('Roboto', 'normal').setFontSize(9);
        const splitBank = doc.splitTextToSize(companySettings.bankAccount, notesWidth);
        doc.text(splitBank, notesX, currentY);
        currentY += splitBank.length * 4;
    }

    return currentY;
}

/** Vẽ footer và chữ ký */
function drawPdfFooterAndSignature(doc, companySettings) {
    const pageCount = doc.internal.getNumberOfPages();
    const printOptions = companySettings.printOptions || {};
    
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Footer line and page number
        doc.setDrawColor(PDF_SETTINGS.secondaryColor).line(PDF_SETTINGS.margin, pageHeight - 12, pageWidth - PDF_SETTINGS.margin, pageHeight - 12);
        doc.setFont('Roboto', 'italic').setFontSize(8).setTextColor(PDF_SETTINGS.lightTextColor);
        if (printOptions.footer) {
            doc.text(printOptions.footer, PDF_SETTINGS.margin, pageHeight - 8);
        }
        doc.text(`Trang ${i}/${pageCount}`, pageWidth - PDF_SETTINGS.margin, pageHeight - 8, { align: 'right' });

        // Signature on the last page only
        if (i === pageCount) {
            let finalY = doc.lastAutoTable.finalY > 0 ? doc.lastAutoTable.finalY : pageHeight / 2;
            if (pageHeight - finalY < 60) {
                 doc.addPage();
                 finalY = PDF_SETTINGS.margin + 15;
            } else {
                 finalY = Math.max(finalY + 20, pageHeight - 80);
            }
             
            const signatureX = pageWidth - PDF_SETTINGS.margin - 70;
            doc.setFont('Roboto', 'bold').setFontSize(10).setTextColor(PDF_SETTINGS.textColor);
            doc.text('Người lập báo giá', signatureX + 35, finalY, { align: 'center' });
            doc.setFont('Roboto', 'italic').setFontSize(9).setTextColor(PDF_SETTINGS.lightTextColor);
            doc.text('(Ký, ghi rõ họ tên)', signatureX + 35, finalY + 5, { align: 'center' });

            if(printOptions.creatorName) {
                doc.setFont('Roboto', 'bold').setFontSize(11);
                doc.text(printOptions.creatorName, signatureX + 35, finalY + 25, { align: 'center' });
            }
        }
    }
}

/**
 * Hàm lõi để tạo file PDF, dùng cho cả preview và export.
 * @param {object} options - Tùy chọn { output: 'preview' | 'save' }.
 * @param {object} quoteData - Dữ liệu báo giá được truyền từ `main.js`.
 */
async function generatePdf(options, quoteData) {
    const { output = 'preview' } = options;
    const { companySettings, quoteId, customerInfo, items, mainCategories, totals, installments } = quoteData;

    if (!items || items.length === 0) {
        alert('Không có hạng mục nào trong báo giá để tạo PDF.');
        return;
    }

    const fonts = await getLoadedFontData();
    const doc = initializePdfDoc(fonts);

    let currentY = 20;

    currentY = drawPdfHeader(doc, companySettings, currentY);
    currentY = drawPdfTitleAndCustomerInfo(doc, quoteId, companySettings.printOptions || {}, currentY, customerInfo);

    const { body } = buildPdfTableData(items, mainCategories);

    doc.autoTable({
        columns: [
            { header: 'STT', dataKey: 'stt' },
            { header: 'Hình ảnh', dataKey: 'image' },
            { header: 'HẠNG MỤC / MÔ TẢ', dataKey: 'name' },
            { header: 'ĐVT', dataKey: 'unit' },
            { header: 'K.Lượng', dataKey: 'measure' },
            { header: 'SL', dataKey: 'quantity' },
            { header: 'ĐƠN GIÁ', dataKey: 'price' },
            { header: 'THÀNH TIỀN', dataKey: 'total' },
            { header: 'GHI CHÚ', dataKey: 'notes' },
        ],
        body: body,
        startY: currentY,
        theme: 'grid',
        margin: { top: PDF_SETTINGS.margin, right: PDF_SETTINGS.margin, bottom: 20, left: PDF_SETTINGS.margin },
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 2, overflow: 'linebreak', lineColor: '#ccc', lineWidth: 0.1 },
        headStyles: { fillColor: PDF_SETTINGS.primaryColor, textColor: '#fff', fontStyle: 'bold' },
        columnStyles: {
            stt: { cellWidth: 10, halign: 'center' },
            image: { cellWidth: 20, halign: 'center' },
            name: { cellWidth: 112 },
            unit: { cellWidth: 10, halign: 'center' },
            measure: { cellWidth: 15, halign: 'right' },
            quantity: { cellWidth: 12, halign: 'right' },
            price: { cellWidth: 25, halign: 'right' },
            total: { cellWidth: 28, halign: 'right' },
            notes: { cellWidth: 35 },
        },
        didParseCell: (data) => {
            // Handle category rows separately
            if (data.row.raw && data.row.raw.stt && typeof data.row.raw.stt === 'object') {
                data.row.height = 10;
                return;
            }

            // For data rows, calculate height once per row using a flag
            if (data.row.raw && data.row.raw._raw && !data.row.heightCalculated) {
                const item = data.row.raw._raw;
                const row = data.row;
                const ptToMm = 0.352778;
                const lineHeightFactor = 1.2; // Give text a bit more room
                let maxContentHeight = 0;

                const calculateTextHeight = (text, maxWidth, fontSize, fontStyle) => {
                    if (!text) return 0;
                    doc.setFont('Roboto', fontStyle).setFontSize(fontSize);
                    const lines = doc.splitTextToSize(text, maxWidth);
                    return lines.length * fontSize * ptToMm * lineHeightFactor;
                };

                // 1. Image height
                const imageHeight = item.imageDataUrl ? 12 : 0; // The image is 12mm tall
                maxContentHeight = Math.max(maxContentHeight, imageHeight);

                // 2. Name column height
                const nameCell = row.cells.name;
                if (nameCell) {
                    const nameMaxWidth = nameCell.width - nameCell.padding('horizontal');
                    let combinedNameHeight = 0;

                    combinedNameHeight += calculateTextHeight(item.name.toUpperCase(), nameMaxWidth, 9, 'bold');

                    let subTextParts = [];
                    let dimParts = [];
                    if (item.length) dimParts.push(`D ${item.length}mm`);
                    if (item.height) dimParts.push(`C ${item.height}mm`);
                    if (item.depth) dimParts.push(`S ${item.depth}mm`);
                    const dimensionsString = dimParts.join(' x ');
                    if (dimensionsString) subTextParts.push(`(KT: ${dimensionsString})`);
                    if (item.spec) subTextParts.push(item.spec);
                    
                    if (subTextParts.length > 0) {
                        combinedNameHeight += calculateTextHeight(subTextParts.join('\n'), nameMaxWidth, 8, 'italic');
                    }
                    maxContentHeight = Math.max(maxContentHeight, combinedNameHeight);
                }

                // 3. 'notes' column height
                const notesCell = row.cells.notes;
                if (notesCell && notesCell.raw) {
                    const notesMaxWidth = notesCell.width - notesCell.padding('horizontal');
                    const notesHeight = calculateTextHeight(String(notesCell.raw), notesMaxWidth, notesCell.styles.fontSize, 'normal');
                    maxContentHeight = Math.max(maxContentHeight, notesHeight);
                }
                
                // Set final row height
                row.height = maxContentHeight + data.cell.padding('vertical');
                row.heightCalculated = true; // Set flag to avoid re-calculation
            }
        },
        didDrawCell: (data) => {
            if (data.row.raw && data.row.raw._raw) {
                const item = data.row.raw._raw;
                
                if (data.column.dataKey === 'image' && item.imageDataUrl) {
                    try {
                        doc.addImage(item.imageDataUrl, 'JPEG', data.cell.x + 2, data.cell.y + 2, 16, 12);
                    } catch(e) { console.warn("Lỗi thêm ảnh vào PDF cell:", e); }
                }
                
                if (data.column.dataKey === 'name') {
                    const ptToMm = 0.352778;
                    const lineHeightFactor = 1.2;

                    const cellX = data.cell.x + data.cell.padding('left');
                    let currentY = data.cell.y + data.cell.padding('top');
                    const maxWidth = data.cell.width - data.cell.padding('horizontal');
                    
                    // Draw Name
                    const nameFontSize = 9;
                    const nameText = item.name.toUpperCase();
                    doc.setFont('Roboto', 'bold').setFontSize(nameFontSize).setTextColor(PDF_SETTINGS.textColor);
                    const nameLines = doc.splitTextToSize(nameText, maxWidth);
                    doc.text(nameLines, cellX, currentY + (nameFontSize * ptToMm));
                    currentY += nameLines.length * nameFontSize * ptToMm * lineHeightFactor;
                    
                    // Draw Subtext
                    let subTextParts = [];
                    let dimParts = [];
                    if (item.length) dimParts.push(`D ${item.length}mm`);
                    if (item.height) dimParts.push(`C ${item.height}mm`);
                    if (item.depth) dimParts.push(`S ${item.depth}mm`);
                    const dimensionsString = dimParts.join(' x ');
                    if (dimensionsString) subTextParts.push(`(KT: ${dimensionsString})`);
                    if (item.spec) subTextParts.push(item.spec);

                    if (subTextParts.length > 0) {
                        const subTextFontSize = 8;
                        const subText = subTextParts.join('\n');
                        doc.setFont('Roboto', 'italic').setFontSize(subTextFontSize).setTextColor(PDF_SETTINGS.lightTextColor);
                        doc.text(subText, cellX, currentY);
                    }
                }
            }
        }
    });

    let finalY = doc.lastAutoTable.finalY;
    finalY = drawPdfTotalsAndTerms(doc, totals, installments, companySettings, finalY);

    drawPdfFooterAndSignature(doc, companySettings);

    const fileName = `BaoGia_${quoteId}_${customerInfo.name.replace(/\s/g, '_')}.pdf`;
    if (output === 'save') {
        doc.save(fileName);
    } else {
        doc.output('dataurlnewwindow', { filename: fileName });
    }
}


export async function exportToPdf(quoteData) {
    showLoader();
    try {
        await generatePdf({ output: 'save' }, quoteData);
    } catch (e) {
        console.error("Lỗi xuất PDF:", e);
        alert(`Đã xảy ra lỗi khi tạo file PDF: ${e.message}`);
    } finally {
        hideLoader();
    }
}

export async function previewPdf(quoteData) {
    showLoader();
    try {
        await generatePdf({ output: 'preview' }, quoteData);
    } catch (e) {
        console.error("Lỗi xem trước PDF:", e);
        alert(`Đã xảy ra lỗi khi tạo file PDF: ${e.message}`);
    } finally {
        hideLoader();
    }
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
        statusText = `Hết hạn (${formatDate(validUntilDate)})`;
    } else if (['suspended', 'disabled'].includes(profileData.status)) {
        statusClass = 'status-expired';
        statusText = `Bị khóa (${profileData.status})`;
    }
    containerDiv.innerHTML = `
        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Email:</strong> ${profileData.email}</p>
        <p><strong>Ngày tạo:</strong> ${profileData.accountCreatedAt ? formatDate(profileData.accountCreatedAt.toDate()) : 'N/A'}</p>
        <p><strong>Hạn sử dụng:</strong> <span class="${statusClass}">${validUntilDate ? formatDate(validUntilDate) : 'N/A'}</span></p>
        <p><strong>Trạng thái:</strong> <span class="${statusClass}">${statusText}</span></p>
    `;
}