
/**
 * @file quote.js
 * @description Quản lý logic báo giá với listeners thời gian thực, trạng thái, và các tùy chỉnh.
 */

import * as DOM from './dom.js';
import { db, auth } from './firebase.js';
import { formatDate, formatCurrency, generateSimpleQuoteId, generateUniqueId, numberToRoman } from './utils.js';
import { getLoadedCatalog, getMainCategories, findOrCreateMainCategory, saveItemToMasterCatalog } from './catalog.js';
import { getSavedCostingSheets } from './costing.js';
import { showNotification } from './notifications.js';

// --- STATE & CONSTANTS ---
const QUOTE_STATUSES = {
    draft: 'Soạn thảo',
    sent: 'Đã gửi',
    accepted: 'Đã chấp nhận',
    rejected: 'Đã từ chối',
    expired: 'Đã hết hạn'
};
const QUOTE_TEMPLATES_COLLECTION = 'quoteTemplates';
let currentQuoteItems = [];
let savedQuotes = [];
let quoteTemplates = [];
let companySettings = { bankAccount: '', logoDataUrl: null, defaultQuoteNotes: '' };
let currentQuoteIdInternal = null;
let itemImageDataBase64QuoteForm = null;
let quoteInstallmentData = [];

// === GETTERS (REFACTORED TO STANDARD FUNCTIONS) ===
export function getCompanySettings() {
    return { ...companySettings };
}
export function getCurrentQuoteItems() {
    return [...currentQuoteItems];
}
export function getCurrentQuoteId() {
    // Generate a user-friendly ID for PDF if the internal one is complex
    return generateSimpleQuoteId(
        DOM.customerNameInput.value,
        DOM.quoteDateInput.value,
        true // forPdf = true
    );
}
export function getQuoteInstallmentData() {
    return [...quoteInstallmentData];
}

// === REAL-TIME LISTENERS ===

export function listenToCompanySettings(userId) {
    if (!userId) return () => {};
    const docRef = db.collection('users').doc(userId).collection('settings').doc('company');
    const unsubscribe = docRef.onSnapshot(doc => {
        if (doc.exists) {
            companySettings = doc.data();
            DOM.companyNameSettingInput.value = companySettings.name || '';
            DOM.companyAddressSettingInput.value = companySettings.address || '';
            DOM.companyPhoneSettingInput.value = companySettings.phone || '';
            DOM.companyEmailSettingInput.value = companySettings.email || '';
            DOM.companyTaxIdSettingInput.value = companySettings.taxId || '';
            DOM.companyBankAccountSetting.value = companySettings.bankAccount || '';
            DOM.defaultNotesSettingInput.value = companySettings.defaultQuoteNotes || '';
            if (companySettings.logoDataUrl) {
                DOM.logoPreview.src = companySettings.logoDataUrl;
                DOM.logoPreview.style.display = 'block';
            } else {
                 DOM.logoPreview.style.display = 'none';
            }

            const printOptions = companySettings.printOptions || {};
            DOM.printTitleSettingInput.value = printOptions.title || 'BÁO GIÁ';
            DOM.printCreatorNameSettingInput.value = printOptions.creatorName || (auth.currentUser?.displayName || '');
            DOM.printFooterSettingInput.value = printOptions.footer || '';

        } else {
            companySettings = {};
            DOM.printCreatorNameSettingInput.value = auth.currentUser?.displayName || '';
        }
    }, error => console.error("Lỗi lắng nghe cài đặt công ty:", error));
    return unsubscribe;
}

export function listenToCurrentWorkingQuote(userId) {
    if (!userId) return () => {};
    const docRef = db.collection('users').doc(userId).collection('ux').doc('currentQuote');
    const unsubscribe = docRef.onSnapshot(doc => {
        if (doc.exists) {
            const quoteData = doc.data();
            currentQuoteIdInternal = quoteData.id || generateSimpleQuoteId('', new Date().toISOString().split('T')[0]);
            DOM.customerNameInput.value = quoteData.customerName || '';
            DOM.customerAddressInput.value = quoteData.customerAddress || '';
            DOM.quoteDateInput.value = quoteData.quoteDate || new Date().toISOString().split('T')[0];
            currentQuoteItems = quoteData.items || [];
            DOM.applyDiscountCheckbox.checked = typeof quoteData.applyDiscount === 'boolean' ? quoteData.applyDiscount : true;
            DOM.discountValueInput.value = quoteData.discountValue || '0';
            DOM.discountTypeSelect.value = quoteData.discountType || 'percent';
            DOM.applyTaxCheckbox.checked = typeof quoteData.applyTax === 'boolean' ? quoteData.applyTax : true;
            DOM.taxPercentInput.value = quoteData.taxPercent || '0';
            DOM.applyInstallmentsCheckbox.checked = quoteData.applyInstallments || false;
            quoteInstallmentData = Array.isArray(quoteData.installments) ? quoteData.installments : [];
            renderQuoteItemsPreview();
            calculateTotals(userId, false);
        } else {
            startNewQuote(userId);
        }
    }, error => console.error("Lỗi lắng nghe báo giá nháp:", error));
    return unsubscribe;
}

export function listenToSavedQuotes(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection('quotes').orderBy('timestamp', 'desc').limit(50);
    const unsubscribe = query.onSnapshot(snapshot => {
        savedQuotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSavedQuotesList();
        if (DOM.loadMoreQuotesButton) DOM.loadMoreQuotesButton.style.display = 'none';
    }, error => {
        console.error("Lỗi lắng nghe báo giá đã lưu:", error);
        const message = error.code === 'permission-denied'
            ? 'Tải danh sách báo giá thất bại: Không có quyền.'
            : 'Tải danh sách báo giá thất bại. Vui lòng kiểm tra kết nối mạng.';
        showNotification(message, 'error');
    });
    return unsubscribe;
}

// === IMAGE HANDLING (Base64) ===

export function itemImageFileQuoteFormHandler(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 500 * 1024) {
            showNotification('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 500KB.', 'error');
            DOM.itemImageFileQuoteForm.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            DOM.itemImagePreviewQuoteForm.src = e.target.result;
            DOM.itemImagePreviewQuoteForm.style.display = 'block';
            itemImageDataBase64QuoteForm = e.target.result;
            DOM.removeItemImageButtonQuoteForm.style.display = 'inline-flex';
        }
        reader.readAsDataURL(file);
    }
}

