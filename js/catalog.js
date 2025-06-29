

/**
 * @file catalog.js
 * @description Quản lý danh mục sản phẩm/dịch vụ với Firestore, sử dụng listeners thời gian thực.
 */
import * as DOM from './dom.js';
import { db } from './firebase.js';
import { formatCurrency, generateUniqueId } from './utils.js';
import { showNotification } from './notifications.js';

let loadedCatalog = [];
let mainCategories = [];

export const getLoadedCatalog = () => [...loadedCatalog];
export const getMainCategories = () => [...mainCategories];

// === MAIN CATEGORY MANAGEMENT (REAL-TIME) ===

export function listenToMainCategories(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection('mainCategories').orderBy('name');
    
    const unsubscribe = query.onSnapshot(snapshot => {
        mainCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMainCategoriesTable();
        populateMainCategoryUIs();
        populateMainCategoriesSelect(DOM.catalogEditMainCategorySelect, null);
        // Notify other parts of the app that categories are updated
        document.dispatchEvent(new CustomEvent('mainCategoriesUpdated'));
    }, error => {
        console.error("Lỗi lắng nghe danh mục chính:", error);
        const message = error.code === 'permission-denied'
            ? 'Không thể tải danh mục chính: Không có quyền truy cập.'
            : 'Không thể tải danh mục chính. Vui lòng kiểm tra kết nối mạng.';
        showNotification(message, 'error');
    });

    return unsubscribe;
}

function renderMainCategoriesTable() {
    if (!DOM.mainCategoriesTableBody || !DOM.mainCategoryCountSpan) return;
    let tableHTML = '';
    if (mainCategories.length === 0) {
        tableHTML = '<tr><td colspan="3" style="text-align:center;">Chưa có danh mục chính nào.</td></tr>';
    } else {
        mainCategories.forEach((category, index) => {
            tableHTML += `
                <tr data-id="${category.id}" data-type="mainCategory">
                    <td style="text-align:center;">${index + 1}</td>
                    <td>${category.name}</td>
                    <td class="no-print action-trigger-cell">
                         <button class="action-trigger" data-item-id="${category.id}" data-item-type="mainCategory" title="Hành động">⋮</button>
                    </td>
                </tr>
            `;
        });
    }
    DOM.mainCategoriesTableBody.innerHTML = tableHTML;
    DOM.mainCategoryCountSpan.textContent = mainCategories.length;
}

function populateMainCategoryUIs() {
    if (DOM.mainCategoryDataList) {
        DOM.mainCategoryDataList.innerHTML = '';
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.name; 
            option.dataset.id = category.id; 
            DOM.mainCategoryDataList.appendChild(option);
        });
    }
    // Populate filter select on catalog tab
    if (DOM.catalogFilterMainCategorySelect) {
        const currentFilterVal = DOM.catalogFilterMainCategorySelect.value;
        DOM.catalogFilterMainCategorySelect.innerHTML = '<option value="">-- Tất cả Danh mục chính --</option>';
        mainCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            if (category.id === currentFilterVal) option.selected = true;
            DOM.catalogFilterMainCategorySelect.appendChild(option);
        });
    }
}

export function populateMainCategoriesSelect(selectElement, selectedCategoryId) {
    if (!selectElement) return;
    const currentVal = selectElement.value; 
    selectElement.innerHTML = '<option value="">-- Chọn Danh mục chính --</option>'; 
    mainCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        if (selectedCategoryId && category.id === selectedCategoryId) {
            option.selected = true;
        } else if (!selectedCategoryId && category.id === currentVal) {
             option.selected = true; 
        }
        selectElement.appendChild(option);
    });
}


