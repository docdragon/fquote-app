/**
 * @file _getQuoteDocDefinition.js
 * @description Creates a document definition object for pdfmake.
 * UPDATED: Now expects images as Base64 Data URIs (`imageDataUrl`, `logoDataUrl`) instead of public URLs.
 */
const path = require('path');
const { formatDate, formatCurrency, numberToRoman, formatNumber } = require(path.join(process.cwd(), 'api', '_utils-for-api.js'));

function getQuoteDocDefinition(quoteData) {
    const { 
        companySettings = {},
        quoteId = 'N/A', 
        customerInfo = {}, 
        items = [], 
        mainCategories = [], 
        totals = {}, 
        installments = {} 
    } = quoteData || {};

    const tableBody = [];
    const tableHeader = [
        { text: 'STT', style: 'tableHeader', alignment: 'center' },
        { text: 'Hình ảnh', style: 'tableHeader', alignment: 'center' },
        { text: 'Hạng Mục / Mô Tả', style: 'tableHeader', alignment: 'left' },
        { text: 'ĐVT', style: 'tableHeader', alignment: 'center' },
        { text: 'K.Lượng', style: 'tableHeader', alignment: 'center' },
        { text: 'SL', style: 'tableHeader', alignment: 'center' },
        { text: 'Đơn giá', style: 'tableHeader', alignment: 'right' },
        { text: 'Thành tiền', style: 'tableHeader', alignment: 'right' },
        { text: 'Ghi Chú', style: 'tableHeader', alignment: 'left' }
    ];
    tableBody.push(tableHeader);

    const groupedItems = new Map();
    const itemsWithoutCategory = [];

    items.forEach(item => {
        if (item.mainCategoryId && mainCategories.some(cat => cat.id === item.mainCategoryId)) {
            if (!groupedItems.has(item.mainCategoryId)) groupedItems.set(item.mainCategoryId, []);
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
            
            tableBody.push([
                { text: numberToRoman(categoryCounter), colSpan: 1, style: 'categoryCell', alignment: 'center' },
                { text: category.name.toUpperCase(), colSpan: 6, style: 'categoryCell' },
                {}, {}, {}, {}, {},
                { text: formatCurrency(categoryTotal, false), colSpan: 1, style: 'categoryCell', alignment: 'right' },
                { text: '', style: 'categoryCell' }
            ]);
            
            itemsInCategory.forEach(item => {
                itemCounter++;
                tableBody.push(createItemRow(item, itemCounter));
            });
        }
    });

    if (itemsWithoutCategory.length > 0) {
         tableBody.push([ { text: 'Hạng mục khác', colSpan: 9, style: 'categoryCell' }, {}, {}, {}, {}, {}, {}, {}, {} ]);
        itemsWithoutCategory.forEach(item => {
            itemCounter++;
            tableBody.push(createItemRow(item, itemCounter));
        });
    }

    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60], // [left, top, right, bottom]
        header: {
            columns: [
                {
                    stack: [
                        { text: (companySettings.name || '').toUpperCase(), style: 'companyName' },
                        { text: companySettings.address || '', style: 'companyDetails' },
                        { text: `ĐT: ${companySettings.phone || ''} | Email: ${companySettings.email || ''}`, style: 'companyDetails' },
                        companySettings.taxId ? { text: `MST: ${companySettings.taxId}`, style: 'companyDetails' } : {},
                    ],
                    width: '*'
                },
                // Use the pre-fetched Base64 data URI for the logo
                companySettings.logoDataUrl ? { 
                    image: companySettings.logoDataUrl,
                    width: 70,
                    alignment: 'right'
                } : { text: '', width: 70 }
            ],
            margin: [40, 20, 40, 10]
        },
        footer: function(currentPage, pageCount) {
            const footerText = (companySettings.printOptions?.footer || '').split('\n').map(line => line.trim()).join(' - ');
            return {
                columns: [
                    { text: footerText, alignment: 'left', style: 'footer' },
                    { text: `Trang ${currentPage.toString()} / ${pageCount}`, alignment: 'right', style: 'footer' }
                ],
                margin: [40, 10, 40, 0]
            };
        },
        content: [
            { text: companySettings.printOptions?.title || 'BÁO GIÁ', style: 'title' },
            {
                margin: [0, 20, 0, 20],
                table: {
                    widths: ['50%', '50%'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: [{ text: 'Khách hàng: ', bold: true }, customerInfo.name || ''] },
                                    { text: [{ text: 'Địa chỉ: ', bold: true }, customerInfo.address || ''] },
                                ],
                                style: 'customerInfo'
                            },
                             {
                                stack: [
                                    { text: [{ text: 'Số báo giá: ', bold: true }, quoteId] },
                                    { text: [{ text: 'Ngày: ', bold: true }, formatDate(customerInfo.date)] },
                                ],
                                style: 'customerInfo'
                            }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines'
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                    body: tableBody
                },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1 : 0.5,
                    vLineWidth: (i, node) => 0.5,
                    hLineColor: (i, node) => '#D1D5DB',
                    vLineColor: (i, node) => '#D1D5DB',
                    paddingTop: (i, node) => 5,
                    paddingBottom: (i, node) => 5,
                }
            },
            {
                alignment: 'right',
                table: {
                    widths: ['*', 'auto'],
                    body: [
                        ['Tạm tính:', { text: formatCurrency(totals.subTotal), alignment: 'right' }],
                        ...(totals.discountAmount > 0 ? [['Giảm giá:', { text: `- ${formatCurrency(totals.discountAmount)}`, alignment: 'right' }]] : []),
                        ...(totals.taxAmount > 0 ? [[`Thuế VAT (${totals.taxPercent}%):`, { text: formatCurrency(totals.taxAmount), alignment: 'right' }]] : []),
                        [{text: 'Tổng cộng:', style: 'grandTotalLabel'}, {text: formatCurrency(totals.grandTotal), style: 'grandTotalValue', alignment: 'right'}]
                    ]
                },
                layout: 'noBorders',
                margin: [0, 20, 0, 0],
                width: '50%'
            },
            ...buildInstallmentsSection(installments, totals),
            {
                margin: [0, 40, 0, 0],
                stack: [
                    companySettings.bankAccount ? { text: 'THÔNG TIN CHUYỂN KHOẢN', style: 'sectionHeader' } : {},
                    companySettings.bankAccount ? { text: companySettings.bankAccount, style: 'notes' } : {},
                    companySettings.defaultQuoteNotes ? { text: 'GHI CHÚ CHUNG', style: 'sectionHeader', margin: [0, 15, 0, 0] } : {},
                    companySettings.defaultQuoteNotes ? { text: companySettings.defaultQuoteNotes, style: 'notes' } : {},
                ]
            },
            {
                absolutePosition: { y: 720 },
                 alignment: 'right',
                 stack: [
                    { text: `Phan Rang, ${formatDate(new Date())}` },
                    { text: 'Người lập báo giá', bold: true, margin: [0, 5, 0, 0] },
                    { text: companySettings.printOptions?.creatorName || '', margin: [0, 40, 0, 0] }
                ],
                width: '40%'
            }
        ],
        styles: {
            companyName: { fontSize: 14, bold: true, color: '#3B82F6' },
            companyDetails: { fontSize: 9, color: '#4B5563' },
            title: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 20, 0, 20] },
            customerInfo: { fontSize: 9, margin: [0, 2, 0, 2] },
            tableHeader: { bold: true, fontSize: 8.5, color: '#4B5563', alignment: 'center', fillColor: '#F3F4F6' },
            tableCell: { fontSize: 9 },
            categoryCell: { bold: true, fontSize: 9.5, color: '#3B82F6', fillColor: 'rgba(59, 130, 246, 0.1)' },
            itemName: { bold: true, fontSize: 9 },
            itemDetails: { fontSize: 8, color: '#4B5563', italics: true },
            grandTotalLabel: { bold: true, fontSize: 11 },
            grandTotalValue: { bold: true, fontSize: 12, color: '#3B82F6' },
            sectionHeader: { fontSize: 11, bold: true, margin: [0, 10, 0, 5] },
            notes: { fontSize: 9 },
            footer: { fontSize: 8, color: '#777777' }
        },
        defaultStyle: {
            font: 'Roboto',
            fontSize: 9
        }
    };
    return docDefinition;
}