export function companyLogoFileHandler(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 1 * 1024 * 1024) {
            showNotification('Logo quá lớn (tối đa 1MB).', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            DOM.logoPreview.src = e.target.result;
            DOM.logoPreview.style.display = 'block';
            companySettings.logoDataUrl = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// === QUOTE STATUS MANAGEMENT ===
export async function updateQuoteStatus(quoteId, newStatus, userId) {
    if (!quoteId || !newStatus || !userId) {
        showNotification("Dữ liệu không hợp lệ để cập nhật trạng thái.", 'error');
        return;
    }
    const quoteRef = db.collection('users').doc(userId).collection('quotes').doc(quoteId);
    try {
        await quoteRef.update({ status: newStatus });
        showNotification(`Đã cập nhật trạng thái thành "${QUOTE_STATUSES[newStatus]}".`, 'success');
    } catch (error) {
        console.error("Lỗi cập nhật trạng thái:", error);
        const message = error.code === 'permission-denied'
            ? 'Cập nhật thất bại: Không có quyền.'
            : 'Lỗi khi cập nhật trạng thái.';
        showNotification(message, 'error');
    }
}


// === QUOTE & ITEM LOGIC ===

export function startNewQuote(userId) {
    currentQuoteIdInternal = generateSimpleQuoteId('', new Date().toISOString().split('T')[0]);
    DOM.customerNameInput.value = '';
    DOM.customerAddressInput.value = '';
    DOM.quoteDateInput.value = new Date().toISOString().split('T')[0];
    currentQuoteItems = [];
    quoteInstallmentData = [];
    resetQuoteItemFormEditingState();
    renderQuoteItemsPreview();
    calculateTotals(userId);
}

export async function saveCompanySettingsHandler(userId) {
    if (!userId) return;
    const printOptions = {
        title: DOM.printTitleSettingInput.value.trim(),
        creatorName: DOM.printCreatorNameSettingInput.value.trim(),
        footer: DOM.printFooterSettingInput.value.trim()
    };
    
    const settingsData = {
        name: DOM.companyNameSettingInput.value.trim(),
        address: DOM.companyAddressSettingInput.value.trim(),
        phone: DOM.companyPhoneSettingInput.value.trim(),
        email: DOM.companyEmailSettingInput.value.trim(),
        taxId: DOM.companyTaxIdSettingInput.value.trim(),
        bankAccount: DOM.companyBankAccountSetting.value.trim(),
        logoDataUrl: companySettings.logoDataUrl || null,
        defaultQuoteNotes: DOM.defaultNotesSettingInput.value.trim(),
        printOptions: printOptions
    };
    try {
        await db.collection('users').doc(userId).collection('settings').doc('company').set(settingsData, { merge: true });
        showNotification('Đã lưu cài đặt!', 'success');
    } catch (e) {
        console.error("Lỗi lưu cài đặt:", e);
        const message = e.code === 'permission-denied'
            ? 'Lưu cài đặt thất bại: Không có quyền.'
            : 'Lỗi khi lưu cài đặt.';
        showNotification(message, 'error');
    }
}

export async function addOrUpdateItemFromForm(userId) {
    const name = DOM.itemNameQuoteForm.value.trim();
    if (!name) {
        showNotification('Tên hạng mục không được để trống.', 'error');
        return;
    }
    
    const mainCategoryName = DOM.quoteItemMainCategoryInput.value.trim();
    const mainCategoryId = await findOrCreateMainCategory(mainCategoryName, userId);

    const originalPrice = parseFloat(DOM.itemPriceQuoteForm.value) || 0;
    const itemDiscountValue = parseFloat(DOM.itemDiscountValueForm.value) || 0;
    const itemDiscountType = DOM.itemDiscountTypeForm.value;
    const quantity = parseFloat(String(DOM.itemQuantityQuoteForm.value).replace(',', '.')) || 0;

    let itemDiscountAmount = (itemDiscountType === 'percent') 
        ? (originalPrice * itemDiscountValue) / 100 
        : itemDiscountValue;
    const price = originalPrice - itemDiscountAmount;
    
    let calculatedMeasure = 0;
    let baseMeasureForPricing = 1;
     if (DOM.itemCalcTypeQuoteForm.value === 'length' && DOM.itemLengthQuoteForm.value) {
        const length = parseFloat(DOM.itemLengthQuoteForm.value);
        calculatedMeasure = length;
        baseMeasureForPricing = length / 1000;
    } else if (DOM.itemCalcTypeQuoteForm.value === 'area' && DOM.itemLengthQuoteForm.value && DOM.itemHeightQuoteForm.value) {
        const length = parseFloat(DOM.itemLengthQuoteForm.value);
        const height = parseFloat(DOM.itemHeightQuoteForm.value);
        calculatedMeasure = length * height;
        baseMeasureForPricing = (length * height) / 1000000;
    } else if (DOM.itemCalcTypeQuoteForm.value === 'volume' && DOM.itemLengthQuoteForm.value && DOM.itemHeightQuoteForm.value && DOM.itemDepthQuoteForm.value) {
        const length = parseFloat(DOM.itemLengthQuoteForm.value);
        const height = parseFloat(DOM.itemHeightQuoteForm.value);
        const depth = parseFloat(DOM.itemDepthQuoteForm.value);
        calculatedMeasure = length * height * depth;
        baseMeasureForPricing = (length * height * depth) / 1000000000;
    }
    const lineTotal = price * baseMeasureForPricing * quantity;

    const newItemData = {
        name,
        spec: DOM.itemSpecQuoteForm.value.trim(),
        unit: DOM.itemUnitQuoteForm.value.trim(),
        price, originalPrice, itemDiscountValue, itemDiscountType, itemDiscountAmount,
        quantity, lineTotal,
        calcType: DOM.itemCalcTypeQuoteForm.value, 
        length: parseFloat(DOM.itemLengthQuoteForm.value) || null, 
        height: parseFloat(DOM.itemHeightQuoteForm.value) || null,
        depth: parseFloat(DOM.itemDepthQuoteForm.value) || null,
        calculatedMeasure,
        imageDataUrl: itemImageDataBase64QuoteForm,
        notes: DOM.itemNotesQuoteForm.value.trim(),
        mainCategoryId,
    };

    const itemIdToEdit = DOM.editingQuoteItemIdInputForm.value;
    if (itemIdToEdit) {
        const itemIndex = currentQuoteItems.findIndex(i => i.id === itemIdToEdit);
        if(itemIndex > -1) {
            if (!newItemData.imageDataUrl) {
                newItemData.imageDataUrl = currentQuoteItems[itemIndex].imageDataUrl;
            }
            currentQuoteItems[itemIndex] = { ...currentQuoteItems[itemIndex], ...newItemData };
        }
        resetQuoteItemFormEditingState();
    } else {
        currentQuoteItems.push({ id: generateUniqueId('qitem'), ...newItemData });
    }
    
    renderQuoteItemsPreview();
    clearQuoteItemFormInputs();
    await calculateTotals(userId);
}

export function editQuoteItemOnForm(itemId) {
    const item = currentQuoteItems.find(i => i.id === itemId);
    if (item) {
        DOM.editingQuoteItemIdInputForm.value = item.id;
        DOM.itemNameQuoteForm.value = item.name;
        DOM.itemSpecQuoteForm.value = item.spec || '';
        DOM.itemUnitQuoteForm.value = item.unit;
        DOM.itemPriceQuoteForm.value = item.originalPrice;
        DOM.itemDiscountValueForm.value = item.itemDiscountValue || 0;
        DOM.itemDiscountTypeForm.value = item.itemDiscountType || 'percent';
        DOM.itemCalcTypeQuoteForm.value = item.calcType || 'unit';
        DOM.itemLengthQuoteForm.value = item.length || '';
        DOM.itemHeightQuoteForm.value = item.height || '';
        DOM.itemDepthQuoteForm.value = item.depth || '';
        DOM.itemNotesQuoteForm.value = item.notes || '';
        const category = getMainCategories().find(cat => cat.id === item.mainCategoryId);
        DOM.quoteItemMainCategoryInput.value = category ? category.name : '';
        DOM.itemQuantityQuoteForm.value = item.quantity;
        itemImageDataBase64QuoteForm = item.imageDataUrl || null;
        DOM.itemImagePreviewQuoteForm.src = item.imageDataUrl || '#';
        DOM.itemImagePreviewQuoteForm.style.display = item.imageDataUrl ? 'block' : 'none';
        DOM.removeItemImageButtonQuoteForm.style.display = item.imageDataUrl ? 'inline-flex' : 'none';
        DOM.itemImageFileQuoteForm.value = '';
        DOM.addOrUpdateItemButtonForm.textContent = 'Cập nhật H.mục';
        DOM.cancelEditQuoteItemButtonForm.style.display = 'inline-block';
        
        updateDimensionInputsVisibility();
        updateItemLineTotalPreview();
        
        DOM.itemNameQuoteForm.focus();
        DOM.quoteItemEntryFormDiv.scrollIntoView({ behavior: 'smooth' });
    }
}

export async function saveCurrentWorkingQuoteToFirestore(userId) {
    if (!userId) return;
    const quoteData = {
        id: currentQuoteIdInternal,
        customerName: DOM.customerNameInput.value,
        customerAddress: DOM.customerAddressInput.value,
        quoteDate: DOM.quoteDateInput.value,
        items: currentQuoteItems,
        applyDiscount: DOM.applyDiscountCheckbox.checked,
        discountValue: DOM.discountValueInput.value,
        discountType: DOM.discountTypeSelect.value,
        applyTax: DOM.applyTaxCheckbox.checked,
        taxPercent: DOM.taxPercentInput.value,
        applyInstallments: DOM.applyInstallmentsCheckbox.checked,
        installments: quoteInstallmentData, 
        timestamp: Date.now()
    };
    try {
        await db.collection('users').doc(userId).collection('ux').doc('currentQuote').set(quoteData);
    } catch (e) {
        console.error("Lỗi lưu báo giá nháp:", e);
    }
};

function createItemRowHTML(item, itemIndex) {
    let displayNameCellContent = `<span class="item-name-display">${(item.name || '[Chưa có tên]').toUpperCase()}</span>`;
    let dimParts = [];
    if (item.length) dimParts.push(`D ${item.length}mm`);
    if (item.height) dimParts.push(`C ${item.height}mm`);
    if (item.depth) dimParts.push(`S ${item.depth}mm`);
    const dimensionsString = dimParts.join(' x ');
    if (dimensionsString) {
        displayNameCellContent += `<br><span class="item-dimensions-display">KT: ${dimensionsString}</span>`;
    }
    if (item.spec) displayNameCellContent += `<br><span class="item-spec-display">${item.spec}</span>`;
    const imgSrc = item.imageDataUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    let displayedMeasureText = '';
    if (item.calculatedMeasure && typeof item.calculatedMeasure === 'number' && item.calcType !== 'unit') {
        let measureInMeters = item.calculatedMeasure;
        if (item.calcType === 'length') measureInMeters /= 1000;
        else if (item.calcType === 'area') measureInMeters /= 1000000;
        else if (item.calcType === 'volume') measureInMeters /= 1000000000;
        displayedMeasureText = `${parseFloat(measureInMeters.toFixed(4)).toLocaleString('vi-VN')}`;
    }
    let priceCellContent = `<strong>${(item.price || 0).toLocaleString('vi-VN')}</strong>`;
    if ((item.itemDiscountAmount || 0) > 0) {
        let discountText = '';
        if (item.itemDiscountType === 'percent' && (item.itemDiscountValue || 0) > 0) {
            discountText = `<span class="item-discount-percent" style="font-size: 0.8em; color: var(--danger-color); font-style: italic;"> (-${item.itemDiscountValue}%)</span>`;
        }
        priceCellContent = `
            <span class="strikethrough-price">${(item.originalPrice || 0).toLocaleString('vi-VN')}</span><br>
            <strong>${(item.price || 0).toLocaleString('vi-VN')}</strong>${discountText}
        `;
    }
    return `
        <tr id="qitem-display-${item.id}" data-id="${item.id}" data-type="quoteItem">
            <td style="text-align: center;">${itemIndex}</td>
            <td><img src="${imgSrc}" alt="Ảnh" class="item-image-preview-table" style="display:${item.imageDataUrl ? 'block' : 'none'};"></td>
            <td class="item-name-spec-cell">${displayNameCellContent}</td>
            <td style="text-align: center;">${item.unit || ''}</td>
            <td style="text-align: right;">${displayedMeasureText}</td>
            <td style="text-align: right;">${(item.quantity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
            <td style="text-align: right;">${priceCellContent}</td>
            <td style="text-align: right;">${(item.lineTotal || 0).toLocaleString('vi-VN')}</td>
            <td class="item-notes-cell">${item.notes || ''}</td>
            <td class="no-print action-trigger-cell">
                 <button class="action-trigger" data-item-id="${item.id}" data-item-type="quoteItem" title="Hành động">⋮</button>
            </td>
        </tr>`;
}

function clearQuoteItemFormInputs(focusOnName = true) {
    DOM.itemNameQuoteForm.value = '';
    DOM.itemSpecQuoteForm.value = '';
    DOM.itemUnitQuoteForm.value = '';
    DOM.itemPriceQuoteForm.value = '';
    DOM.itemDiscountValueForm.value = '0';
    DOM.itemDiscountTypeForm.value = 'percent';
    DOM.itemCalcTypeQuoteForm.value = 'unit';
    DOM.itemLengthQuoteForm.value = '';
    DOM.itemHeightQuoteForm.value = '';
    DOM.itemDepthQuoteForm.value = '';
    DOM.itemQuantityQuoteForm.value = '1';
    DOM.itemImageFileQuoteForm.value = '';
    DOM.itemImagePreviewQuoteForm.style.display = 'none';
    DOM.itemImagePreviewQuoteForm.src = '#';
    DOM.removeItemImageButtonQuoteForm.style.display = 'none';
    itemImageDataBase64QuoteForm = null;
    DOM.quoteItemMainCategoryInput.value = "";

    updateDimensionInputsVisibility();
    updateItemLineTotalPreview();
    
    if (focusOnName) DOM.itemNameQuoteForm.focus();
}

export async function deleteQuoteItem(itemId, userId) {
        if (DOM.editingQuoteItemIdInputForm.value === itemId) resetQuoteItemFormEditingState();
        currentQuoteItems = currentQuoteItems.filter(item => item.id !== itemId);
        renderQuoteItemsPreview();
        await calculateTotals(userId);
}
export async function saveCurrentQuoteToListHandler(userId) {
    if (!userId || currentQuoteItems.length === 0) {
        showNotification("Chưa có hạng mục nào trong báo giá.", "error");
        return;
    }
    const internalId = currentQuoteIdInternal || generateSimpleQuoteId(DOM.customerNameInput.value, DOM.quoteDateInput.value);
    const suggestedName = DOM.customerNameInput.value
        ? `${DOM.customerNameInput.value} - ${internalId}`
        : internalId;
    const quoteIdToSave = prompt("Nhập ID/Tên để lưu báo giá này:", suggestedName);
    if (!quoteIdToSave) return;
    const totals = await calculateTotals(userId, false);
    const quoteDataToSave = {
        id: quoteIdToSave,
        customerName: DOM.customerNameInput.value,
        customerAddress: DOM.customerAddressInput.value,
        quoteDate: DOM.quoteDateInput.value,
        items: currentQuoteItems,
        applyDiscount: totals.applyDiscount,
        discountValue: totals.discountValue,
        discountType: totals.discountType,
        applyTax: totals.applyTax,
        taxPercent: totals.taxPercent,
        applyInstallments: DOM.applyInstallmentsCheckbox.checked,
        installments: quoteInstallmentData,
        status: 'draft',
        timestamp: Date.now()
    };
    try {
        await db.collection('users').doc(userId).collection('quotes').doc(quoteIdToSave).set(quoteDataToSave);
        showNotification(`Báo giá "${quoteIdToSave}" đã được lưu.`, 'success');
    } catch (e) {
        console.error("Lỗi lưu báo giá:", e);
        const message = e.code === 'permission-denied'
            ? 'Lưu thất bại: Không có quyền.'
            : 'Lỗi khi lưu báo giá.';
        showNotification(message, 'error');
    } 
}
export async function deleteQuoteFromList(quoteIdToDelete, userId) {
    if (!userId) return;
        try {
            await db.collection('users').doc(userId).collection('quotes').doc(quoteIdToDelete).delete();
            showNotification('Đã xóa báo giá.', 'success');
        } catch (e) {
            console.error("Lỗi xóa báo giá:", e);
            const message = e.code === 'permission-denied'
                ? 'Xóa thất bại: Không có quyền.'
                : 'Lỗi khi xóa báo giá.';
            showNotification(message, 'error');
        }
}
export async function loadQuoteFromList(quoteIdToLoad, userId) {
    try {
        const docRef = db.collection('users').doc(userId).collection('quotes').doc(quoteIdToLoad);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            await db.collection('users').doc(userId).collection('ux').doc('currentQuote').set(docSnap.data());
            showNotification(`Đã tải báo giá "${quoteIdToLoad}" vào trang soạn thảo.`, 'info');
        } else {
            showNotification("Không tìm thấy báo giá này.", 'error');
        }
    } catch (error) {
        console.error("Lỗi khi tải báo giá:", error);
        let message = 'Lỗi khi tải báo giá.';
        if(error.code === 'permission-denied') {
            message = 'Bạn không có quyền truy cập báo giá này.';
        } else if (error.code === 'not-found') {
            message = 'Không tìm thấy báo giá này trong cơ sở dữ liệu.';
        }
        showNotification(message, 'error');
    } 
}
export async function duplicateQuote(originalQuoteId, userId) {
    if (!originalQuoteId || !userId) {
        showNotification("Không thể tìm thấy báo giá gốc.", 'error');
        return;
    }
    const originalQuote = savedQuotes.find(q => q.id === originalQuoteId);
    if (!originalQuote) {
        showNotification("Không tìm thấy dữ liệu báo giá gốc.", 'error');
        return;
    }
    const newQuote = { ...originalQuote };
    newQuote.id = `(Bản sao) ${originalQuote.id}`;
    newQuote.status = 'draft';
    newQuote.timestamp = Date.now();
    newQuote.quoteDate = new Date().toISOString().split('T')[0];
    try {
        await db.collection('users').doc(userId).collection('quotes').doc(newQuote.id).set(newQuote);
        await db.collection('users').doc(userId).collection('ux').doc('currentQuote').set(newQuote);
        showNotification(`Đã nhân bản và tải báo giá "${originalQuote.id}".`, 'success');
    } catch (error) {
        console.error("Lỗi nhân bản báo giá:", error);
        showNotification("Không thể nhân bản báo giá.", 'error');
    } 
}
function renderQuoteItemsPreview() {
    const mainCategories = getMainCategories();
    const groupedItems = new Map();
    const itemsWithoutCategory = [];
    let tableHTML = '';
    currentQuoteItems.forEach(item => {
        const category = mainCategories.find(cat => cat.id === item.mainCategoryId);
        if (category) {
            if (!groupedItems.has(item.mainCategoryId)) {
                groupedItems.set(item.mainCategoryId, []);
            }
            groupedItems.get(item.mainCategoryId).push(item);
        } else {
            itemsWithoutCategory.push(item);
        }
    });
    let itemCounter = 0;
    let categoryCounter = 0;
    mainCategories.forEach(category => {
        if (groupedItems.has(category.id)) {
            categoryCounter++;
            const itemsInCategory = groupedItems.get(category.id);
            const categoryTotal = itemsInCategory.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
            tableHTML += `
                <tr class="main-category-row">
                    <td class="main-category-roman-numeral">${numberToRoman(categoryCounter)}</td>
                    <td colspan="7" class="main-category-name">${category.name}</td>
                    <td class="main-category-total">${categoryTotal.toLocaleString('vi-VN')}</td>
                    <td class="no-print"></td>
                </tr>
            `;
            itemsInCategory.forEach(item => {
                itemCounter++;
                tableHTML += createItemRowHTML(item, itemCounter);
            });
        }
    });
    if (itemsWithoutCategory.length > 0) {
        itemsWithoutCategory.forEach(item => {
            itemCounter++;
            tableHTML += createItemRowHTML(item, itemCounter);
        });
    }
    DOM.itemListPreviewTableBody.innerHTML = tableHTML;
}
export function renderSavedQuotesList() {
    const searchTerm = DOM.savedQuotesSearchInput.value.toLowerCase();
    const startDate = DOM.savedQuotesStartDateFilter.value ? new Date(DOM.savedQuotesStartDateFilter.value) : null;
    if(startDate) startDate.setHours(0,0,0,0);
    const endDate = DOM.savedQuotesEndDateFilter.value ? new Date(DOM.savedQuotesEndDateFilter.value) : null;
    if(endDate) endDate.setHours(23,59,59,999);
    const minTotal = DOM.savedQuotesMinTotalFilter.value ? parseFloat(DOM.savedQuotesMinTotalFilter.value) : null;
    const maxTotal = DOM.savedQuotesMaxTotalFilter.value ? parseFloat(DOM.savedQuotesMaxTotalFilter.value) : null;
    const status = DOM.savedQuotesStatusFilter.value;

    let tableHTML = '';
    const filteredQuotes = savedQuotes.filter(quote => {
        // 1. Search term
        const quoteId = quote.id ? quote.id.toLowerCase() : '';
        const customerName = quote.customerName ? quote.customerName.toLowerCase() : '';
        const searchMatch = !searchTerm || quoteId.includes(searchTerm) || customerName.includes(searchTerm);
        if (!searchMatch) return false;

        // 2. Date
        const quoteDate = quote.quoteDate ? new Date(quote.quoteDate) : (quote.timestamp ? new Date(quote.timestamp) : null);
        const dateMatch = (!startDate || (quoteDate && quoteDate >= startDate)) && (!endDate || (quoteDate && quoteDate <= endDate));
        if (!dateMatch) return false;
        
        // 3. Status
        const statusMatch = status === 'all' || (quote.status || 'draft') === status;
        if (!statusMatch) return false;

        // 4. Total value
        const total = calculateQuoteTotal(quote);
        const minMatch = minTotal === null || total >= minTotal;
        const maxMatch = maxTotal === null || total <= maxTotal;
        if (!minMatch || !maxMatch) return false;

        return true;
    });

    if (filteredQuotes.length === 0) {
        const message = savedQuotes.length > 0 ? 'Không tìm thấy báo giá phù hợp.' : 'Chưa có báo giá nào được lưu.';
        tableHTML = `<tr><td colspan="6" style="text-align:center;">${message}</td></tr>`;
    } else {
        filteredQuotes.forEach(quote => {
            const total = calculateQuoteTotal(quote);
            const currentStatus = quote.status || 'draft';
            const statusText = QUOTE_STATUSES[currentStatus] || 'Không xác định';
            let statusOptions = '';
            Object.keys(QUOTE_STATUSES).forEach(key => {
                statusOptions += `<option value="${key}" ${key === currentStatus ? 'selected' : ''}>${QUOTE_STATUSES[key]}</option>`;
            });
            tableHTML += `
                <tr data-id="${quote.id}" data-type="savedQuote">
                    <td>${quote.id}</td>
                    <td>${quote.customerName || ''}</td>
                    <td>${formatDate(quote.quoteDate || quote.timestamp)}</td>
                    <td>${formatCurrency(total)}</td>
                    <td class="status-cell">
                        <span class="status-badge status-${currentStatus}">${statusText}</span>
                        <select class="status-select-action" data-id="${quote.id}">
                            ${statusOptions}
                        </select>
                    </td>
                    <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${quote.id}" data-item-type="savedQuote" title="Hành động">⋮</button>
                    </td>
                </tr>`;
        });
    }
    DOM.savedQuotesTableBody.innerHTML = tableHTML;
}
function calculateQuoteTotal(quoteData) {
    if (!quoteData || !quoteData.items) return 0;
    const subTotal = quoteData.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    const useDiscount = typeof quoteData.applyDiscount === 'boolean' ? quoteData.applyDiscount : true;
    let discountAmount = 0;
    const discountValue = parseFloat(quoteData.discountValue) || 0;
    if (useDiscount && discountValue > 0) {
        discountAmount = quoteData.discountType === 'percent'
            ? (subTotal * discountValue) / 100
            : discountValue;
    }
    const subTotalAfterDiscount = subTotal - discountAmount;
    const useTax = typeof quoteData.applyTax === 'boolean' ? quoteData.applyTax : true;
    const taxAmount = useTax
        ? (subTotalAfterDiscount * (parseFloat(quoteData.taxPercent) || 0)) / 100
        : 0;
    return subTotalAfterDiscount + taxAmount;
}

function calculateProfitAnalysis(grandTotal) {
    const savedCostings = getSavedCostingSheets();
    let totalCogs = 0;

    currentQuoteItems.forEach(item => {
        // Find a matching costing sheet (case-insensitive)
        const matchedCosting = savedCostings.find(costing =>
            costing.productName.toLowerCase() === item.name.toLowerCase()
        );
        if (matchedCosting) {
            totalCogs += (matchedCosting.unitCost || 0) * (item.quantity || 0);
        }
    });

    const grossProfit = grandTotal - totalCogs;
    const grossProfitMargin = grandTotal > 0 ? (grossProfit / grandTotal) * 100 : 0;

    DOM.estimatedTotalCogsSpan.textContent = formatCurrency(totalCogs);
    DOM.estimatedGrossProfitSpan.textContent = formatCurrency(grossProfit);
    DOM.grossProfitMarginPercentSpan.textContent = `${grossProfitMargin.toFixed(1)} %`;
}

export async function calculateTotals(userId, shouldSave = true) {
    const quoteDataForCalculation = {
        items: currentQuoteItems,
        applyDiscount: DOM.applyDiscountCheckbox.checked,
        discountValue: parseFloat(DOM.discountValueInput.value) || 0,
        discountType: DOM.discountTypeSelect.value,
        applyTax: DOM.applyTaxCheckbox.checked,
        taxPercent: parseFloat(DOM.taxPercentInput.value) || 0,
    };
    const subTotal = quoteDataForCalculation.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    const useDiscount = quoteDataForCalculation.applyDiscount;
    const discountValue = quoteDataForCalculation.discountValue;
    const discountType = quoteDataForCalculation.discountType;
    const useTax = quoteDataForCalculation.applyTax;
    const taxPercent = quoteDataForCalculation.taxPercent;
    let discountAmount = 0;
    if (useDiscount && discountValue > 0) {
        discountAmount = discountType === 'percent' ? (subTotal * discountValue) / 100 : discountValue;
    }
    const subTotalAfterDiscount = subTotal - discountAmount;
    const taxAmount = useTax ? (subTotalAfterDiscount * taxPercent) / 100 : 0;
    const grandTotal = subTotalAfterDiscount + taxAmount;
    DOM.subTotalSpan.textContent = formatCurrency(subTotal);
    DOM.discountAmountSpan.textContent = `(${formatCurrency(discountAmount)})`;
    DOM.taxAmountSpan.textContent = `(${formatCurrency(taxAmount)})`;
    DOM.totalPriceSpan.textContent = formatCurrency(grandTotal);

    calculateProfitAnalysis(grandTotal);
    renderInstallments(grandTotal);

    if (userId && shouldSave) {
        await saveCurrentWorkingQuoteToFirestore(userId);
    }
    return {
        subTotal, discountAmount, subTotalAfterDiscount, taxAmount, grandTotal,
        taxPercent, applyDiscount: useDiscount, applyTax: useTax,
        discountValue, discountType
    };
}
function renderInstallments(grandTotal) {
    const isEnabled = DOM.applyInstallmentsCheckbox.checked;
    DOM.installmentsContainer.style.display = isEnabled ? 'block' : 'none'; // Changed to block
    DOM.addInstallmentButton.style.display = isEnabled ? 'inline-block' : 'none';
    if (!isEnabled) return;
    DOM.installmentsListContainer.innerHTML = '';
    let totalPercent = 0;
    let totalAmount = 0;
    quoteInstallmentData.forEach((inst, index) => {
        const row = document.createElement('div');
        row.className = 'installment-row';
        const amount = inst.value > 0
            ? (inst.type === 'percent' ? (grandTotal * inst.value) / 100 : inst.value)
            : 0;
        totalAmount += amount;
        if (inst.type === 'percent') {
            totalPercent += inst.value;
        }
        row.innerHTML = `
            <input type="text" class="installment-name" value="${inst.name}" data-index="${index}" data-field="name" placeholder="Nội dung đợt ${index + 1}">
            <input type="number" class="installment-value" value="${inst.value}" data-index="${index}" data-field="value" placeholder="Giá trị" min="0">
            <select class="installment-type" data-index="${index}" data-field="type">
                <option value="percent" ${inst.type === 'percent' ? 'selected' : ''}>%</option>
                <option value="amount" ${inst.type === 'amount' ? 'selected' : ''}>VNĐ</option>
            </select>
            <span class="installment-amount-display">${formatCurrency(amount)}</span>
            <button class="remove-installment-btn" data-index="${index}" title="Xóa đợt này">&times;</button>
        `;
        DOM.installmentsListContainer.appendChild(row);
    });
    const remainingAmount = grandTotal - totalAmount;
    DOM.installmentsSummaryDiv.innerHTML = `
        <span>Tổng %: <strong>${totalPercent}%</strong></span>
        <span>Tổng cộng các đợt: <strong id="installmentsTotalAmount">${formatCurrency(totalAmount)}</strong></span>
        <span>Còn lại: <strong id="installmentsRemainingAmount" style="color:${remainingAmount === 0 ? 'green' : 'red'};">${formatCurrency(remainingAmount)}</strong></span>
    `;
}
export function addInstallment() {
    quoteInstallmentData.push({
        name: `Đợt ${quoteInstallmentData.length + 1}`,
        value: 0,
        type: 'percent'
    });
    calculateTotals(auth.currentUser?.uid);
}
export function removeInstallment(index) {
    quoteInstallmentData.splice(index, 1);
    calculateTotals(auth.currentUser?.uid);
}
export function handleInstallmentChange(event) {
    const target = event.target;
    const index = target.dataset.index;
    const field = target.dataset.field;
    if (index === undefined || field === undefined) return;
    const value = target.type === 'number' ? parseFloat(target.value) || 0 : target.value;
    quoteInstallmentData[index][field] = value;
    calculateTotals(auth.currentUser?.uid);
}
export function resetQuoteItemFormEditingState() {
    DOM.editingQuoteItemIdInputForm.value = '';
    DOM.addOrUpdateItemButtonForm.textContent = 'Thêm Item';
    DOM.cancelEditQuoteItemButtonForm.style.display = 'none';
    clearQuoteItemFormInputs(false);
    updateDimensionInputsVisibility();
    updateItemLineTotalPreview();
}
export function prepareNewQuoteItemHandler() {
    resetQuoteItemFormEditingState();
    DOM.quoteItemEntryFormDiv.scrollIntoView({ behavior: 'smooth' });
}
export function clearQuoteFormHandler(userId) {
    if (confirm('Làm mới Form? Dữ liệu nháp chưa lưu sẽ bị mất.')) {
        startNewQuote(userId);
    }
}
export async function quickSaveToCatalogFromFormHandler(userId) {
    const itemData = {
        name: DOM.itemNameQuoteForm.value.trim(),
        spec: DOM.itemSpecQuoteForm.value.trim(),
        unit: DOM.itemUnitQuoteForm.value.trim(),
        price: parseFloat(DOM.itemPriceQuoteForm.value) || 0,
    };
    if (!itemData.name) {
        showNotification("Cần có tên hạng mục để lưu.", "error");
        return;
    }
    await saveItemToMasterCatalog(itemData, userId);
}
export async function saveThisQuoteItemToMasterCatalog(quoteItemId, userId) {
    const item = currentQuoteItems.find(i => i.id === quoteItemId);
    if (item) {
        const { name, spec, unit, originalPrice, mainCategoryId } = item;
        await saveItemToMasterCatalog({ name, spec, unit, price: originalPrice, mainCategoryId }, userId);
    }
}

// === TEMPLATE MANAGEMENT ===
export function listenToQuoteTemplates(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection(QUOTE_TEMPLATES_COLLECTION).orderBy('name');
    const unsubscribe = query.onSnapshot(snapshot => {
        quoteTemplates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQuoteTemplatesList(quoteTemplates);
        populateCreateFromTemplateSelect(quoteTemplates);
    }, error => console.error("Lỗi lắng nghe mẫu báo giá:", error));
    return unsubscribe;
}

export async function saveQuoteAsTemplateHandler(userId) {
    if (!userId) return;
    if (currentQuoteItems.length === 0) {
        showNotification("Báo giá hiện tại trống, không thể lưu làm mẫu.", 'info');
        return;
    }
    const templateName = prompt("Nhập tên cho mẫu báo giá này:", "Mẫu Báo Giá Mới");
    if (!templateName || templateName.trim() === "") {
        showNotification("Tên mẫu không hợp lệ.", "info");
        return;
    }
    const templateData = {
        name: templateName.trim(),
        items: currentQuoteItems,
        applyDiscount: DOM.applyDiscountCheckbox.checked,
        discountValue: DOM.discountValueInput.value,
        discountType: DOM.discountTypeSelect.value,
        applyTax: DOM.applyTaxCheckbox.checked,
        taxPercent: DOM.taxPercentInput.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('users').doc(userId).collection(QUOTE_TEMPLATES_COLLECTION).add(templateData);
        showNotification(`Đã lưu mẫu báo giá "${templateName.trim()}".`, 'success');
    } catch (e) {
        console.error("Lỗi lưu mẫu BG:", e);
        showNotification('Lưu mẫu báo giá thất bại.', 'error');
    }
}

export async function loadQuoteFromTemplate(templateId, userId) {
    if (!templateId || !userId) return;
    try {
        const docRef = db.collection('users').doc(userId).collection(QUOTE_TEMPLATES_COLLECTION).doc(templateId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const template = docSnap.data();
            currentQuoteItems = template.items.map(item => ({ ...item, id: generateUniqueId('qitem') }));
            DOM.applyDiscountCheckbox.checked = template.applyDiscount;
            DOM.discountValueInput.value = template.discountValue;
            DOM.discountTypeSelect.value = template.discountType;
            DOM.applyTaxCheckbox.checked = template.applyTax;
            DOM.taxPercentInput.value = template.taxPercent;
            await calculateTotals(userId);
            showNotification(`Đã tải dữ liệu từ mẫu "${template.name}".`, 'success');
        }
    } catch (e) {
        console.error("Lỗi tải mẫu BG:", e);
        showNotification('Lỗi khi tải mẫu báo giá.', 'error');
    }
}

export async function deleteQuoteTemplate(templateId, userId) {
    if (!templateId || !userId) return;
    try {
        await db.collection('users').doc(userId).collection(QUOTE_TEMPLATES_COLLECTION).doc(templateId).delete();
        showNotification("Đã xóa mẫu báo giá.", "success");
    } catch (e) {
        console.error("Lỗi xóa mẫu BG:", e);
        showNotification('Xóa mẫu báo giá thất bại.', 'error');
    }
}

export async function renameQuoteTemplate(templateId, userId) {
    if (!templateId || !userId) return;
    const template = quoteTemplates.find(t => t.id === templateId);
    if (!template) return;
    const newName = prompt("Nhập tên mới cho mẫu:", template.name);
    if (newName && newName.trim() !== "") {
        try {
            await db.collection('users').doc(userId).collection(QUOTE_TEMPLATES_COLLECTION).doc(templateId).update({ name: newName.trim() });
            showNotification("Đã đổi tên mẫu.", "success");
        } catch (e) {
            console.error("Lỗi đổi tên mẫu BG:", e);
            showNotification('Đổi tên mẫu thất bại.', 'error');
        }
    }
}

function renderQuoteTemplatesList(templates) {
    let html = '';
    if (templates.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;">Chưa có mẫu báo giá nào.</td></tr>';
    } else {
        templates.forEach((template, index) => {
            html += `
                <tr data-id="${template.id}" data-type="quoteTemplate">
                    <td>${index + 1}</td>
                    <td>${template.name}</td>
                    <td style="text-align:right;">${template.items.length}</td>
                    <td style="text-align:center;">${formatDate(template.createdAt.toDate())}</td>
                    <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${template.id}" data-item-type="quoteTemplate" title="Hành động">⋮</button>
                    </td>
                </tr>`;
        });
    }
    DOM.quoteTemplatesTableBody.innerHTML = html;
    DOM.quoteTemplateCountSpan.textContent = templates.length;
}

function populateCreateFromTemplateSelect(templates) {
    DOM.createQuoteFromTemplateSelect.innerHTML = '<option value="">-- Chọn mẫu báo giá --</option>';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        DOM.createQuoteFromTemplateSelect.appendChild(option);
    });
}

