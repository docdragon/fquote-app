
/**
 * @file main.js
 * @description Điểm khởi đầu của ứng dụng (Entry Point).
 */

import * as DOM from './dom.js';
import { auth, db } from './firebase.js';
import { setupUI, initAuthForms } from './auth.js';
import { formatDate, formatRemainingDays } from './utils.js';
import * as Admin from './admin.js';
import * as UI from './ui.js'; 
import * as Catalog from './catalog.js';
import * as Quote from './quote.js';
import * as Costing from './costing.js';
import { showNotification } from './notifications.js';


document.addEventListener('DOMContentLoaded', () => {
    let dataInitializedForUser = null; 
    let unsubscribeListeners = [];

    const authElements = {
        authModal: document.getElementById('auth-modal'),
        appContainer: document.getElementById('app-container'),
        authStatusEl: document.getElementById('auth-status'),
        logoutButton: document.getElementById('logoutButton'),
        loginForm: document.getElementById('login-form'),
        signupForm: document.getElementById('signup-form'),
        loginErrorEl: document.getElementById('login-error'),
        signupErrorEl: document.getElementById('signup-error'),
        showSignupLink: document.getElementById('show-signup'),
        showLoginLink: document.getElementById('show-login')
    };

    initAuthForms(authElements); 
    setupAppEventListeners();
    
    auth.onAuthStateChanged(async (user) => {
        setupUI(user, authElements); 
        
        const adminTab = document.getElementById('admin-tab');
        if (adminTab) {
            adminTab.style.display = 'none';
        }

        if (unsubscribeListeners.length > 0) {
            console.log("Cleaning up old listeners.");
            unsubscribeListeners.forEach(unsubscribe => unsubscribe());
            unsubscribeListeners = [];
        }

        if (user) {
            user.getIdTokenResult(true)
                .then((idTokenResult) => {
                    const isAdmin = idTokenResult.claims.admin === true;
                    if (adminTab) {
                        adminTab.style.display = isAdmin ? 'block' : 'none';
                    }
                })
                .catch((error) => {
                    console.error("Error getting user token:", error);
                });

            const isAllowed = await checkAndSetupAccount(user);
            if (!isAllowed) {
                dataInitializedForUser = null; 
                return; 
            }
            
            await displayAccountInfo(user.uid); 
            
            if (dataInitializedForUser !== user.uid) {
                dataInitializedForUser = user.uid;
                UI.showLoader();
                try {
                    unsubscribeListeners = await initializeAppForUser(user.uid);
                } catch(e) {
                    console.error("Initialization failed:", e);
                } finally {
                    UI.hideLoader();
                }
            }
        } else {
            dataInitializedForUser = null;
            UI.applyDarkMode(false); // Revert to light mode on logout
        }
    });
});

async function initializeAppForUser(userId) {
    console.log(`Initializing real-time listeners for user: ${userId}`);
    
    await UI.loadAndApplyTheme(userId);

    const listeners = [
        Catalog.listenToMainCategories(userId),
        Catalog.listenToCatalogItems(userId),
        Quote.listenToCompanySettings(userId),
        Quote.listenToCurrentWorkingQuote(userId),
        Quote.listenToSavedQuotes(userId),
        Quote.listenToQuoteTemplates(userId),
        Costing.listenToCostingTemplates(userId),
        Costing.listenToSavedCostingSheets(userId),
        Costing.listenToMaterialsLibrary(userId)
    ];
    
    // Initialize UI states that depend on data
    Quote.updateDimensionInputsVisibility();

    UI.openTab('tabQuote');
    console.log("App real-time listeners initialized.");
    
    return listeners;
}