export async function addOrUpdateMainCategoryHandler(userId) {
    if (!userId) return;
    const name = DOM.mainCategoryNameInput.value.trim();
    const editingId = DOM.editingMainCategoryIdInput.value;

    if (!name) {
        showNotification('Tên danh mục chính không được để trống.', 'error');
        return;
    }
    if (mainCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase() && cat.id !== editingId)) {
        showNotification('Tên danh mục chính này đã tồn tại.', 'error');
        return;
    }

    try {
        const docRef = editingId 
            ? db.collection('users').doc(userId).collection('mainCategories').doc(editingId)
            : db.collection('users').doc(userId).collection('mainCategories').doc();
        
        await docRef.set({ name }, { merge: !!editingId });
        resetMainCategoryForm();
        showNotification(editingId ? "Đã cập nhật danh mục." : "Đã thêm danh mục mới.", 'success');
    } catch (e) {
        console.error("Lỗi lưu danh mục chính:", e);
        const message = e.code === 'permission-denied'
            ? 'Lưu thất bại: Không có quyền.'
            : 'Đã có lỗi xảy ra khi lưu.';
        showNotification(message, 'error');
    }
}

export function editMainCategory(id) {
    const category = mainCategories.find(cat => cat.id === id);
    if (category) {
        DOM.mainCategoryNameInput.value = category.name;
        DOM.editingMainCategoryIdInput.value = category.id;
        DOM.addOrUpdateMainCategoryButton.textContent = 'Sửa';
        DOM.cancelEditMainCategoryButton.style.display = 'inline-block';
        DOM.mainCategoryNameInput.focus();
    }
}

export async function deleteMainCategory(id, userId) {
    if (!userId) return;
    const category = mainCategories.find(cat => cat.id === id);
    if (!category) return;
    if (confirm(`Bạn chắc chắn muốn xóa danh mục "${category.name}"? Thao tác này KHÔNG xóa các hạng mục sản phẩm thuộc danh mục này.`)) {
        try {
            await db.collection('users').doc(userId).collection('mainCategories').doc(id).delete();
            showNotification(`Đã xóa danh mục "${category.name}".`, 'success');
        } catch(e) {
            console.error("Lỗi xóa danh mục:", e);
            const message = e.code === 'permission-denied'
                ? 'Xóa thất bại: Không có quyền.'
                : 'Lỗi khi xóa danh mục.';
            showNotification(message, 'error');
        }
    }
}

export function resetMainCategoryForm() {
    DOM.mainCategoryNameInput.value = '';
    DOM.editingMainCategoryIdInput.value = '';
    DOM.addOrUpdateMainCategoryButton.textContent = 'Lưu DM Chính'; // Reverted
    DOM.cancelEditMainCategoryButton.style.display = 'none';
}