/**
 * Re-evaluates the category input field on the quote form.
 * This is called by an event listener when category data is updated,
 * fixing a race condition where the form might be in edit mode
 * before categories have loaded.
 */
export function refreshQuoteFormCategory() {
    const editingId = DOM.editingQuoteItemIdInputForm.value;
    if (editingId) {
        // Find the item being edited
        const item = currentQuoteItems.find(i => i.id === editingId);
        // Check if the input is currently empty (meaning it failed to populate before)
        if (item && DOM.quoteItemMainCategoryInput.value === '') {
            const category = getMainCategories().find(cat => cat.id === item.mainCategoryId);
            if (category) {
                DOM.quoteItemMainCategoryInput.value = category.name;
            }
        }
    }
}

// --- ITEM NAME SUGGESTIONS ---

function showQuoteItemNameSuggestions(inputText) {
    const container = DOM.itemNameSuggestionsContainer;
    if (!container || !DOM.itemNameQuoteForm) return;

    const lowerInputText = (inputText || '').toLowerCase(); // Ensure it's a string

    let suggestions = [];
    const addedNames = new Set(); // To avoid duplicates

    // 1. Get from Catalog
    const catalogItems = getLoadedCatalog();
    catalogItems.forEach(item => {
        // The .includes check handles both empty and non-empty strings correctly
        if (item.name && item.name.toLowerCase().includes(lowerInputText) && !addedNames.has(item.name.toLowerCase())) {
            suggestions.push({
                id: item.id,
                name: item.name,
                source: 'catalog',
                details: `${item.unit || ''} - ${formatCurrency(item.price)}`,
                itemData: item
            });
            addedNames.add(item.name.toLowerCase());
        }
    });

    // 2. Get from Saved Costing Sheets
    const costingSheets = getSavedCostingSheets();
    costingSheets.forEach(sheet => {
        if (sheet.productName && sheet.productName.toLowerCase().includes(lowerInputText) && !addedNames.has(sheet.productName.toLowerCase())) {
            suggestions.push({
                id: sheet.id,
                name: sheet.productName,
                source: 'costing',
                details: `(Giá Vốn) - ${formatCurrency(sheet.unitCost)}`,
                itemData: sheet
            });
            addedNames.add(sheet.productName.toLowerCase());
        }
    });

    suggestions.sort((a, b) => a.name.localeCompare(b.name));
    suggestions = suggestions.slice(0, 10); // Limit to 10 suggestions

    if (suggestions.length > 0) {
        const regex = new RegExp(`(${inputText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        container.innerHTML = suggestions.map(s => {
            // Only highlight if there's text to highlight
            const highlightedName = inputText ? s.name.replace(regex, '<strong>$1</strong>') : s.name;
            const sourceText = s.source === 'catalog' ? '(Danh Mục)' : '(Phiếu Giá Thành)';
            return `<div class="suggestion-item" data-id="${s.id}" data-source="${s.source}">
                        ${highlightedName} <em class="suggestion-source">${sourceText}</em>
                        <span class="suggestion-details">${s.details}</span>
                    </div>`;
        }).join('');
        container.style.display = 'block';
        // Position it correctly
        container.style.top = `${DOM.itemNameQuoteForm.offsetTop + DOM.itemNameQuoteForm.offsetHeight + 2}px`;
        container.style.left = `${DOM.itemNameQuoteForm.offsetLeft}px`;
        container.style.width = `${DOM.itemNameQuoteForm.offsetWidth}px`;
    } else {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

function selectQuoteItemNameSuggestion(itemId, source) {
    let selectedItem = null;
    if (source === 'catalog') {
        selectedItem = getLoadedCatalog().find(item => item.id === itemId);
        if (selectedItem) {
            DOM.itemNameQuoteForm.value = selectedItem.name;
            DOM.itemSpecQuoteForm.value = selectedItem.spec || '';
            DOM.itemUnitQuoteForm.value = selectedItem.unit || '';
            DOM.itemPriceQuoteForm.value = selectedItem.price || 0;
            const category = getMainCategories().find(cat => cat.id === selectedItem.mainCategoryId);
            DOM.quoteItemMainCategoryInput.value = category ? category.name : '';
        }
    } else if (source === 'costing') {
        selectedItem = getSavedCostingSheets().find(sheet => sheet.id === itemId);
        if (selectedItem) {
            DOM.itemNameQuoteForm.value = selectedItem.productName;
            DOM.itemSpecQuoteForm.value = ''; 
            DOM.itemUnitQuoteForm.value = 'bộ'; // Default unit for a product
            DOM.itemPriceQuoteForm.value = selectedItem.unitCost || 0;
            DOM.quoteItemMainCategoryInput.value = '';
        }
    }

    if (DOM.itemNameSuggestionsContainer) {
        DOM.itemNameSuggestionsContainer.innerHTML = '';
        DOM.itemNameSuggestionsContainer.style.display = 'none';
    }
    DOM.itemSpecQuoteForm.focus();
}

export function initQuoteTabEventListeners() {
    DOM.itemNameQuoteForm?.addEventListener('input', (e) => showQuoteItemNameSuggestions(e.target.value));
    DOM.itemNameQuoteForm?.addEventListener('focus', (e) => {
        // Always show suggestions on focus to act as a filter
        showQuoteItemNameSuggestions(e.target.value);
    });
    DOM.itemNameQuoteForm?.addEventListener('blur', () => {
        setTimeout(() => {
            if (DOM.itemNameSuggestionsContainer && !DOM.itemNameSuggestionsContainer.contains(document.activeElement)) {
                DOM.itemNameSuggestionsContainer.style.display = 'none';
            }
        }, 150);
    });
    DOM.itemNameSuggestionsContainer?.addEventListener('mousedown', (e) => {
        const target = e.target.closest('.suggestion-item');
        if (target && target.dataset.id && target.dataset.source) {
            e.preventDefault(); 
            selectQuoteItemNameSuggestion(target.dataset.id, target.dataset.source);
        }
    });
}

// --- NEWLY ADDED FUNCTIONS FOR INTERACTIVITY ---

export function updateDimensionInputsVisibility() {
    const calcType = DOM.itemCalcTypeQuoteForm.value;
    DOM.groupItemLengthQuoteForm.style.display = ['length', 'area', 'volume'].includes(calcType) ? 'block' : 'none';
    DOM.groupItemHeightQuoteForm.style.display = ['area', 'volume'].includes(calcType) ? 'block' : 'none';
    DOM.groupItemDepthQuoteForm.style.display = calcType === 'volume' ? 'block' : 'none';
}

export function removeQuoteItemImage() {
    itemImageDataBase64QuoteForm = null;
    DOM.itemImageFileQuoteForm.value = '';
    DOM.itemImagePreviewQuoteForm.src = '#';
    DOM.itemImagePreviewQuoteForm.style.display = 'none';
    DOM.removeItemImageButtonQuoteForm.style.display = 'none';
}

export function updateItemLineTotalPreview() {
    const originalPrice = parseFloat(DOM.itemPriceQuoteForm.value) || 0;
    const itemDiscountValue = parseFloat(DOM.itemDiscountValueForm.value) || 0;
    const itemDiscountType = DOM.itemDiscountTypeForm.value;
    const quantity = parseFloat(String(DOM.itemQuantityQuoteForm.value).replace(',', '.')) || 0;
    
    let itemDiscountAmount = (itemDiscountType === 'percent') 
        ? (originalPrice * itemDiscountValue) / 100 
        : itemDiscountValue;
    const price = originalPrice - itemDiscountAmount;
    
    let baseMeasureForPricing = 1;
    if (DOM.itemCalcTypeQuoteForm.value === 'length') {
        baseMeasureForPricing = (parseFloat(DOM.itemLengthQuoteForm.value) || 0) / 1000;
    } else if (DOM.itemCalcTypeQuoteForm.value === 'area') {
        const length = parseFloat(DOM.itemLengthQuoteForm.value) || 0;
        const height = parseFloat(DOM.itemHeightQuoteForm.value) || 0;
        baseMeasureForPricing = (length * height) / 1000000;
    } else if (DOM.itemCalcTypeQuoteForm.value === 'volume') {
        const length = parseFloat(DOM.itemLengthQuoteForm.value) || 0;
        const height = parseFloat(DOM.itemHeightQuoteForm.value) || 0;
        const depth = parseFloat(DOM.itemDepthQuoteForm.value) || 0;
        baseMeasureForPricing = (length * height * depth) / 1000000000;
    }

    const lineTotal = price * baseMeasureForPricing * quantity;
    DOM.itemLineTotalPreviewForm.textContent = formatCurrency(lineTotal);
}
