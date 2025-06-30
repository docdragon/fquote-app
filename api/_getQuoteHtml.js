
const path = require('path');
const { formatDate, formatCurrency, numberToRoman, formatNumber } = require(path.join(process.cwd(), 'api', '_utils-for-api.js'));

/**
 * Generates the complete HTML content for the PDF, mimicking the app's UI.
 * This function is self-contained and exported for use by the main PDF generation API.
 * @param {object} quoteData The full data object for the quote.
 * @returns {string} A string containing the full HTML document.
 */
function getQuoteHtml(quoteData) {
    // Defensive destructuring to prevent errors from malformed or incomplete quoteData.
    const { 
        companySettings = {},
        quoteId = 'N/A', 
        customerInfo = {}, 
        items = [], 
        mainCategories = [], 
        totals = {}, 
        installments = {} 
    } = quoteData || {};


    const createItemRowHTML = (item, itemIndex) => {
        let displayNameCellContent = `<div class="item-name-display">${(item.name || '[Chưa có tên]').toUpperCase()}</div>`;
        let dimParts = [];
        if (item.length) dimParts.push(`D ${item.length}mm`);
        if (item.height) dimParts.push(`C ${item.height}mm`);
        if (item.depth) dimParts.push(`S ${item.depth}mm`);
        if (dimParts.length > 0) {
            displayNameCellContent += `<div class="item-dimensions-display">KT: ${dimParts.join(' x ')}</div>`;
        }
        if (item.spec) {
            displayNameCellContent += `<div class="item-spec-display">${item.spec}</div>`;
        }
    
        let priceCellContent = `<strong>${formatCurrency(item.price || 0, false)}</strong>`;
        if ((item.itemDiscountAmount || 0) > 0) {
            let discountText = '';
            if (item.itemDiscountType === 'percent' && (item.itemDiscountValue || 0) > 0) {
                discountText = `<span class="item-discount-percent">(-${item.itemDiscountValue}%)</span>`;
            }
            priceCellContent = `
                <span class="strikethrough-price">${formatCurrency(item.originalPrice || 0, false)}</span>
                <br>
                <strong>${formatCurrency(item.price || 0, false)}</strong>${discountText}
            `;
        }
        
        let displayedMeasureText = '';
        if (item.calculatedMeasure && typeof item.calculatedMeasure === 'number' && item.calcType !== 'unit') {
            let measureInMeters = item.calculatedMeasure;
            // The logic for conversion seems off in the original, correcting it here
            if (item.calcType === 'length') measureInMeters = item.length / 1000;
            else if (item.calcType === 'area') measureInMeters = (item.length * item.height) / 1000000;
            else if (item.calcType === 'volume') measureInMeters = (item.length * item.height * item.depth) / 1000000000;
            
            // This is the total measure for the line item (e.g., total m2) not the base measure.
            const totalMeasure = measureInMeters * (item.quantity || 1);
            displayedMeasureText = `${formatNumber(parseFloat(totalMeasure.toFixed(4)))}`;
        }
    
        const imgSrc = item.imageDataUrl || '';
    
        return `
            <tr class="item-row">
                <td class="center">${itemIndex}</td>
                <td class="center">${imgSrc ? `<img src="${imgSrc}" class="item-image-pdf" alt="Item image">` : ''}</td>
                <td class="item-name-spec-cell">${displayNameCellContent}</td>
                <td class="center">${item.unit || ''}</td>
                <td class="right">${displayedMeasureText}</td>
                <td class="right">${formatNumber((item.quantity || 0), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                <td class="right price-cell">${priceCellContent}</td>
                <td class="right">${formatCurrency(item.lineTotal || 0, false)}</td>
                <td class="notes-cell">${item.notes || ''}</td>
            </tr>
        `;
    };

    const renderItems = () => {
        let html = '';
        const groupedItems = new Map();
        const itemsWithoutCategory = [];

        items.forEach(item => {
            if (item.mainCategoryId && mainCategories.some(cat => cat.id === item.mainCategoryId)) {
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
                
                html += `
                    <tr class="main-category-row">
                        <td class="main-category-roman-numeral">${numberToRoman(categoryCounter)}</td>
                        <td colspan="6" class="main-category-name">${category.name.toUpperCase()}</td>
                        <td class="main-category-total">${formatCurrency(categoryTotal, false)}</td>
                        <td></td>
                    </tr>
                `;
                
                itemsInCategory.forEach(item => {
                    itemCounter++;
                    html += createItemRowHTML(item, itemCounter);
                });
            }
        });

        if (itemsWithoutCategory.length > 0) {
            itemsWithoutCategory.forEach(item => {
                itemCounter++;
                html += createItemRowHTML(item, itemCounter);
            });
        }
        return html;
    };
    
    const renderInstallments = () => {
        if (!installments || !installments.enabled || installments.data.length === 0) {
            return '';
        }

        let totalPercent = 0;
        let totalAmount = 0;
        const grandTotal = totals.grandTotal || 0;

        const rows = installments.data.map((inst, index) => {
             const amount = inst.value > 0
                ? (inst.type === 'percent' ? (grandTotal * inst.value) / 100 : inst.value)
                : 0;
            totalAmount += amount;
            if(inst.type === 'percent') totalPercent += inst.value;
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${inst.name}</td>
                    <td class="right">${inst.type === 'percent' ? `${inst.value}%` : formatCurrency(inst.value)}</td>
                    <td class="right">${formatCurrency(amount)}</td>
                </tr>
            `;
        }).join('');

        const remainingAmount = grandTotal - totalAmount;
        
        return `
            <section class="installments-section-pdf">
                <h3>LỊCH THANH TOÁN</h3>
                <table class="installments-table-pdf">
                    <thead>
                        <tr>
                            <th>Đợt</th>
                            <th>Nội dung</th>
                            <th class="right">Giá trị</th>
                            <th class="right">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="right"><strong>TỔNG CỘNG CÁC ĐỢT</strong></td>
                            <td class="right"><strong>${formatCurrency(totalAmount)}</strong></td>
                        </tr>
                        <tr>
                            <td colspan="3" class="right"><strong>CÒN LẠI</strong></td>
                            <td class="right"><strong>${formatCurrency(remainingAmount)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </section>
        `;
    };

    const bankInfoHtml = companySettings.bankAccount 
        ? companySettings.bankAccount.split('\n').map(line => `<p>${line}</p>`).join('') 
        : '';
    
    const footerHtml = companySettings.printOptions?.footer 
        ? companySettings.printOptions.footer.split('\n').map(line => `<span>${line}</span>`).join('<br>')
        : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${(companySettings.printOptions?.title || 'BÁO GIÁ')} - ${quoteId}</title>
            <style>
                :root {
                    --primary-color: #3B82F6; 
                    --text-primary-color: #1F2937; 
                    --text-secondary-color: #4B5563; 
                    --border-color: #D1D5DB; 
                    --border-color-soft: #E5E7EB; 
                    --surface-color: #FFFFFF;
                    --table-row-hover-bg: #EFF6FF;
                    --primary-color-rgb: 59,130,246; 
                }
                body {
                    font-family: 'Inter', sans-serif;
                    font-size: 9pt;
                    color: var(--text-primary-color);
                    -webkit-print-color-adjust: exact;
                    line-height: 1.5;
                    background-color: var(--surface-color);
                }
                .page {
                    width: 100%;
                    box-sizing: border-box;
                }
                @page {
                    size: A4;
                    margin: 20mm 15mm 20mm 15mm;
                }
                .header-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 5mm;
                }
                .company-info-pdf { flex-grow: 1; }
                .company-logo-pdf { flex-shrink: 0; max-width: 80px; margin-left: 10mm; }
                .company-logo-pdf img { max-width: 100%; height: auto; object-fit: contain; }
                
                h1, h2, h3 { font-weight: 600; margin: 0; }
                h1.quote-title {
                    font-size: 20pt;
                    text-align: center;
                    margin: 8mm 0;
                    text-transform: uppercase;
                }
                .company-info-pdf h2 { font-size: 14pt; color: var(--primary-color); }
                .company-info-pdf p { margin: 1mm 0; font-size: 9pt; color: var(--text-secondary-color); }
                
                .customer-info-pdf {
                    display: flex;
                    border: 1px solid var(--border-color-soft);
                    border-radius: 8px;
                    padding: 3mm 4mm;
                    margin-bottom: 8mm;
                }
                .customer-info-pdf .col { width: 50%; }
                .customer-info-pdf p { margin: 1mm 0; }

                table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                th, td { padding: 8px 10px; border: 1px solid var(--border-color-soft); text-align: left; vertical-align: middle; }
                thead th {
                    background-color: #F3F4F6;
                    font-weight: 600; color: var(--text-secondary-color); 
                    font-size: 8.5pt;
                    text-align: center;
                }
                .center { text-align: center; }
                .right { text-align: right; }
                
                .main-category-row { background-color: rgba(var(--primary-color-rgb), 0.1) !important; }
                .main-category-row td { font-weight: 600; color: var(--primary-color); font-size: 9.5pt; }
                .main-category-roman-numeral { text-align: center; }
                .main-category-name { text-transform: uppercase; }
                .main-category-total { text-align: right; }
                
                .item-image-pdf { max-width: 60px; max-height: 45px; border-radius: 4px; object-fit: contain; margin: auto; display: block; }
                .item-name-spec-cell { line-height: 1.4; }
                .item-name-display { font-weight: 600; color: var(--text-primary-color); margin-bottom: 3px; font-size: 9pt; }
                .item-dimensions-display, .item-spec-display { font-size: 8pt; color: var(--text-secondary-color); font-style: italic; margin-top: 1px; }
                .notes-cell { font-size: 8pt; color: var(--text-secondary-color); white-space: pre-wrap; word-wrap: break-word; }
                .price-cell { line-height: 1.4; }
                .strikethrough-price { text-decoration: line-through; color: var(--text-secondary-color); font-size: 8.5pt; }
                .item-discount-percent { font-size: 8pt; color: #EF4444; font-style: italic; }

                .summary-section-pdf {
                    page-break-inside: avoid;
                    margin-top: 5mm;
                    display: flex;
                    justify-content: flex-end;
                }
                .totals-box {
                    width: 50%;
                    max-width: 90mm;
                    border: 1px solid var(--border-color-soft);
                    border-radius: 8px;
                    padding: 3mm;
                }
                .totals-box table { border: none; }
                .totals-box td, .totals-box th { border: none; padding: 4px; }
                .totals-box .label { text-align: right; padding-right: 3mm; font-weight: 500; color: var(--text-secondary-color);}
                .totals-box .value { text-align: right; font-weight: 600; }
                .totals-box hr { border: none; border-top: 1px solid var(--border-color-soft); margin: 4px 0; }
                .totals-box .grand-total .label, .totals-box .grand-total .value { font-size: 11pt; font-weight: 700; color: var(--primary-color); }
                
                .installments-section-pdf { margin-top: 8mm; page-break-inside: avoid; }
                .installments-section-pdf h3 { font-size: 11pt; margin-bottom: 3mm; border-bottom: 1px solid var(--border-color); padding-bottom: 2mm; }
                .installments-table-pdf th { font-weight: 600; }
                .installments-table-pdf tfoot td { background-color: #F3F4F6; }

                .footer-notes-section {
                    margin-top: 10mm;
                    page-break-inside: avoid;
                }
                .footer-notes-section p { margin: 0 0 1mm 0; }
                .signature-section {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 15mm;
                    page-break-inside: avoid;
                }
                .signature-box { text-align: center; width: 40%; }
                .signature-box p { margin: 0; }
                .signature-box .creator-name { margin-top: 15mm; font-weight: 600; }

                .pdf-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 15mm; 
                    font-size: 8pt;
                    color: #777;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-sizing: border-box;
                    padding: 0 15mm; /* Corresponds to page margin */
                    border-top: 1px solid var(--border-color-soft);
                }

            </style>
        </head>
        <body>
            <div class="page">
                <header class="header-info">
                    <div class="company-info-pdf">
                        <h2>${(companySettings.name || '').toUpperCase()}</h2>
                        <p>${companySettings.address || ''}</p>
                        <p><strong>ĐT:</strong> ${companySettings.phone || ''} | <strong>Email:</strong> ${companySettings.email || ''}</p>
                        ${companySettings.taxId ? `<p><strong>MST:</strong> ${companySettings.taxId}</p>` : ''}
                    </div>
                    ${companySettings.logoDataUrl ? `<div class="company-logo-pdf"><img src="${companySettings.logoDataUrl}" alt="Logo"></div>` : ''}
                </header>
                
                <h1 class="quote-title">${(companySettings.printOptions?.title || 'BÁO GIÁ')}</h1>

                <section class="customer-info-pdf">
                    <div class="col">
                        <p><strong>Khách hàng:</strong> ${customerInfo.name || ''}</p>
                        <p><strong>Địa chỉ:</strong> ${customerInfo.address || ''}</p>
                    </div>
                    <div class="col">
                        <p><strong>Số báo giá:</strong> ${quoteId}</p>
                        <p><strong>Ngày:</strong> ${formatDate(customerInfo.date)}</p>
                    </div>
                </section>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width:3%;">STT</th>
                            <th style="width:8%;">Hình ảnh</th>
                            <th style="width:28%;">Hạng Mục / Mô Tả</th> 
                            <th style="width:5%;">ĐVT</th>
                            <th style="width:6%;">K.Lượng</th>
                            <th style="width:4%;">SL</th> 
                            <th style="width:10%;">Đơn giá</th>
                            <th style="width:12%;">Thành tiền</th>
                            <th style="width:24%;">Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody>${renderItems()}</tbody>
                </table>
                
                <section class="summary-section-pdf">
                    <div class="totals-box">
                        <table>
                            <tr>
                                <td class="label">Tạm tính:</td>
                                <td class="value">${formatCurrency(totals.subTotal)}</td>
                            </tr>
                            ${(totals.discountAmount || 0) > 0 ? `
                            <tr>
                                <td class="label">Giảm giá (${totals.discountType === 'percent' ? `${totals.discountValue}%` : ''}):</td>
                                <td class="value">- ${formatCurrency(totals.discountAmount)}</td>
                            </tr>` : ''}
                            ${(totals.taxAmount || 0) > 0 ? `
                             <tr>
                                <td class="label">Thuế VAT (${totals.taxPercent}%):</td>
                                <td class="value">${formatCurrency(totals.taxAmount)}</td>
                            </tr>` : ''}
                            <tr><td colspan="2"><hr></td></tr>
                            <tr class="grand-total">
                                <td class="label">Tổng cộng:</td>
                                <td class="value">${formatCurrency(totals.grandTotal)}</td>
                            </tr>
                        </table>
                    </div>
                </section>

                ${renderInstallments()}

                <section class="footer-notes-section">
                    ${companySettings.bankAccount ? `<h3>THÔNG TIN CHUYỂN KHOẢN</h3>${bankInfoHtml}` : ''}
                    ${companySettings.defaultQuoteNotes ? `<h3 style="margin-top: 5mm;">GHI CHÚ CHUNG</h3><p style="white-space: pre-wrap;">${companySettings.defaultQuoteNotes}</p>` : ''}
                </section>

                <section class="signature-section">
                    <div class="signature-box">
                        <p>Phan Rang, ${formatDate(new Date())}</p>
                        <p><strong>Người lập báo giá</strong></p>
                        <p class="creator-name">${companySettings.printOptions?.creatorName || ''}</p>
                    </div>
                </section>
            </div>
            <!-- The footer content is handled by Puppeteer's displayHeaderFooter option -->
        </body>
        </html>
    `;
}

module.exports = { getQuoteHtml };