export async function findOrCreateMainCategory(name, userId) {
    if (!name || !userId) return null;
    const trimmedName = name.trim();
    let existingCategory = mainCategories.find(cat => cat.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (existingCategory) {
        return existingCategory.id;
    }

    try {
        const newDocRef = db.collection('users').doc(userId).collection('mainCategories').doc();
        await newDocRef.set({ name: trimmedName });
        return newDocRef.id;
    } catch (e) {
        console.error("Lỗi tạo DM chính mới:", e);
        return null;
    }
}


// === CATALOG ITEM MANAGEMENT (REAL-TIME) ===

export function listenToCatalogItems(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection('catalog');

    const unsubscribe = query.onSnapshot(snapshot => {
        loadedCatalog = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCatalogPreviewTable();
    }, error => {
        console.error("Lỗi lắng nghe danh mục sản phẩm:", error);
        const message = error.code === 'permission-denied'
            ? 'Không thể tải danh mục: Không có quyền truy cập.'
            : 'Không thể tải danh mục. Vui lòng kiểm tra kết nối mạng.';
        showNotification(message, 'error');
    });

    return unsubscribe;
}

export function handleExcelFileGeneric(event, userId) {
    const file = event.target.files[0];
    if (!file || !userId) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });
            
            if(jsonData.length === 0) {
                showNotification("File Excel không có dữ liệu.", 'error');
                return;
            }

            const catalogBatch = db.batch();
            const collectionRef = db.collection('users').doc(userId).collection('catalog');
            let importedCount = 0;
            const mainCatCache = {}; 

            for (const row of jsonData) { 
                 const name = String(row['TenHangMuc'] || row['tenhangmuc'] || '').trim();
                 if(name) {
                     const newId = generateUniqueId('cat');
                     const docRef = collectionRef.doc(newId);
                     
                     let mainCategoryId = null;
                     const mainCategoryName = String(row['DanhMucChinh'] || row['danhmucchinh'] || '').trim();
                     if (mainCategoryName) {
                        if (mainCatCache[mainCategoryName.toLowerCase()]) {
                            mainCategoryId = mainCatCache[mainCategoryName.toLowerCase()];
                        } else {
                            mainCategoryId = await findOrCreateMainCategory(mainCategoryName, userId);
                            if(mainCategoryId) mainCatCache[mainCategoryName.toLowerCase()] = mainCategoryId;
                        }
                     }

                     const mappedData = {
                        name: name,
                        spec: String(row['QuyCach'] || row['quycach'] || '').trim(),
                        unit: String(row['DonViTinh'] || row['donvitinh'] || '').trim(),
                        price: parseFloat(String(row['DonGia'] || row['dongia']).replace(/[^0-9.-]+/g, "")) || 0,
                        mainCategoryId: mainCategoryId || null
                     };
                     catalogBatch.set(docRef, mappedData);
                     importedCount++;
                 }
            }

            if (importedCount > 0) {
                await catalogBatch.commit();
                showNotification(`Đã nhập thành công ${importedCount} hạng mục.`, 'success');
            } else {
                showNotification(`Không có hạng mục hợp lệ nào để nhập. Vui lòng kiểm tra cột 'TenHangMuc' trong file.`, 'info');
            }
        } catch (error) {
            console.error("Lỗi đọc Excel hoặc ghi Firestore:", error);
            let message = 'Lỗi xử lý file Excel.';
            if (error.message && error.message.includes("is not a ZIP file")) {
                message = 'File không đúng định dạng. Vui lòng sử dụng file .xlsx hợp lệ.';
            } else {
                message = 'Không thể đọc file. Vui lòng kiểm tra định dạng file (cần là .xlsx, .xls) và đảm bảo các cột `TenHangMuc`, `DonViTinh`, `DonGia` (và tùy chọn `DanhMucChinh`) tồn tại.';
            }
            showNotification(message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

export function renderCatalogPreviewTable() {
    if (!DOM.catalogPreviewList || !DOM.catalogItemCount) return;

    const searchTerm = DOM.catalogSearchInput ? DOM.catalogSearchInput.value.toLowerCase() : '';
    const selectedMainCategoryId = DOM.catalogFilterMainCategorySelect ? DOM.catalogFilterMainCategorySelect.value : '';
    const minPrice = DOM.catalogMinPriceFilter ? parseFloat(DOM.catalogMinPriceFilter.value) || 0 : 0;
    const maxPrice = DOM.catalogMaxPriceFilter ? parseFloat(DOM.catalogMaxPriceFilter.value) || Infinity : Infinity;
    const sortOption = DOM.catalogSortSelect ? DOM.catalogSortSelect.value : 'name_asc';

    let tableHTML = '';
    
    let filteredCatalog = loadedCatalog.filter(item => {
        const nameMatch = !searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm));
        const specMatch = !searchTerm || (item.spec && item.spec.toLowerCase().includes(searchTerm));
        const categoryMatch = !selectedMainCategoryId || (item.mainCategoryId === selectedMainCategoryId);
        const priceMatch = (item.price >= minPrice) && (item.price <= maxPrice);
        return (nameMatch || specMatch) && categoryMatch && priceMatch;
    });

    switch (sortOption) {
        case 'name_asc':
            filteredCatalog.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name_desc':
            filteredCatalog.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'price_asc':
            filteredCatalog.sort((a, b) => a.price - b.price);
            break;
        case 'price_desc':
            filteredCatalog.sort((a, b) => b.price - a.price);
            break;
    }


    if (filteredCatalog.length > 0) {
        filteredCatalog.forEach((item, index) => {
            const mainCat = mainCategories.find(mc => mc.id === item.mainCategoryId);
            tableHTML += `
                <tr data-id="${item.id}" data-type="catalogEntry">
                    <td>${index + 1}</td> 
                    <td style="white-space: pre-wrap; max-width: 250px;">
                        ${item.name}
                        ${mainCat ? `<br><small style='color: var(--primary-color);'><em>(${mainCat.name})</em></small>` : ''}
                    </td>
                    <td style="white-space: pre-wrap; max-width: 200px;">${item.spec || ''}</td> 
                    <td>${item.unit}</td> <td>${formatCurrency(item.price)}</td>
                    <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${item.id}" data-item-type="catalogEntry" title="Hành động">⋮</button>
                    </td>
                </tr>
            `;
        });
    } else {
        tableHTML = '<tr><td colspan="6" style="text-align:center;">Không tìm thấy hạng mục hoặc danh mục trống.</td></tr>';
    }

    DOM.catalogPreviewList.innerHTML = tableHTML;
    DOM.catalogItemCount.textContent = filteredCatalog.length;
}