function handleActionCallback(actionKey, context) {
    const { itemId, itemType } = context;
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    switch (itemType) {
        case 'quoteItem':
            if (actionKey === 'edit') Quote.editQuoteItemOnForm(itemId);
            else if (actionKey === 'delete') Quote.deleteQuoteItem(itemId, userId);
            else if (actionKey === 'saveToCatalog') Quote.saveThisQuoteItemToMasterCatalog(itemId, userId);
            break;
        case 'savedQuote':
            if (actionKey === 'load') {
                UI.showLoader();
                Quote.loadQuoteFromList(itemId, userId).then(() => UI.openTab('tabQuote')).finally(() => UI.hideLoader());
            } else if (actionKey === 'duplicate') {
                UI.showLoader();
                Quote.duplicateQuote(itemId, userId).then(() => UI.openTab('tabQuote')).finally(() => UI.hideLoader());
            } else if (actionKey === 'delete') {
                Quote.deleteQuoteFromList(itemId, userId);
            }
            break;
        case 'mainCategory':
            if (actionKey === 'edit') Catalog.editMainCategory(itemId);
            else if (actionKey === 'delete') Catalog.deleteMainCategory(itemId, userId);
            break;
        case 'catalogEntry':
            if (actionKey === 'edit') Catalog.editCatalogEntry(itemId);
            else if (actionKey === 'delete') Catalog.deleteCatalogEntry(itemId, userId);
            break;
        case 'costingMaterial':
            if (actionKey === 'edit') Costing.editMaterialOnForm(itemId);
            else if (actionKey === 'delete') Costing.removeMaterialFromCosting(itemId);
            break;
        case 'costingLabor':
            if (actionKey === 'edit') Costing.editLaborOnForm(itemId);
            else if (actionKey === 'delete') Costing.removeLaborFromCosting(itemId);
            break;
        case 'costingOtherCost':
            if (actionKey === 'edit') Costing.editOtherCostOnForm(itemId);
            else if (actionKey === 'delete') Costing.removeOtherCostFromCosting(itemId);
            break;
        case 'savedCostingSheet':
            if (actionKey === 'load') Costing.loadCostingSheet(itemId);
            else if (actionKey === 'duplicate') Costing.duplicateCostingSheet(itemId);
            else if (actionKey === 'delete') Costing.deleteCostingSheet(itemId);
            break;
        case 'libraryMaterial':
            if (actionKey === 'load') Costing.loadMaterialFromLibrary(itemId);
            else if (actionKey === 'delete') Costing.deleteMaterialFromLibrary(itemId, userId);
            break;
        case 'quoteTemplate':
            if (actionKey === 'load') Quote.loadQuoteFromTemplate(itemId, userId);
            else if (actionKey === 'rename') Quote.renameQuoteTemplate(itemId, userId);
            else if (actionKey === 'delete') Quote.deleteQuoteTemplate(itemId, userId);
            break;
        case 'costingTemplate':
             if (actionKey === 'load') Costing.loadCostingFromTemplateHandler(itemId, userId);
             else if (actionKey === 'rename') Costing.renameCostingTemplateHandler(itemId, userId);
             else if (actionKey === 'delete') Costing.deleteCostingTemplateHandler(itemId, userId);
             break;
        default:
            console.warn(`Unhandled action '${actionKey}' for itemType '${itemType}'`);
    }
}

/**
 * Gathers all necessary data for PDF generation.
 * @param {string} userId The current user's ID.
 * @returns {Promise<object>} A promise that resolves to the quote data object for the PDF.
 */
async function getQuoteDataForPdf(userId) {
    const totals = await Quote.calculateTotals(userId, false);
    return {
        companySettings: Quote.getCompanySettings(),
        quoteId: Quote.getCurrentQuoteId(),
        customerInfo: {
            name: DOM.customerNameInput.value,
            address: DOM.customerAddressInput.value,
            date: DOM.quoteDateInput.value,
        },
        items: Quote.getCurrentQuoteItems(),
        mainCategories: Catalog.getMainCategories(),
        totals: totals,
        installments: {
            enabled: DOM.applyInstallmentsCheckbox.checked,
            data: Quote.getQuoteInstallmentData(),
        }
    };
}