function createItemRow(item, itemIndex) {
    const itemNameStack = {
        stack: [
            { text: item.name.toUpperCase(), style: 'itemName' },
        ]
    };
    let dimParts = [];
    if (item.length) dimParts.push(`D ${item.length}mm`);
    if (item.height) dimParts.push(`C ${item.height}mm`);
    if (item.depth) dimParts.push(`S ${item.depth}mm`);
    if (dimParts.length > 0) {
        itemNameStack.stack.push({ text: `KT: ${dimParts.join(' x ')}`, style: 'itemDetails' });
    }
    if (item.spec) {
        itemNameStack.stack.push({ text: item.spec, style: 'itemDetails' });
    }

    let priceStack = [
        { text: formatCurrency(item.price || 0, false), bold: true }
    ];
    if ((item.itemDiscountAmount || 0) > 0) {
        priceStack.unshift({ text: formatCurrency(item.originalPrice || 0, false), decoration: 'lineThrough', fontSize: 8.5, color: '#4B5563' });
    }
    
    let displayedMeasureText = '';
    if (item.calculatedMeasure && typeof item.calculatedMeasure === 'number' && item.calcType !== 'unit') {
        let measureInMeters = item.calculatedMeasure;
        if (item.calcType === 'length') measureInMeters = item.length / 1000;
        else if (item.calcType === 'area') measureInMeters = (item.length * item.height) / 1000000;
        else if (item.calcType === 'volume') measureInMeters = (item.length * item.height * item.depth) / 1000000000;
        
        const totalMeasure = measureInMeters * (item.quantity || 1);
        displayedMeasureText = `${formatNumber(parseFloat(totalMeasure.toFixed(4)))}`;
    }

    return [
        { text: itemIndex, alignment: 'center', style: 'tableCell' },
        // Use the pre-fetched Base64 data URI for the item image
        item.imageDataUrl ? { image: item.imageDataUrl, width: 50, alignment: 'center' } : {text: '', alignment: 'center'},
        itemNameStack,
        { text: item.unit || '', alignment: 'center', style: 'tableCell' },
        { text: displayedMeasureText, alignment: 'right', style: 'tableCell' },
        { text: formatNumber((item.quantity || 0), { minimumFractionDigits: 0, maximumFractionDigits: 2 }), alignment: 'right', style: 'tableCell' },
        { stack: priceStack, alignment: 'right', style: 'tableCell' },
        { text: formatCurrency(item.lineTotal || 0, false), alignment: 'right', style: 'tableCell' },
        { text: item.notes || '', style: 'itemDetails' }
    ];
}