export function editCatalogEntry(entryId) {
    const item = loadedCatalog.find(i => i.id === entryId);
    if (item) {
        DOM.editingCatalogEntryIdInput.value = item.id;
        DOM.catalogEditNameInput.value = item.name;
        DOM.catalogEditSpecInput.value = item.spec || '';
        DOM.catalogEditUnitInput.value = item.unit;
        DOM.catalogEditPriceInput.value = item.price;
        populateMainCategoriesSelect(DOM.catalogEditMainCategorySelect, item.mainCategoryId);
        DOM.saveCatalogEntryButton.textContent = 'Sửa';
        DOM.cancelCatalogEntryEditButton.style.display = 'inline-block';
        DOM.catalogEditNameInput.focus();
    }
};

export async function deleteCatalogEntry(entryId, userId) {
    if (!userId) return;
    const itemToDelete = loadedCatalog.find(i => i.id === entryId);
    if (confirm(`Xóa hạng mục "${itemToDelete ? itemToDelete.name : entryId}" khỏi danh mục trên đám mây?`)) {
        try {
            await db.collection('users').doc(userId).collection('catalog').doc(entryId).delete();
            showNotification('Đã xóa hạng mục.', 'success');
        } catch (e) {
            console.error("Lỗi xóa hạng mục DM:", e);
            const message = e.code === 'permission-denied'
                ? 'Xóa thất bại: Không có quyền.'
                : 'Đã có lỗi xảy ra.';
            showNotification(message, 'error');
        }
    }
};

export async function saveCatalogEntryHandler(userId) {
    if (!userId) return;
    const name = DOM.catalogEditNameInput.value.trim();
    if (!name) {
        showNotification('Tên hạng mục không được để trống.', 'error');
        return;
    }
    const id = DOM.editingCatalogEntryIdInput.value;
    const mainCategoryId = DOM.catalogEditMainCategorySelect.value || null;

    const itemData = {
        name,
        spec: DOM.catalogEditSpecInput.value.trim(),
        unit: DOM.catalogEditUnitInput.value.trim(),
        price: parseFloat(DOM.catalogEditPriceInput.value) || 0,
        mainCategoryId: mainCategoryId,
    };
    try {
        const docRef = id 
            ? db.collection('users').doc(userId).collection('catalog').doc(id)
            : db.collection('users').doc(userId).collection('catalog').doc(); 
        
        await docRef.set(itemData, { merge: !!id }); 
        resetCatalogEditForm();
        showNotification(id ? 'Đã cập nhật hạng mục.' : 'Đã thêm hạng mục mới.', 'success');
    } catch (e) {
        console.error("Lỗi lưu hạng mục DM:", e);
        const message = e.code === 'permission-denied'
            ? 'Lưu thất bại: Không có quyền.'
            : 'Đã có lỗi xảy ra khi lưu.';
        showNotification(message, 'error');
    }
};

export function resetCatalogEditForm() {
    DOM.editingCatalogEntryIdInput.value = '';
    DOM.catalogEditNameInput.value = '';
    DOM.catalogEditSpecInput.value = '';
    DOM.catalogEditUnitInput.value = '';
    DOM.catalogEditPriceInput.value = '';
    if (DOM.catalogEditMainCategorySelect) DOM.catalogEditMainCategorySelect.value = '';
    DOM.saveCatalogEntryButton.textContent = 'Lưu vào DM'; // Reverted
    DOM.cancelCatalogEntryEditButton.style.display = 'none';
}