async function handleBackupData(userId) {
    if (!userId) return;
    showNotification("Bắt đầu quá trình sao lưu, vui lòng đợi...", 'info');
    UI.showLoader();

    try {
        const collectionsToBackup = {
            mainCategories: 'mainCategories',
            catalog: 'catalog',
            quotes: 'quotes',
            quoteTemplates: 'quoteTemplates',
            costingSheets: 'costingSheets',
            costingTemplates: 'costingTemplates',
            materialsLibrary: 'materialsLibrary'
        };

        const backupData = {};
        const promises = [];

        // Backup collections
        for (const key in collectionsToBackup) {
            const collectionName = collectionsToBackup[key];
            const promise = db.collection('users').doc(userId).collection(collectionName).get().then(snapshot => {
                backupData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            });
            promises.push(promise);
        }

        // Backup single doc settings
        const settingsPromise = db.collection('users').doc(userId).collection('settings').doc('company').get().then(doc => {
            if (doc.exists) {
                backupData.companySettings = { id: doc.id, ...doc.data() };
            }
        });
        promises.push(settingsPromise);

        await Promise.all(promises);

        // Create and download the file
        const jsonString = JSON.stringify(backupData, (key, value) => {
            // Convert Firestore Timestamps to ISO strings
            if (value && typeof value === 'object' && value.toDate instanceof Function) {
                return value.toDate().toISOString();
            }
            return value;
        }, 2);
        
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `backup_fquote_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification("Sao lưu dữ liệu thành công!", 'success');
    } catch (error) {
        console.error("Lỗi sao lưu dữ liệu:", error);
        showNotification("Sao lưu dữ liệu thất bại. Xem console để biết chi tiết.", 'error');
    } finally {
        UI.hideLoader();
    }
}


async function handleRestoreData(userId, file) {
    if (!userId || !file) return;

    const confirmation = prompt(
        'CẢNH BÁO CỰC KỲ QUAN TRỌNG:\nHành động này sẽ XÓA TẤT CẢ dữ liệu hiện tại của bạn và thay thế bằng dữ liệu từ file sao lưu. Hành động này KHÔNG THỂ HOÀN TÁC.\n\nĐể xác nhận, vui lòng gõ "KHOIPHUC" vào ô bên dưới:'
    );

    if (confirmation !== 'KHOIPHUC') {
        showNotification("Hành động khôi phục đã bị hủy.", 'info');
        return;
    }

    UI.showLoader();
    showNotification("Bắt đầu khôi phục... Ứng dụng sẽ tự động tải lại sau khi hoàn tất.", 'info', 10000);

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const restoredData = JSON.parse(event.target.result);
            const collectionsToRestore = [
                'mainCategories', 'catalog', 'quotes', 'quoteTemplates', 
                'costingSheets', 'costingTemplates', 'materialsLibrary'
            ];
            
            // --- Step 1: Delete existing data ---
            const deletePromises = collectionsToRestore.map(async (collectionName) => {
                const snapshot = await db.collection('users').doc(userId).collection(collectionName).get();
                const deleteBatch = db.batch();
                snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                await deleteBatch.commit();
            });
            await Promise.all(deletePromises);

            // --- Step 2: Write new data ---
            const writeBatch = db.batch();
            
            // Restore collections
            collectionsToRestore.forEach(collectionName => {
                if (Array.isArray(restoredData[collectionName])) {
                    restoredData[collectionName].forEach(item => {
                        const docRef = db.collection('users').doc(userId).collection(collectionName).doc(item.id);
                        const dataToWrite = { ...item };
                        delete dataToWrite.id; // Don't write the id field itself

                        // Convert ISO string dates back to Timestamps
                        for (const key in dataToWrite) {
                            if (typeof dataToWrite[key] === 'string' && dataToWrite[key].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                                dataToWrite[key] = firebase.firestore.Timestamp.fromDate(new Date(dataToWrite[key]));
                            }
                        }
                        writeBatch.set(docRef, dataToWrite);
                    });
                }
            });

            // Restore single doc settings
            if (restoredData.companySettings) {
                const settingsRef = db.collection('users').doc(userId).collection('settings').doc('company');
                const settingsData = { ...restoredData.companySettings };
                delete settingsData.id;
                writeBatch.set(settingsRef, settingsData);
            }
            
            await writeBatch.commit();

            showNotification("Khôi phục dữ liệu thành công! Đang tải lại...", 'success');
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            console.error("Lỗi khôi phục dữ liệu:", error);
            showNotification(`Khôi phục dữ liệu thất bại: ${error.message}`, 'error');
            UI.hideLoader();
        }
    };
    reader.onerror = () => {
        showNotification("Không thể đọc file sao lưu.", 'error');
        UI.hideLoader();
    };
    reader.readAsText(file);
}

function setupAppEventListeners() {
    
    DOM.tabButtons.forEach(button => {
        button.addEventListener('click', (e) => UI.openTab(e.target.dataset.tab));
    });
    DOM.globalDarkModeToggleButton?.addEventListener('click', () => {
        const userId = getUserId();
        UI.toggleDarkMode(userId);
    });

    const getUserId = () => auth.currentUser?.uid;

    // --- QUOTE TAB ---
    Quote.initQuoteTabEventListeners();
    DOM.itemImageFileQuoteForm?.addEventListener('change', Quote.itemImageFileQuoteFormHandler); // Fixed: Added missing listener
    DOM.addOrUpdateItemButtonForm?.addEventListener('click', () => getUserId() && Quote.addOrUpdateItemFromForm(getUserId()));
    DOM.quickSaveToCatalogButtonForm?.addEventListener('click', () => getUserId() && Quote.quickSaveToCatalogFromFormHandler(getUserId()));
    DOM.cancelEditQuoteItemButtonForm?.addEventListener('click', Quote.resetQuoteItemFormEditingState);
    DOM.prepareNewQuoteItemButton?.addEventListener('click', Quote.prepareNewQuoteItemHandler);

    // Live item total preview listeners
    const inputsForItemPreview = [
        DOM.itemPriceQuoteForm, DOM.itemDiscountValueForm, DOM.itemDiscountTypeForm,
        DOM.itemCalcTypeQuoteForm, DOM.itemLengthQuoteForm, DOM.itemHeightQuoteForm,
        DOM.itemDepthQuoteForm, DOM.itemQuantityQuoteForm
    ];
    inputsForItemPreview.forEach(input => {
        input?.addEventListener('input', Quote.updateItemLineTotalPreview);
    });

    // Smart dimension input visibility
    DOM.itemCalcTypeQuoteForm?.addEventListener('change', Quote.updateDimensionInputsVisibility);

    // Remove image button
    DOM.removeItemImageButtonQuoteForm?.addEventListener('click', Quote.removeQuoteItemImage);
    
    const inputsToAutoRecalculateAndSave = [
        DOM.discountValueInput, DOM.discountTypeSelect, DOM.taxPercentInput,
        DOM.applyDiscountCheckbox, DOM.applyTaxCheckbox, DOM.applyInstallmentsCheckbox
    ];
    inputsToAutoRecalculateAndSave.forEach(input => {
        input?.addEventListener('input', () => getUserId() && Quote.calculateTotals(getUserId()));
    });
    
    // General info auto-save listeners
    const inputsToAutoSave = [DOM.customerNameInput, DOM.customerAddressInput, DOM.quoteDateInput];
    inputsToAutoSave.forEach(input => {
        input?.addEventListener('input', () => getUserId() && Quote.saveCurrentWorkingQuoteToFirestore(getUserId()));
    });
    
    DOM.addInstallmentButton?.addEventListener('click', Quote.addInstallment);
    DOM.installmentsListContainer?.addEventListener('change', Quote.handleInstallmentChange); 
    DOM.installmentsListContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-installment-btn')) {
            Quote.removeInstallment(e.target.dataset.index);
        }
    });
    DOM.installmentsContainer?.addEventListener('focusout', () => getUserId() && Quote.saveCurrentWorkingQuoteToFirestore(getUserId()));
    
    DOM.saveCurrentQuoteButton?.addEventListener('click', () => {
        const userId = getUserId();
        if (userId) {
            UI.showLoader();
            Quote.saveCurrentQuoteToListHandler(userId).finally(() => UI.hideLoader());
        }
    });
    
    DOM.exportPdfButton?.addEventListener('click', async () => {
        const userId = getUserId();
        if (!userId) return;
        const quoteData = await getQuoteDataForPdf(userId);
        UI.exportToPdf(quoteData);
    });
    DOM.previewPdfButton?.addEventListener('click', async () => {
        const userId = getUserId();
        if (!userId) return;
        const quoteData = await getQuoteDataForPdf(userId);
        UI.previewPdf(quoteData);
    });

    DOM.clearQuoteButton?.addEventListener('click', () => getUserId() && Quote.clearQuoteFormHandler(getUserId()));
    DOM.saveQuoteAsTemplateButton?.addEventListener('click', () => getUserId() && Quote.saveQuoteAsTemplateHandler(getUserId()));
    DOM.createQuoteFromTemplateSelect?.addEventListener('change', (e) => {
        const templateId = e.target.value;
        const userId = getUserId();
        if (templateId && userId) {
            Quote.loadQuoteFromTemplate(templateId, userId);
            e.target.value = ""; // Reset select
        }
    });

    DOM.itemListPreviewTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa Hạng Mục', actionKey: 'edit', icon: 'edit' },
                { label: 'Lưu vào DM chính', actionKey: 'saveToCatalog', icon: 'save' },
                { label: 'Xóa Hạng Mục', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });


    // --- SAVED QUOTES TAB ---
    const savedQuotesFilterInputs = [
        DOM.savedQuotesSearchInput,
        DOM.savedQuotesStartDateFilter,
        DOM.savedQuotesEndDateFilter,
        DOM.savedQuotesMinTotalFilter,
        DOM.savedQuotesMaxTotalFilter,
        DOM.savedQuotesStatusFilter
    ];
    savedQuotesFilterInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', () => getUserId() && Quote.renderSavedQuotesList());
            if (input.type === 'date' || input.tagName.toLowerCase() === 'select') {
                 input.addEventListener('change', () => getUserId() && Quote.renderSavedQuotesList());
            }
        }
    });
    DOM.loadMoreQuotesButton?.addEventListener('click', () => {
        showNotification('Chức năng tải thêm báo giá cũ đang được phát triển.', 'info');
    });

    DOM.savedQuotesTableBody?.addEventListener('change', (e) => {
        const userId = getUserId();
        if (!userId) return;
        const target = e.target;
        if (target.classList.contains('status-select-action')) {
            const quoteId = target.dataset.id;
            const newStatus = target.value;
            if (quoteId && newStatus) {
                Quote.updateQuoteStatus(quoteId, newStatus, userId);
            }
        }
    });
    DOM.savedQuotesTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Tải vào Form', actionKey: 'load', icon: 'load' },
                { label: 'Nhân Bản', actionKey: 'duplicate', icon: 'duplicate' },
                { label: 'Xóa Báo Giá', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });
   
    // --- CATALOG TAB ---
    DOM.excelFileInputManage?.addEventListener('change', (e) => getUserId() && Catalog.handleExcelFileGeneric(e, getUserId()));
    DOM.reloadExcelButton?.addEventListener('click', () => DOM.excelFileInputManage.click());
    DOM.catalogSearchInput?.addEventListener('input', Catalog.renderCatalogPreviewTable);
    DOM.catalogFilterMainCategorySelect?.addEventListener('change', Catalog.renderCatalogPreviewTable);
    DOM.catalogSortSelect?.addEventListener('change', Catalog.renderCatalogPreviewTable);
    DOM.catalogMinPriceFilter?.addEventListener('input', Catalog.renderCatalogPreviewTable);
    DOM.catalogMaxPriceFilter?.addEventListener('input', Catalog.renderCatalogPreviewTable);
    DOM.exportCatalogButton?.addEventListener('click', Catalog.exportCatalogHandler);
    
    DOM.saveCatalogEntryButton?.addEventListener('click', () => getUserId() && Catalog.saveCatalogEntryHandler(getUserId()));
    DOM.cancelCatalogEntryEditButton?.addEventListener('click', Catalog.resetCatalogEditForm);
    DOM.addOrUpdateMainCategoryButton?.addEventListener('click', () => getUserId() && Catalog.addOrUpdateMainCategoryHandler(getUserId()));
    DOM.cancelEditMainCategoryButton?.addEventListener('click', Catalog.resetMainCategoryForm);

    DOM.catalogPreviewList?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa Hạng Mục', actionKey: 'edit', icon: 'edit' },
                { label: 'Xóa Hạng Mục', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });
    DOM.mainCategoriesTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa DM Chính', actionKey: 'edit', icon: 'edit' },
                { label: 'Xóa DM Chính', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    // --- TEMPLATE MANAGEMENT TAB ---
    const setupTemplateTableListener = (tableBody, itemType) => {
        tableBody?.addEventListener('click', e => {
            const trigger = e.target.closest('.action-trigger');
            if (trigger) {
                e.stopPropagation();
                const itemId = trigger.dataset.itemId;
                const actions = [
                    { label: 'Tải Mẫu', actionKey: 'load', icon: 'load' },
                    { label: 'Đổi Tên', actionKey: 'rename', icon: 'edit' },
                    { label: 'Xóa Mẫu', actionKey: 'delete', icon: 'delete', class: 'delete' }
                ];
                UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
            }
        });
    };
    setupTemplateTableListener(DOM.quoteTemplatesTableBody, 'quoteTemplate');
    setupTemplateTableListener(DOM.costingTemplatesTableBody, 'costingTemplate');
    
    // --- EVENT LISTENER FOR RACE CONDITION ---
    document.addEventListener('mainCategoriesUpdated', Quote.refreshQuoteFormCategory);

    // --- COSTING TAB ---
    Costing.initCostingTabEventListeners();
    
    DOM.costingMaterialsTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa Vật Tư', actionKey: 'edit', icon: 'edit' },
                { label: 'Xóa Vật Tư', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    DOM.costingLaborTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa Nhân Công', actionKey: 'edit', icon: 'edit' },
                { label: 'Xóa Nhân Công', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    DOM.costingOtherCostsTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Sửa Chi Phí', actionKey: 'edit', icon: 'edit' },
                { label: 'Xóa Chi Phí', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    DOM.savedCostingsTableBody?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Tải vào Form', actionKey: 'load', icon: 'load' },
                { label: 'Nhân Bản', actionKey: 'duplicate', icon: 'duplicate' },
                { label: 'Xóa Phiếu', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    DOM.materialsLibraryList?.addEventListener('click', e => {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.stopPropagation();
            const itemId = trigger.dataset.itemId;
            const itemType = trigger.dataset.itemType;
            const actions = [
                { label: 'Tải vào Form', actionKey: 'load', icon: 'load' },
                { label: 'Xóa khỏi TV', actionKey: 'delete', icon: 'delete', class: 'delete' }
            ];
            UI.showGenericActionsMenu(actions, trigger, { itemId, itemType }, handleActionCallback);
        }
    });

    
    // --- SETTINGS TAB ---
    DOM.saveCompanySettingsButton?.addEventListener('click', () => getUserId() && Quote.saveCompanySettingsHandler(getUserId()));
    DOM.companyLogoFileInput?.addEventListener('change', Quote.companyLogoFileHandler);
    
    // Data Backup & Restore
    DOM.backupDataButton?.addEventListener('click', () => getUserId() && handleBackupData(getUserId()));
    DOM.restoreDataFile?.addEventListener('change', (e) => {
        if (DOM.restoreDataButton) {
            DOM.restoreDataButton.disabled = !e.target.files || e.target.files.length === 0;
        }
    });
    DOM.restoreDataButton?.addEventListener('click', () => {
        const userId = getUserId();
        const file = DOM.restoreDataFile?.files[0];
        if (userId && file) {
            handleRestoreData(userId, file);
        }
    });


    // --- ADMIN TAB ---
    DOM.adminFetchUserButton?.addEventListener('click', Admin.fetchUserDetailsForAdmin);
    DOM.adminUpdateExpiryButton?.addEventListener('click', Admin.updateUserExpiryByAdmin);
    DOM.adminUpdateStatusButton?.addEventListener('click', Admin.updateUserStatusByAdmin);
    DOM.adminSaveGlobalSettingsButton?.addEventListener('click', Admin.saveGlobalAdminSettings);
    DOM.adminRefreshStatsButton?.addEventListener('click', Admin.fetchAndDisplayUserStatistics);
}

async function checkAndSetupAccount(user) {
    if (user.isAnonymous) return true;

    const profileRef = db.collection('users').doc(user.uid).collection('settings').doc('profile');
    try {
        const docSnap = await profileRef.get();
        const now = new Date();
        const trialExpiry = new Date(new Date().setDate(now.getDate() + 7)); 

        if (!docSnap.exists) {
            const defaultProfileData = {
                email: user.email,
                accountCreatedAt: firebase.firestore.Timestamp.fromDate(now),
                validUntil: firebase.firestore.Timestamp.fromDate(trialExpiry),
                status: 'active_trial'
            };
            await profileRef.set(defaultProfileData);
            return true;
        }

        const profileData = docSnap.data();
        let needsUpdate = false;
        let finalProfileData = { ...profileData };

        if (!finalProfileData.validUntil) {
            finalProfileData.validUntil = firebase.firestore.Timestamp.fromDate(trialExpiry);
            needsUpdate = true;
        }

        if (needsUpdate) {
            await profileRef.update(finalProfileData);
        }

        const validUntil = finalProfileData.validUntil.toDate();
        if (new Date() > validUntil) {
            document.getElementById('expiration-modal').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('auth-modal').style.display = 'none'; 
            document.getElementById('logout-expired-button').onclick = () => auth.signOut();
            return false; 
        }
        
        return true; 

    } catch (error) {
        console.error("Lỗi kiểm tra/tạo tài khoản:", error);
        return false;
    }
}

async function displayAccountInfo(userId) {
    const accountInfoContainer = document.getElementById('account-info-container');
    const detailsDiv = document.getElementById('account-info-details');
    if (!accountInfoContainer || !detailsDiv) return;

    accountInfoContainer.style.display = 'block';
    const profileRef = db.collection('users').doc(userId).collection('settings').doc('profile');

    try {
        const docSnap = await profileRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const validUntilDate = data.validUntil ? data.validUntil.toDate() : null;
            const remainingDaysString = validUntilDate ? formatRemainingDays(validUntilDate) : 'Chưa có thông tin';
            
            let remainingClass = 'status-ok';
            if (remainingDaysString.includes('hết hạn') || remainingDaysString.includes('hôm nay')) {
                remainingClass = 'status-expired';
            } else if (remainingDaysString.includes('Còn lại') && parseInt(remainingDaysString.split(' ')[2]) <= 3) {
                remainingClass = 'status-warning';
            }

            detailsDiv.innerHTML = `
                <p><strong>Email:</strong> ${data.email || 'N/A'}</p>
                <p><strong>Ngày đăng ký:</strong> ${data.accountCreatedAt ? formatDate(data.accountCreatedAt.toDate()) : 'N/A'}</p>
                <p><strong>Hạn sử dụng đến:</strong> ${validUntilDate ? formatDate(validUntilDate) : 'Chưa có thông tin'}</p>
                <p class="remaining-days ${remainingClass}"><strong>Trạng thái:</strong> ${remainingDaysString}</p>
            `;
        } else {
            detailsDiv.innerHTML = `<p>Đang tạo hồ sơ mặc định...</p>`;
        }
    } catch (error) {
        console.error("Lỗi lấy thông tin hồ sơ:", error);
        detailsDiv.innerHTML = `<p>Lỗi tải thông tin tài khoản.</p>`;
    }
}