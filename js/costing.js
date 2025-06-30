/**
 * @file costing.js
 * @description Manages logic for the Product Costing tab.
 */
import * as DOM from './dom.js';
import { db, auth } from './firebase.js';
import { formatCurrency, generateUniqueId, formatDate } from './utils.js';
import { showNotification } from './notifications.js';
import * as UI from './ui.js';

let currentCostingMaterials = [];
let currentCostingLabor = [];
let currentOtherCosts = [];
let savedCostingSheetsGlobal = [];
let materialsLibraryGlobal = [];
let editingMaterialId = null;
let editingLaborId = null;
let editingOtherCostId = null;
let costingTemplatesGlobal = []; // For storing costing templates
const COSTING_TEMPLATES_COLLECTION = 'costingTemplates';

// Store original calculated costs for "What-If" analysis
let originalCalculatedCosts = {
    materials: 0,
    labor: 0,
    overhead: 0,
    other: 0,
    management: 0,
    salesMarketing: 0,
    total: 0,
    unit: 0,
    quantityProduced: 1
};


// --- Export getter for saved costing sheets ---
export const getSavedCostingSheets = () => [...savedCostingSheetsGlobal];


// --- LISTENERS FOR DATA NEEDED BY SUGGESTIONS ---
export function listenToMaterialsLibrary(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection('materialsLibrary').orderBy('name');

    const unsubscribe = query.onSnapshot(snapshot => {
        materialsLibraryGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'library' }));
        renderMaterialsLibraryTable();
    }, error => {
        console.error("Lỗi lắng nghe thư viện vật tư:", error);
        showNotification('Không thể tải thư viện vật tư.', 'error');
    });
    return unsubscribe;
}


// --- DIRECT MATERIALS ---
export function addMaterialToCosting() {
    const name = DOM.costingMaterialNameInput.value.trim();
    const spec = DOM.costingMaterialSpecInput.value.trim();
    const unit = DOM.costingMaterialUnitInput.value.trim();
    const dimensions = DOM.costingMaterialDimensionsInput.value.trim();
    const itemQuantityMultiplier = parseFloat(DOM.costingMaterialQuantityInput.value) || 1;
    const price = parseFloat(DOM.costingMaterialPriceInput.value) || 0;
    const waste = parseFloat(DOM.costingMaterialWasteInput.value) || 0;
    const linkType = DOM.costingMaterialLinkDim.value;

    if (!name) {
        showNotification('Vui lòng nhập Tên Vật tư.', 'error');
        return;
    }
    if (itemQuantityMultiplier <= 0 && !editingMaterialId) { // Check only for new items
        showNotification('Số lượng / Hệ số nhân Vật tư phải lớn hơn 0.', 'error');
        return;
    }
     if (price < 0) {
        showNotification('Đơn giá Vật tư không hợp lệ.', 'error');
        return;
    }
    if (waste < 0 || waste > 100) {
        showNotification('% Hao hụt phải từ 0 đến 100.', 'error');
        return;
    }

    const materialData = {
        name, spec, unit, dimensions,
        itemQuantity: itemQuantityMultiplier,
        price, waste,
        linkType,
        total: 0
    };

    if (editingMaterialId) {
        const index = currentCostingMaterials.findIndex(mat => mat.id === editingMaterialId);
        if (index > -1) {
            currentCostingMaterials[index] = { ...currentCostingMaterials[index], ...materialData };
        }
        showNotification('Đã cập nhật vật tư.', 'success');
        resetMaterialEditState();
    } else {
        currentCostingMaterials.push({ id: generateUniqueId('mat'), ...materialData });
        showNotification('Đã thêm vật tư.', 'success');
    }

    updateCostingMaterialQuantityLabel();
    renderMaterialsTable();
    clearMaterialInputForm();
    calculateAllCosts();
}

function clearMaterialInputForm() {
    DOM.costingMaterialNameInput.value = '';
    DOM.costingMaterialSpecInput.value = '';
    DOM.costingMaterialUnitInput.value = '';
    DOM.costingMaterialDimensionsInput.value = '';
    DOM.costingMaterialQuantityInput.value = '1';
    DOM.costingMaterialPriceInput.value = '';
    DOM.costingMaterialWasteInput.value = '0';
    DOM.costingMaterialLinkDim.value = 'NONE';
    updateCostingMaterialQuantityLabel();
    if (DOM.costingMaterialNameSuggestionsContainer) {
        DOM.costingMaterialNameSuggestionsContainer.innerHTML = '';
        DOM.costingMaterialNameSuggestionsContainer.style.display = 'none';
    }
    if (!editingMaterialId) DOM.costingMaterialNameInput.focus();
}

function resetMaterialEditState() {
    editingMaterialId = null;
    DOM.editingMaterialIdInput.value = '';
    DOM.addCostingMaterialButton.textContent = '+ Vật Tư';
    DOM.cancelEditMaterialButton.style.display = 'none';
    clearMaterialInputForm();
}