export function exportCatalogHandler() {
    const searchTerm = DOM.catalogSearchInput ? DOM.catalogSearchInput.value.toLowerCase() : '';
    const selectedMainCategoryId = DOM.catalogFilterMainCategorySelect ? DOM.catalogFilterMainCategorySelect.value : '';
    const minPrice = DOM.catalogMinPriceFilter ? parseFloat(DOM.catalogMinPriceFilter.value) || 0 : 0;
    const maxPrice = DOM.catalogMaxPriceFilter ? parseFloat(DOM.catalogMaxPriceFilter.value) || Infinity : Infinity;
    const sortOption = DOM.catalogSortSelect ? DOM.catalogSortSelect.value : 'name_asc';

    let itemsToExport = loadedCatalog.filter(item => {
        const nameMatch = !searchTerm || (item.name && item.name.toLowerCase().includes(searchTerm));
        const specMatch = !searchTerm || (item.spec && item.spec.toLowerCase().includes(searchTerm));
        const categoryMatch = !selectedMainCategoryId || (item.mainCategoryId === selectedMainCategoryId);
        const priceMatch = (item.price >= minPrice) && (item.price <= maxPrice);
        return (nameMatch || specMatch) && categoryMatch && priceMatch;
    });

    switch (sortOption) {
        case 'name_asc': itemsToExport.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'name_desc': itemsToExport.sort((a, b) => b.name.localeCompare(a.name)); break;
        case 'price_asc': itemsToExport.sort((a, b) => a.price - b.price); break;
        case 'price_desc': itemsToExport.sort((a, b) => b.price - a.price); break;
    }


    if (itemsToExport.length === 0) {
        showNotification('Không có dữ liệu danh mục (sau khi lọc) để xuất.', 'info');
        return;
    }
    const workbook = XLSX.utils.book_new();
    const catalogItemsData = itemsToExport.map(item => {
        const mainCat = mainCategories.find(mc => mc.id === item.mainCategoryId);
        return {
            TenHangMuc: item.name,
            QuyCach: item.spec || '',
            DonViTinh: item.unit,
            DonGia: item.price,
            DanhMucChinh: mainCat ? mainCat.name : ''
        };
    });
    const ws = XLSX.utils.json_to_sheet(catalogItemsData);
    XLSX.utils.sheet_add_aoa(ws, [["TenHangMuc", "QuyCach", "DonViTinh", "DonGia", "DanhMucChinh"]], { origin: "A1" });
    XLSX.utils.book_append_sheet(workbook, ws, "Danh muc san pham");
    XLSX.writeFile(workbook, `DanhMuc_${new Date().toISOString().slice(0,10)}.xlsx`);
}

export async function saveItemToMasterCatalog(itemData, userId) {
    if (!userId || !itemData || !itemData.name) {
         showNotification("Lỗi: Dữ liệu hạng mục không hợp lệ.", 'error');
         return;
    }
    itemData.price = parseFloat(itemData.price) || 0;
    
    if (itemData.mainCategoryId && !mainCategories.find(cat => cat.id === itemData.mainCategoryId)) {
        const categoryName = itemData.mainCategoryId; 
        const resolvedId = await findOrCreateMainCategory(categoryName, userId);
        itemData.mainCategoryId = resolvedId; 
    } else if (!itemData.mainCategoryId) {
        itemData.mainCategoryId = null; 
    }


    try {
        const docRef = db.collection('users').doc(userId).collection('catalog').doc(); 
        await docRef.set({
            ...itemData, 
            id: docRef.id 
        });
        showNotification(`"${itemData.name}" đã được lưu vào danh mục.`, 'success');
    } catch (e) {
        console.error("Lỗi lưu nhanh vào DM:", e);
        const message = e.code === 'permission-denied'
            ? 'Lưu vào danh mục thất bại: Không có quyền.'
            : 'Đã có lỗi khi lưu vào danh mục.';
        showNotification(message, 'error');
    }
}