function buildInstallmentsSection(installments, totals) {
    if (!installments || !installments.enabled || !installments.data || installments.data.length === 0) {
        return [];
    }
    const grandTotal = totals.grandTotal || 0;
    let totalAmount = 0;
    const body = [
        [{ text: 'Đợt', style: 'tableHeader' }, { text: 'Nội dung', style: 'tableHeader' }, { text: 'Giá trị', style: 'tableHeader', alignment: 'right' }, { text: 'Thành tiền', style: 'tableHeader', alignment: 'right' }]
    ];

    installments.data.forEach((inst, index) => {
        const amount = inst.value > 0 ? (inst.type === 'percent' ? (grandTotal * inst.value) / 100 : inst.value) : 0;
        totalAmount += amount;
        body.push([
            { text: index + 1, alignment: 'center' },
            inst.name,
            { text: inst.type === 'percent' ? `${inst.value}%` : formatCurrency(inst.value), alignment: 'right' },
            { text: formatCurrency(amount), alignment: 'right' }
        ]);
    });

    const remainingAmount = grandTotal - totalAmount;
    body.push([
        { text: 'TỔNG CỘNG', colSpan: 3, bold: true, alignment: 'right', margin: [0, 5, 0, 5] }, {}, {},
        { text: formatCurrency(totalAmount), bold: true, alignment: 'right', margin: [0, 5, 0, 5] }
    ]);
     body.push([
        { text: 'CÒN LẠI', colSpan: 3, bold: true, alignment: 'right' }, {}, {},
        { text: formatCurrency(remainingAmount), bold: true, alignment: 'right' }
    ]);

    return [
        { text: 'LỊCH THANH TOÁN', style: 'sectionHeader' },
        {
            table: {
                headerRows: 1,
                widths: ['auto', '*', 'auto', 'auto'],
                body: body
            },
            layout: 'lightHorizontalLines'
        }
    ];
}

module.exports = { getQuoteDocDefinition };