export function editMaterialOnForm(materialId) {
    const material = currentCostingMaterials.find(mat => mat.id === materialId);
    if (material) {
        if(DOM.costingMaterialFormDetails && !DOM.costingMaterialFormDetails.open) {
            DOM.costingMaterialFormDetails.open = true;
        }
        editingMaterialId = material.id;
        DOM.editingMaterialIdInput.value = material.id;
        DOM.costingMaterialNameInput.value = material.name;
        DOM.costingMaterialSpecInput.value = material.spec;
        DOM.costingMaterialUnitInput.value = material.unit;
        DOM.costingMaterialDimensionsInput.value = material.dimensions;
        DOM.costingMaterialQuantityInput.value = material.itemQuantity;
        DOM.costingMaterialPriceInput.value = material.price;
        DOM.costingMaterialWasteInput.value = material.waste;
        DOM.costingMaterialLinkDim.value = material.linkType || 'NONE';

        DOM.addCostingMaterialButton.textContent = 'Cập nhật VT';
        DOM.cancelEditMaterialButton.style.display = 'inline-block';
        updateCostingMaterialQuantityLabel();
        DOM.costingMaterialNameInput.focus();
        DOM.costingMaterialEntryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}


export function removeMaterialFromCosting(materialId) {
    currentCostingMaterials = currentCostingMaterials.filter(mat => mat.id !== materialId);
    if (editingMaterialId === materialId) {
        resetMaterialEditState();
    }
    renderMaterialsTable();
    calculateAllCosts();
}

function renderMaterialsTable() {
    let html = '';
    currentCostingMaterials.forEach((mat, index) => {
        let linkTypeText = 'Thủ công';
        switch(mat.linkType) {
            case 'PRODUCT_L': linkTypeText = 'K.Dài SP'; break;
            case 'PRODUCT_W': linkTypeText = 'K.Rộng SP'; break;
            case 'PRODUCT_H': linkTypeText = 'K.Cao SP'; break;
            case 'PRODUCT_AREA_LW': linkTypeText = 'DT (DxR) SP'; break;
            case 'PRODUCT_AREA_LH': linkTypeText = 'DT (DxC) SP'; break;
            case 'PRODUCT_AREA_WH': linkTypeText = 'DT (RxC) SP'; break;
            case 'PRODUCT_PERIMETER_LW': linkTypeText = 'CV (2(D+R)) SP'; break;
        }

        html += `
            <tr data-id="${mat.id}" data-type="costingMaterial">
                <td>${index + 1}</td>
                <td>${mat.name}</td>
                <td>${mat.spec || ''}</td>
                <td>${linkTypeText}</td>
                <td>${mat.unit}</td>
                <td style="text-align:right;">${mat.itemQuantity.toLocaleString('vi-VN')}</td>
                <td style="text-align:right;">${formatCurrency(mat.price)}</td>
                <td style="text-align:right;">${mat.waste}%</td>
                <td style="text-align:right;">${formatCurrency(mat.total)}</td>
                <td class="no-print action-trigger-cell">
                    <button class="action-trigger" data-item-id="${mat.id}" data-item-type="costingMaterial" title="Hành động">⋮</button>
                </td>
            </tr>
        `;
    });
    DOM.costingMaterialsTableBody.innerHTML = html;
}

export async function saveMaterialToLibrary() {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) {
        showNotification('Bạn cần đăng nhập để lưu vào thư viện.', 'error');
        return;
    }

    const name = DOM.costingMaterialNameInput.value.trim();
    const spec = DOM.costingMaterialSpecInput.value.trim();
    const unit = DOM.costingMaterialUnitInput.value.trim();
    const dimensions = DOM.costingMaterialDimensionsInput.value.trim();
    const price = parseFloat(DOM.costingMaterialPriceInput.value) || 0;

    if (!name) {
        showNotification('Vui lòng nhập Tên Vật tư để lưu vào thư viện.', 'error');
        return;
    }

    const materialLibData = {
        name,
        spec,
        unit,
        dimensions,
        price,
        savedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    UI.showLoader();
    try {
        const existingQuery = await db.collection('users').doc(userId).collection('materialsLibrary')
                                      .where('name', '==', name)
                                      .limit(1).get();
        if (!existingQuery.empty) {
            if (!confirm(`Vật tư "${name}" đã có trong thư viện. Bạn có muốn cập nhật thông tin (ghi đè)?`)) {
                UI.hideLoader();
                return;
            }
            const docIdToUpdate = existingQuery.docs[0].id;
            await db.collection('users').doc(userId).collection('materialsLibrary').doc(docIdToUpdate).set(materialLibData, {merge: true});
            showNotification(`Đã cập nhật vật tư "${name}" trong thư viện.`, 'success');
        } else {
            await db.collection('users').doc(userId).collection('materialsLibrary').add(materialLibData);
            showNotification(`Đã lưu vật tư "${name}" vào thư viện.`, 'success');
        }
    } catch (error) {
        console.error("Lỗi khi lưu vật tư vào thư viện:", error);
        showNotification('Lưu vào thư viện thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}


// --- DIRECT LABOR ---
export function addLaborToCosting() {
    const description = DOM.costingLaborDescriptionInput.value.trim();
    const hours = parseFloat(DOM.costingLaborHoursInput.value) || 0;
    const rate = parseFloat(DOM.costingLaborRateInput.value) || 0;

    if (!description) {
        showNotification('Vui lòng nhập Công đoạn.', 'error');
        return;
    }
    if (hours <= 0) {
        showNotification('Số giờ nhân công phải lớn hơn 0.', 'error');
        return;
    }
    if (rate < 0) {
        showNotification('Đơn giá/giờ không hợp lệ.', 'error');
        return;
    }

    const laborData = {
        description,
        hours,
        rate,
        total: hours * rate
    };

    if (editingLaborId) {
        const index = currentCostingLabor.findIndex(lab => lab.id === editingLaborId);
        if (index > -1) {
            currentCostingLabor[index] = { ...currentCostingLabor[index], ...laborData };
        }
        showNotification('Đã cập nhật chi phí nhân công.', 'success');
        resetLaborEditState();
    } else {
        currentCostingLabor.push({ id: generateUniqueId('lab'), ...laborData });
        showNotification('Đã thêm chi phí nhân công.', 'success');
    }

    renderLaborTable();
    clearLaborInputForm();
    calculateAllCosts();
}

function clearLaborInputForm() {
    DOM.costingLaborDescriptionInput.value = '';
    DOM.costingLaborHoursInput.value = '';
    DOM.costingLaborRateInput.value = '';
    if (!editingLaborId) DOM.costingLaborDescriptionInput.focus();
}

function resetLaborEditState() {
    editingLaborId = null;
    DOM.editingLaborIdInput.value = '';
    DOM.addCostingLaborButton.textContent = '+ N.Công';
    DOM.cancelEditLaborButton.style.display = 'none';
    clearLaborInputForm();
}

export function editLaborOnForm(laborId) {
    const laborItem = currentCostingLabor.find(lab => lab.id === laborId);
    if (laborItem) {
        if(DOM.costingLaborFormDetails && !DOM.costingLaborFormDetails.open) {
            DOM.costingLaborFormDetails.open = true;
        }
        editingLaborId = laborItem.id;
        DOM.editingLaborIdInput.value = laborItem.id;
        DOM.costingLaborDescriptionInput.value = laborItem.description;
        DOM.costingLaborHoursInput.value = laborItem.hours;
        DOM.costingLaborRateInput.value = laborItem.rate;

        DOM.addCostingLaborButton.textContent = 'Cập nhật NC';
        DOM.cancelEditLaborButton.style.display = 'inline-block';
        DOM.costingLaborDescriptionInput.focus();
         if(DOM.costingLaborEntryForm) DOM.costingLaborEntryForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function removeLaborFromCosting(laborId) {
    currentCostingLabor = currentCostingLabor.filter(lab => lab.id !== laborId);
    if (editingLaborId === laborId) {
        resetLaborEditState();
    }
    renderLaborTable();
    calculateAllCosts();
}

function renderLaborTable() {
    let html = '';
    currentCostingLabor.forEach((lab, index) => {
        html += `
            <tr data-id="${lab.id}" data-type="costingLabor">
                <td>${index + 1}</td>
                <td>${lab.description}</td>
                <td style="text-align:right;">${lab.hours.toLocaleString('vi-VN')}</td>
                <td style="text-align:right;">${formatCurrency(lab.rate)}</td>
                <td style="text-align:right;">${formatCurrency(lab.total)}</td>
                <td class="no-print action-trigger-cell">
                     <button class="action-trigger" data-item-id="${lab.id}" data-item-type="costingLabor" title="Hành động">⋮</button>
                </td>
            </tr>
        `;
    });
    DOM.costingLaborTableBody.innerHTML = html;
}


// --- OTHER COSTS ---
export function addOtherCostToCosting() {
    const description = DOM.costingOtherCostDescriptionInput.value.trim();
    const amount = parseFloat(DOM.costingOtherCostAmountInput.value) || 0;

    if (!description) {
        showNotification('Vui lòng nhập Nội dung Chi phí Khác.', 'error');
        return;
    }
    if (amount <= 0) {
        showNotification('Số tiền Chi phí Khác phải lớn hơn 0.', 'error');
        return;
    }

    const otherCostData = {
        description,
        amount,
        total: amount
    };

    if (editingOtherCostId) {
        const index = currentOtherCosts.findIndex(cost => cost.id === editingOtherCostId);
        if (index > -1) {
            currentOtherCosts[index] = { ...currentOtherCosts[index], ...otherCostData };
        }
        showNotification('Đã cập nhật chi phí khác.', 'success');
        resetOtherCostEditState();
    } else {
        currentOtherCosts.push({ id: generateUniqueId('oth'), ...otherCostData });
        showNotification('Đã thêm chi phí khác.', 'success');
    }

    renderOtherCostsTable();
    clearOtherCostInputForm();
    calculateAllCosts();
}

function clearOtherCostInputForm() {
    DOM.costingOtherCostDescriptionInput.value = '';
    DOM.costingOtherCostAmountInput.value = '';
    if (!editingOtherCostId) DOM.costingOtherCostDescriptionInput.focus();
}

function resetOtherCostEditState() {
    editingOtherCostId = null;
    DOM.editingOtherCostIdInput.value = '';
    DOM.addCostingOtherCostButton.textContent = '+ Thêm C.Phí Khác';
    DOM.cancelEditOtherCostButton.style.display = 'none';
    clearOtherCostInputForm();
}

export function editOtherCostOnForm(otherCostId) {
    const costItem = currentOtherCosts.find(cost => cost.id === otherCostId);
    if (costItem) {
        if(DOM.costingOtherCostFormDetails && !DOM.costingOtherCostFormDetails.open) {
            DOM.costingOtherCostFormDetails.open = true;
        }
        editingOtherCostId = costItem.id;
        DOM.editingOtherCostIdInput.value = costItem.id;
        DOM.costingOtherCostDescriptionInput.value = costItem.description;
        DOM.costingOtherCostAmountInput.value = costItem.amount;

        DOM.addCostingOtherCostButton.textContent = 'Cập nhật CPK';
        DOM.cancelEditOtherCostButton.style.display = 'inline-block';
        DOM.costingOtherCostDescriptionInput.focus();
        if(DOM.costingOtherCostEntryForm) DOM.costingOtherCostEntryForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function removeOtherCostFromCosting(otherCostId) {
    currentOtherCosts = currentOtherCosts.filter(cost => cost.id !== otherCostId);
     if (editingOtherCostId === otherCostId) {
        resetOtherCostEditState();
    }
    renderOtherCostsTable();
    calculateAllCosts();
}

function renderOtherCostsTable() {
    let html = '';
    currentOtherCosts.forEach((cost, index) => {
        html += `
            <tr data-id="${cost.id}" data-type="costingOtherCost">
                <td>${index + 1}</td>
                <td>${cost.description}</td>
                <td style="text-align:right;">${formatCurrency(cost.amount)}</td>
                <td class="no-print action-trigger-cell">
                    <button class="action-trigger" data-item-id="${cost.id}" data-item-type="costingOtherCost" title="Hành động">⋮</button>
                </td>
            </tr>
        `;
    });
    DOM.costingOtherCostsTableBody.innerHTML = html;
}

// --- COST CALCULATIONS ---
export function calculateAllCosts() {
    const productLengthM = (parseFloat(DOM.costingProductLengthInput.value) || 0) / 1000;
    const productWidthM = (parseFloat(DOM.costingProductWidthInput.value) || 0) / 1000;
    const productHeightM = (parseFloat(DOM.costingProductHeightInput.value) || 0) / 1000;

    let totalMaterialsCost = 0;
    currentCostingMaterials.forEach(mat => {
        let quantityUsed = mat.itemQuantity;
        switch(mat.linkType) {
            case 'PRODUCT_L': quantityUsed = productLengthM * mat.itemQuantity; break;
            case 'PRODUCT_W': quantityUsed = productWidthM * mat.itemQuantity; break;
            case 'PRODUCT_H': quantityUsed = productHeightM * mat.itemQuantity; break;
            case 'PRODUCT_AREA_LW': quantityUsed = productLengthM * productWidthM * mat.itemQuantity; break;
            case 'PRODUCT_AREA_LH': quantityUsed = productLengthM * productHeightM * mat.itemQuantity; break;
            case 'PRODUCT_AREA_WH': quantityUsed = productWidthM * productHeightM * mat.itemQuantity; break;
            case 'PRODUCT_PERIMETER_LW': quantityUsed = 2 * (productLengthM + productWidthM) * mat.itemQuantity; break;
        }

        const costBeforeWaste = quantityUsed * mat.price;
        mat.total = costBeforeWaste * (1 + (mat.waste / 100));
        totalMaterialsCost += mat.total;
    });
    DOM.totalDirectMaterialsCostSpan.textContent = formatCurrency(totalMaterialsCost);
    renderMaterialsTable();

    let totalLaborCost = 0;
    currentCostingLabor.forEach(lab => {
        lab.total = lab.hours * lab.rate;
        totalLaborCost += lab.total;
    });
    DOM.totalDirectLaborCostSpan.textContent = formatCurrency(totalLaborCost);
    renderLaborTable();

    let totalOtherCost = 0; // Renamed for clarity
    currentOtherCosts.forEach(cost => {
        cost.total = cost.amount;
        totalOtherCost += cost.total;
    });
    DOM.totalOtherCostsSpan.textContent = formatCurrency(totalOtherCost);
    renderOtherCostsTable();

    const overheadCost = parseFloat(DOM.costingOverheadTotalInput.value) || 0;
    const managementCost = parseFloat(DOM.costingManagementCostTotalInput.value) || 0;
    const salesMarketingCost = parseFloat(DOM.costingSalesMarketingCostTotalInput.value) || 0;

    const totalCost = totalMaterialsCost + totalLaborCost + overheadCost + totalOtherCost + managementCost + salesMarketingCost;
    DOM.totalCostSpan.textContent = formatCurrency(totalCost);

    const quantityProduced = parseInt(DOM.costingQuantityProducedInput.value) || 1;
    const unitCost = quantityProduced > 0 ? totalCost / quantityProduced : totalCost;
    DOM.unitCostSpan.textContent = formatCurrency(unitCost);

    // Store original calculated costs for "What-If"
    originalCalculatedCosts = {
        materials: totalMaterialsCost,
        labor: totalLaborCost,
        overhead: overheadCost,
        other: totalOtherCost,
        management: managementCost,
        salesMarketing: salesMarketingCost,
        total: totalCost,
        unit: unitCost,
        quantityProduced: quantityProduced
    };

    // Reset What-If scenario results when base costs change
    if(DOM.whatIfUnitCostSpan) DOM.whatIfUnitCostSpan.textContent = formatCurrency(0);
    if(DOM.whatIfDifferenceSpan) DOM.whatIfDifferenceSpan.textContent = formatCurrency(0);
}


// --- "WHAT-IF" SCENARIO CALCULATION ---
function calculateWhatIfScenario() {
    const materialChangePercent = parseFloat(DOM.whatIfMaterialChangeInput.value) || 0;
    const laborChangePercent = parseFloat(DOM.whatIfLaborChangeInput.value) || 0;
    const overheadChangePercent = parseFloat(DOM.whatIfOverheadChangeInput.value) || 0;
    const managementChangePercent = parseFloat(DOM.whatIfManagementChangeInput.value) || 0;
    const salesMarketingChangePercent = parseFloat(DOM.whatIfSalesMarketingChangeInput.value) || 0;

    const scenarioMaterialsCost = originalCalculatedCosts.materials * (1 + materialChangePercent / 100);
    const scenarioLaborCost = originalCalculatedCosts.labor * (1 + laborChangePercent / 100);
    const scenarioOverheadCost = originalCalculatedCosts.overhead * (1 + overheadChangePercent / 100);
    const scenarioManagementCost = originalCalculatedCosts.management * (1 + managementChangePercent / 100);
    const scenarioSalesMarketingCost = originalCalculatedCosts.salesMarketing * (1 + salesMarketingChangePercent / 100);

    // Other costs are not part of "what-if" percentage changes, so use original
    const scenarioTotalCost = scenarioMaterialsCost + scenarioLaborCost + scenarioOverheadCost + originalCalculatedCosts.other + scenarioManagementCost + scenarioSalesMarketingCost;

    const quantityProduced = originalCalculatedCosts.quantityProduced;
    const scenarioUnitCost = quantityProduced > 0 ? scenarioTotalCost / quantityProduced : scenarioTotalCost;
    const difference = scenarioUnitCost - originalCalculatedCosts.unit;

    if (DOM.whatIfUnitCostSpan) DOM.whatIfUnitCostSpan.textContent = formatCurrency(scenarioUnitCost);
    if (DOM.whatIfDifferenceSpan) {
        DOM.whatIfDifferenceSpan.textContent = formatCurrency(difference);
        DOM.whatIfDifferenceSpan.className = difference >= 0 ? 'positive-diff' : 'negative-diff';
    }
}


// --- FORM MANAGEMENT ---
export function clearCostingForm() {
    DOM.costingProductNameInput.value = '';
    DOM.costingSheetIdInput.value = '';
    DOM.costingProductLengthInput.value = '';
    DOM.costingProductWidthInput.value = '';
    DOM.costingProductHeightInput.value = '';
    DOM.costingQuantityProducedInput.value = '1';

    currentCostingMaterials = [];
    currentCostingLabor = [];
    currentOtherCosts = [];
    resetMaterialEditState();
    resetLaborEditState();
    resetOtherCostEditState();

    renderMaterialsTable();
    renderLaborTable();
    renderOtherCostsTable();

    DOM.costingOverheadTotalInput.value = '';
    DOM.costingManagementCostTotalInput.value = '';
    DOM.costingSalesMarketingCostTotalInput.value = '';

    // Clear What-If inputs
    if(DOM.whatIfMaterialChangeInput) DOM.whatIfMaterialChangeInput.value = '0';
    if(DOM.whatIfLaborChangeInput) DOM.whatIfLaborChangeInput.value = '0';
    if(DOM.whatIfOverheadChangeInput) DOM.whatIfOverheadChangeInput.value = '0';
    if(DOM.whatIfManagementChangeInput) DOM.whatIfManagementChangeInput.value = '0';
    if(DOM.whatIfSalesMarketingChangeInput) DOM.whatIfSalesMarketingChangeInput.value = '0';


    calculateAllCosts();
    if (DOM.createCostingFromTemplateSelect) DOM.createCostingFromTemplateSelect.value = '';
    DOM.costingProductNameInput.focus();
}

// --- SAVING AND LOADING COSTING SHEETS ---
export async function saveCostingSheet() {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) {
        showNotification('Bạn cần đăng nhập để lưu phiếu.', 'error');
        return;
    }

    const productName = DOM.costingProductNameInput.value.trim();
    if (!productName) {
        showNotification('Vui lòng nhập Tên Sản phẩm.', 'error');
        return;
    }

    calculateAllCosts(); // Ensure costs are up-to-date before saving

    const sheetData = {
        id: DOM.costingSheetIdInput.value.trim() || generateUniqueId('cost'),
        productName: productName,
        productLength_mm: parseFloat(DOM.costingProductLengthInput.value) || 0,
        productWidth_mm: parseFloat(DOM.costingProductWidthInput.value) || 0,
        productHeight_mm: parseFloat(DOM.costingProductHeightInput.value) || 0,
        quantityProduced: parseInt(DOM.costingQuantityProducedInput.value) || 1,
        materials: currentCostingMaterials,
        labor: currentCostingLabor,
        otherCosts: currentOtherCosts,
        overheadCost: originalCalculatedCosts.overhead, // Save original calculated
        managementCost: originalCalculatedCosts.management, // Save original calculated
        salesMarketingCost: originalCalculatedCosts.salesMarketing, // Save original calculated
        totalCost: originalCalculatedCosts.total, // Save original calculated
        unitCost: originalCalculatedCosts.unit, // Save original calculated
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: userId
    };

    UI.showLoader();
    try {
        await db.collection('users').doc(userId).collection('costingSheets').doc(sheetData.id).set(sheetData);
        showNotification(`Đã lưu Phiếu Giá Thành: ${sheetData.productName}`, 'success');
        clearCostingForm();
    } catch (error) {
        console.error("Lỗi khi lưu phiếu giá thành:", error);
        showNotification('Lưu phiếu giá thành thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}

export function listenToSavedCostingSheets(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection('costingSheets').orderBy('createdAt', 'desc').limit(50);
    const unsubscribe = query.onSnapshot(snapshot => {
        savedCostingSheetsGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSavedCostingSheetsTable();
    }, error => {
        console.error("Lỗi lắng nghe phiếu giá thành đã lưu:", error);
        showNotification('Không thể tải danh sách phiếu giá thành đã lưu.', 'error');
    });
    return unsubscribe;
}

function renderSavedCostingSheetsTable() {
    if (!DOM.savedCostingsTableBody) {
        return; // Prevent crash if element doesn't exist yet
    }

    const searchTerm = DOM.savedCostingsSearchInput ? DOM.savedCostingsSearchInput.value.toLowerCase() : '';

    const filteredSheets = savedCostingSheetsGlobal.filter(sheet => {
        const nameMatch = sheet.productName && sheet.productName.toLowerCase().includes(searchTerm);
        return nameMatch;
    });

    let html = '';
    if (filteredSheets.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;">Chưa có phiếu tính giá nào được lưu hoặc không tìm thấy.</td></tr>';
    } else {
        filteredSheets.forEach((sheet, index) => {
            html += `
                <tr data-id="${sheet.id}" data-type="savedCostingSheet">
                    <td>${index + 1}</td>
                    <td>${sheet.productName}</td>
                    <td>${sheet.createdAt ? formatDate(sheet.createdAt.toDate()) : 'N/A'}</td>
                    <td style="text-align:right;">${formatCurrency(sheet.unitCost)}</td>
                     <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${sheet.id}" data-item-type="savedCostingSheet" title="Hành động">⋮</button>
                    </td>
                </tr>
            `;
        });
    }
    DOM.savedCostingsTableBody.innerHTML = html;
    
    if (DOM.savedCostingsCountSpan) {
        DOM.savedCostingsCountSpan.textContent = filteredSheets.length;
    }
}

export async function loadCostingSheet(sheetId) {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) return;
    UI.showLoader();
    try {
        const docRef = db.collection('users').doc(userId).collection('costingSheets').doc(sheetId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            DOM.costingProductNameInput.value = data.productName || '';
            DOM.costingSheetIdInput.value = data.id || sheetId;
            DOM.costingProductLengthInput.value = data.productLength_mm || '';
            DOM.costingProductWidthInput.value = data.productWidth_mm || '';
            DOM.costingProductHeightInput.value = data.productHeight_mm || '';
            DOM.costingQuantityProducedInput.value = data.quantityProduced || 1;

            currentCostingMaterials = data.materials || [];
            currentCostingLabor = data.labor || [];
            currentOtherCosts = data.otherCosts || [];

            DOM.costingOverheadTotalInput.value = data.overheadCost || '';
            DOM.costingManagementCostTotalInput.value = data.managementCost || '';
            DOM.costingSalesMarketingCostTotalInput.value = data.salesMarketingCost || '';

            resetMaterialEditState();
            resetLaborEditState();
            resetOtherCostEditState();
            renderMaterialsTable();
            renderLaborTable();
            renderOtherCostsTable();
            calculateAllCosts();
            DOM.costingProductNameInput.focus();
            showNotification(`Đã tải Phiếu Giá Thành: ${data.productName}`, 'success');
        } else {
            showNotification('Không tìm thấy phiếu giá thành này.', 'error');
        }
    } catch (error) {
        console.error("Lỗi khi tải phiếu giá thành:", error);
        showNotification('Lỗi khi tải phiếu giá thành.', 'error');
    } finally {
        UI.hideLoader();
    }
}

export async function deleteCostingSheet(sheetId) {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) return;
    UI.showLoader();
    try {
        await db.collection('users').doc(userId).collection('costingSheets').doc(sheetId).delete();
        showNotification('Đã xóa phiếu tính giá.', 'success');
    } catch (error) {
        console.error("Lỗi khi xóa phiếu giá thành:", error);
        showNotification('Xóa phiếu giá thành thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}

export async function duplicateCostingSheet(sheetId) {
    const userId = auth.currentUser ? auth.currentUser.uid : null;
    if (!userId) return;
    UI.showLoader();
    try {
        const originalSheetRef = db.collection('users').doc(userId).collection('costingSheets').doc(sheetId);
        const originalSheetSnap = await originalSheetRef.get();

        if (originalSheetSnap.exists) {
            const originalData = originalSheetSnap.data();
            const newSheetId = generateUniqueId('cost');
            const duplicatedSheet = {
                ...originalData,
                id: newSheetId,
                productName: `${originalData.productName} (Copy)`,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                 materials: originalData.materials.map(mat => ({...mat, id: generateUniqueId('mat')})),
                 labor: originalData.labor.map(lab => ({...lab, id: generateUniqueId('lab')})),
                 otherCosts: originalData.otherCosts.map(cost => ({...cost, id: generateUniqueId('oth')})),
            };
            await db.collection('users').doc(userId).collection('costingSheets').doc(newSheetId).set(duplicatedSheet);
            showNotification(`Đã nhân bản phiếu "${originalData.productName}".`, 'success');
            await loadCostingSheet(newSheetId);
        } else {
            showNotification('Không tìm thấy phiếu gốc để nhân bản.', 'error');
        }
    } catch (error) {
        console.error("Lỗi nhân bản phiếu giá thành:", error);
        showNotification('Nhân bản phiếu thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}


// --- MATERIALS LIBRARY ---
function renderMaterialsLibraryTable() {
    let html = '';
    const searchTerm = DOM.materialsLibrarySearchInput.value.toLowerCase();

    const filteredMaterials = materialsLibraryGlobal.filter(mat => {
        const nameMatch = mat.name && mat.name.toLowerCase().includes(searchTerm);
        const specMatch = mat.spec && mat.spec.toLowerCase().includes(searchTerm);
        return nameMatch || specMatch;
    });

    if (filteredMaterials.length === 0) {
        html = '<tr><td colspan="7" style="text-align:center;">Thư viện vật tư trống hoặc không tìm thấy kết quả.</td></tr>';
    } else {
        filteredMaterials.forEach((mat, index) => {
            html += `
                <tr data-id="${mat.id}" data-type="libraryMaterial">
                    <td>${index + 1}</td>
                    <td>${mat.name}</td>
                    <td>${mat.spec || ''}</td>
                    <td>${mat.unit || ''}</td>
                    <td style="text-align:right;">${formatCurrency(mat.price)}</td>
                    <td>${mat.dimensions || ''}</td>
                    <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${mat.id}" data-item-type="libraryMaterial" title="Hành động">⋮</button>
                    </td>
                </tr>
            `;
        });
    }
    DOM.materialsLibraryList.innerHTML = html;
    DOM.materialsLibraryCountSpan.textContent = filteredMaterials.length;
}

export function loadMaterialFromLibrary(materialId) {
    const material = materialsLibraryGlobal.find(mat => mat.id === materialId);
    if (material) {
        DOM.costingMaterialNameInput.value = material.name;
        DOM.costingMaterialSpecInput.value = material.spec || '';
        DOM.costingMaterialUnitInput.value = material.unit || '';
        DOM.costingMaterialDimensionsInput.value = material.dimensions || '';
        DOM.costingMaterialPriceInput.value = material.price || '';
        DOM.costingMaterialWasteInput.value = '0'; // Default waste to 0
        DOM.costingMaterialLinkDim.value = 'NONE';
        updateCostingMaterialQuantityLabel();
        DOM.costingMaterialQuantityInput.value = '1';

        DOM.costingMaterialNameInput.focus();
        if(DOM.costingMaterialFormDetails && !DOM.costingMaterialFormDetails.open) {
            DOM.costingMaterialFormDetails.open = true;
        }
        if(DOM.costingMaterialEntryForm) DOM.costingMaterialEntryForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showNotification(`Đã tải vật tư "${material.name}" từ thư viện.`, 'info');
    }
}

export async function deleteMaterialFromLibrary(materialId, userId) {
    if (!userId) return;
    UI.showLoader();
    try {
        await db.collection('users').doc(userId).collection('materialsLibrary').doc(materialId).delete();
        showNotification('Đã xóa vật tư khỏi thư viện.', 'success');
    } catch (error) {
        console.error("Lỗi khi xóa vật tư khỏi thư viện:", error);
        showNotification('Xóa vật tư thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}

// --- SUGGESTIONS FOR MATERIAL NAME ---
function showCostingMaterialNameSuggestions(inputText) {
    const container = DOM.costingMaterialNameSuggestionsContainer;
    if (!container || !DOM.costingMaterialNameInput) return;

    if (!inputText || inputText.length < 2) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }

    let suggestions = [];

    materialsLibraryGlobal.forEach(item => {
        if (item.name.toLowerCase().includes(inputText.toLowerCase())) {
            suggestions.push({
                id: item.id,
                name: item.name,
                source: 'library',
                price: item.price,
                unit: item.unit,
                spec: item.spec,
                dimensions: item.dimensions
            });
        }
    });

    // Potentially add suggestions from past costing sheets if needed (more complex)

    suggestions.sort((a, b) => a.name.localeCompare(b.name));
    suggestions = suggestions.slice(0, 7);

    if (suggestions.length > 0) {
        container.innerHTML = suggestions.map(s => {
            const regex = new RegExp(`(${inputText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            const highlightedName = s.name.replace(regex, '<strong>$1</strong>');
            const sourceText = '(Thư viện)';
            const priceText = s.price !== undefined ? formatCurrency(s.price) : 'N/A';
            const unitText = s.unit || 'N/A';
            return `<div class="suggestion-item" data-id="${s.id}" data-source="${s.source}">
                        ${highlightedName} <em class="suggestion-source">${sourceText}</em>
                        <span class="suggestion-details">${unitText} - ${priceText} - ${s.spec || ''}</span>
                    </div>`;
        }).join('');
        container.style.display = 'block';
        container.style.top = `${DOM.costingMaterialNameInput.offsetTop + DOM.costingMaterialNameInput.offsetHeight + 2}px`;
        container.style.left = `${DOM.costingMaterialNameInput.offsetLeft}px`;
        container.style.width = `${DOM.costingMaterialNameInput.offsetWidth}px`;
    } else {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

function selectCostingMaterialNameSuggestion(itemId, source) {
    if (source === 'library') {
        const selectedMaterial = materialsLibraryGlobal.find(item => item.id === itemId);
        if (selectedMaterial) {
            DOM.costingMaterialNameInput.value = selectedMaterial.name;
            DOM.costingMaterialSpecInput.value = selectedMaterial.spec || '';
            DOM.costingMaterialUnitInput.value = selectedMaterial.unit || '';
            DOM.costingMaterialDimensionsInput.value = selectedMaterial.dimensions || '';
            DOM.costingMaterialPriceInput.value = selectedMaterial.price || '';
            DOM.costingMaterialWasteInput.value = '0';
            DOM.costingMaterialLinkDim.value = 'NONE';
            updateCostingMaterialQuantityLabel();
            DOM.costingMaterialQuantityInput.value = '1';
        }
    }
    // else if (source === 'past_costing') { ... } // If implemented

    if (DOM.costingMaterialNameSuggestionsContainer) {
        DOM.costingMaterialNameSuggestionsContainer.innerHTML = '';
        DOM.costingMaterialNameSuggestionsContainer.style.display = 'none';
    }
    DOM.costingMaterialSpecInput.focus();
}

function updateCostingMaterialQuantityLabel() {
    const linkType = DOM.costingMaterialLinkDim.value;
    if (linkType === 'NONE') {
        DOM.costingMaterialQuantityLabel.textContent = 'Số lượng Vật tư:';
    } else {
        DOM.costingMaterialQuantityLabel.textContent = 'Hệ số nhân Vật tư:';
    }
}

// --- TEMPLATE MANAGEMENT FUNCTIONS ---
export function listenToCostingTemplates(userId) {
    if (!userId) return () => {};
    const query = db.collection('users').doc(userId).collection(COSTING_TEMPLATES_COLLECTION).orderBy('name');
    const unsubscribe = query.onSnapshot(snapshot => {
        costingTemplatesGlobal = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCostingTemplatesList(costingTemplatesGlobal);
        populateCreateFromCostingTemplateSelect(costingTemplatesGlobal);
    }, error => {
        console.error("Lỗi lắng nghe mẫu phiếu giá thành:", error);
        showNotification('Không thể tải danh sách mẫu phiếu giá thành.', 'error');
    });
    return unsubscribe;
}

export async function saveCostingAsTemplateHandler(userId) {
    if (!userId) return;
    if (currentCostingMaterials.length === 0 && currentCostingLabor.length === 0 && currentOtherCosts.length === 0) {
        showNotification("Phiếu tính giá hiện tại trống, không thể lưu làm mẫu.", 'info');
        return;
    }
    const templateName = prompt("Nhập tên cho mẫu phiếu tính giá này:", "Mẫu PGT Mới");
    if (!templateName || templateName.trim() === "") {
        showNotification("Tên mẫu không hợp lệ.", "info");
        return;
    }

    const templateData = {
        name: templateName.trim(),
        materials: currentCostingMaterials.map(mat => ({ // Exclude dynamic 'total'
            name: mat.name, spec: mat.spec, unit: mat.unit, dimensions: mat.dimensions,
            itemQuantity: mat.itemQuantity, price: mat.price, waste: mat.waste, linkType: mat.linkType
        })),
        labor: currentCostingLabor.map(lab => ({ // Exclude dynamic 'total'
            description: lab.description, hours: lab.hours, rate: lab.rate
        })),
        otherCosts: currentOtherCosts.map(cost => ({ // Exclude dynamic 'total'
            description: cost.description, amount: cost.amount
        })),
        // Save estimated base costs if they are meant to be part of the template
        overheadCost: parseFloat(DOM.costingOverheadTotalInput.value) || 0,
        managementCost: parseFloat(DOM.costingManagementCostTotalInput.value) || 0,
        salesMarketingCost: parseFloat(DOM.costingSalesMarketingCostTotalInput.value) || 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    UI.showLoader();
    try {
        await db.collection('users').doc(userId).collection(COSTING_TEMPLATES_COLLECTION).add(templateData);
        showNotification(`Đã lưu mẫu phiếu tính giá "${templateName.trim()}".`, 'success');
    } catch (error) {
        console.error("Lỗi lưu mẫu PGT:", error);
        showNotification('Lưu mẫu PGT thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}


export async function loadCostingFromTemplateHandler(templateId, userId) {
    if (!templateId || !userId) return;
    UI.showLoader();
    try {
        const docRef = db.collection('users').doc(userId).collection(COSTING_TEMPLATES_COLLECTION).doc(templateId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const template = docSnap.data();

            // Clear current form BUT keep product name, dimensions, quantity
            const currentProductName = DOM.costingProductNameInput.value;
            const currentProdLength = DOM.costingProductLengthInput.value;
            const currentProdWidth = DOM.costingProductWidthInput.value;
            const currentProdHeight = DOM.costingProductHeightInput.value;
            const currentProdQuantity = DOM.costingQuantityProducedInput.value;

            clearCostingForm(); // This will reset everything including product info

            // Restore product info
            DOM.costingProductNameInput.value = currentProductName || template.productNameHint || ''; // Optional: Use a hint from template
            DOM.costingProductLengthInput.value = currentProdLength;
            DOM.costingProductWidthInput.value = currentProdWidth;
            DOM.costingProductHeightInput.value = currentProdHeight;
            DOM.costingQuantityProducedInput.value = currentProdQuantity || '1';


            currentCostingMaterials = template.materials.map(mat => ({ ...mat, id: generateUniqueId('mat'), total:0 }));
            currentCostingLabor = template.labor.map(lab => ({ ...lab, id: generateUniqueId('lab'), total:0 }));
            currentOtherCosts = template.otherCosts.map(cost => ({ ...cost, id: generateUniqueId('oth'), total:0 }));

            DOM.costingOverheadTotalInput.value = template.overheadCost || '';
            DOM.costingManagementCostTotalInput.value = template.managementCost || '';
            DOM.costingSalesMarketingCostTotalInput.value = template.salesMarketingCost || '';

            resetMaterialEditState();
            resetLaborEditState();
            resetOtherCostEditState();
            renderMaterialsTable();
            renderLaborTable();
            renderOtherCostsTable();
            calculateAllCosts();
            UI.openTab('tabCosting');
            showNotification(`Đã tải phiếu tính giá từ mẫu "${template.name}".`, 'success');
            DOM.costingProductNameInput.focus();

        } else {
            showNotification('Không tìm thấy mẫu phiếu tính giá này.', 'error');
        }
    } catch (error) {
        console.error("Lỗi tải mẫu PGT:", error);
        showNotification('Lỗi khi tải mẫu PGT.', 'error');
    } finally {
        UI.hideLoader();
    }
}

function renderCostingTemplatesList(templates) {
    if (!DOM.costingTemplatesTableBody || !DOM.costingTemplateCountSpan) return;
    let html = '';
    if (templates.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center;">Chưa có mẫu phiếu tính giá nào.</td></tr>';
    } else {
        templates.forEach((template, index) => {
            const numMaterials = template.materials ? template.materials.length : 0;
            html += `
                <tr data-id="${template.id}" data-type="costingTemplate">
                    <td>${index + 1}</td>
                    <td>${template.name}</td>
                    <td style="text-align:right;">${numMaterials}</td>
                    <td style="text-align:center;">${template.createdAt ? formatDate(template.createdAt.toDate()) : 'N/A'}</td>
                    <td class="no-print action-trigger-cell">
                        <button class="action-trigger" data-item-id="${template.id}" data-item-type="costingTemplate" title="Hành động">⋮</button>
                    </td>
                </tr>
            `;
        });
    }
    DOM.costingTemplatesTableBody.innerHTML = html;
    DOM.costingTemplateCountSpan.textContent = templates.length;
}

export async function deleteCostingTemplateHandler(templateId, userId) {
    if (!templateId || !userId) return;
    UI.showLoader();
    try {
        await db.collection('users').doc(userId).collection(COSTING_TEMPLATES_COLLECTION).doc(templateId).delete();
        showNotification('Đã xóa mẫu phiếu tính giá.', 'success');
    } catch (error) {
        console.error("Lỗi xóa mẫu PGT:", error);
        showNotification('Xóa mẫu PGT thất bại.', 'error');
    } finally {
        UI.hideLoader();
    }
}

export async function renameCostingTemplateHandler(templateId, userId) {
    if (!templateId || !userId) return;
    const templateToRename = costingTemplatesGlobal.find(t => t.id === templateId);
    if (!templateToRename) {
        showNotification('Không tìm thấy mẫu để đổi tên.', 'error');
        return;
    }
    const newName = prompt("Nhập tên mới cho mẫu phiếu tính giá:", templateToRename.name);
    if (newName && newName.trim() !== "") {
        UI.showLoader();
        try {
            await db.collection('users').doc(userId).collection(COSTING_TEMPLATES_COLLECTION).doc(templateId).update({ name: newName.trim() });
            showNotification('Đã đổi tên mẫu phiếu tính giá.', 'success');
        } catch (error) {
            console.error("Lỗi đổi tên mẫu PGT:", error);
            showNotification('Đổi tên mẫu PGT thất bại.', 'error');
        } finally {
            UI.hideLoader();
        }
    } else if (newName !== null) {
        showNotification('Tên mẫu không hợp lệ.', 'info');
    }
}

function populateCreateFromCostingTemplateSelect(templates) {
    if (!DOM.createCostingFromTemplateSelect) return;
    DOM.createCostingFromTemplateSelect.innerHTML = '<option value="">-- Chọn mẫu PGT --</option>';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        DOM.createCostingFromTemplateSelect.appendChild(option);
    });
}


// --- EVENT LISTENERS INITIALIZATION ---
export function initCostingTabEventListeners() {
    DOM.addCostingMaterialButton?.addEventListener('click', addMaterialToCosting);
    DOM.saveMaterialToLibraryButton?.addEventListener('click', saveMaterialToLibrary);
    DOM.cancelEditMaterialButton?.addEventListener('click', resetMaterialEditState);

    DOM.addCostingLaborButton?.addEventListener('click', addLaborToCosting);
    DOM.cancelEditLaborButton?.addEventListener('click', resetLaborEditState);
    
    DOM.addCostingOtherCostButton?.addEventListener('click', addOtherCostToCosting);
    DOM.cancelEditOtherCostButton?.addEventListener('click', resetOtherCostEditState);

    DOM.calculateCostingButton?.addEventListener('click', calculateAllCosts);
    DOM.saveCostingButton?.addEventListener('click', saveCostingSheet);
    DOM.clearCostingFormButton?.addEventListener('click', clearCostingForm);

    DOM.materialsLibrarySearchInput?.addEventListener('input', renderMaterialsLibraryTable);

    DOM.costingMaterialNameInput?.addEventListener('input', (e) => showCostingMaterialNameSuggestions(e.target.value));
    DOM.costingMaterialNameInput?.addEventListener('blur', () => {
        setTimeout(() => {
            if (DOM.costingMaterialNameSuggestionsContainer && !DOM.costingMaterialNameSuggestionsContainer.contains(document.activeElement)) {
                DOM.costingMaterialNameSuggestionsContainer.style.display = 'none';
            }
        }, 150);
    });
     DOM.costingMaterialNameInput?.addEventListener('focus', (e) => {
        if(e.target.value.length >=2) showCostingMaterialNameSuggestions(e.target.value);
    });
    DOM.costingMaterialNameSuggestionsContainer?.addEventListener('mousedown', (e) => {
        const target = e.target.closest('.suggestion-item');
        if (target && target.dataset.id && target.dataset.source) {
            selectCostingMaterialNameSuggestion(target.dataset.id, target.dataset.source);
        }
    });

    DOM.costingMaterialLinkDim?.addEventListener('change', updateCostingMaterialQuantityLabel);
    
    // Toggle form sections
    [DOM.costingMaterialFormDetails, DOM.costingLaborFormDetails, DOM.costingOtherCostFormDetails].forEach(detailsElement => {
        detailsElement?.addEventListener('toggle', (event) => {
            const summaryIcon = event.target.querySelector('.summary-toggle-icon');
            if (summaryIcon) {
                 summaryIcon.textContent = event.target.open ? `(${summaryIcon.dataset.textOpen || 'Ẩn Form'})` : `(${summaryIcon.dataset.textClosed || 'Hiện Form'})`;
            }
        });
    });

    // Costing Templates Listeners
    if (DOM.saveCostingAsTemplateButton) {
        DOM.saveCostingAsTemplateButton.addEventListener('click', () => {
            const userId = auth.currentUser ? auth.currentUser.uid : null;
            if (userId) saveCostingAsTemplateHandler(userId);
        });
    }
    if (DOM.createCostingFromTemplateSelect) {
        DOM.createCostingFromTemplateSelect.addEventListener('change', (e) => {
            const templateId = e.target.value;
            const userId = auth.currentUser ? auth.currentUser.uid : null;
            if (templateId && userId) {
                loadCostingFromTemplateHandler(templateId, userId);
                e.target.value = ""; // Reset select
            }
        });
    }

    // What-If Scenario Listener
    if (DOM.calculateWhatIfButton) {
        DOM.calculateWhatIfButton.addEventListener('click', calculateWhatIfScenario);
    }

    // Listener for the new search input
    DOM.savedCostingsSearchInput?.addEventListener('input', renderSavedCostingSheetsTable);
}