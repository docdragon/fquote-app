
// api/generate-pdf.js
// Vercel Serverless Function to generate professional PDFs using Puppeteer.

// IMPORTANT: This function relies on 'puppeteer-core' and '@sparticuz/chromium'
// which need to be included in the project's dependencies for Vercel deployment.
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { formatDate, formatCurrency, numberToRoman } = require('./_utils-for-api');

/**
 * Generates the complete HTML content for the PDF.
 * This function creates a professional-looking quote document.
 * @param {object} quoteData The full data object for the quote.
 * @returns {string} A string containing the full HTML document.
 */
function getQuoteHtml(quoteData) {
    const { companySettings, quoteId, customerInfo, items, mainCategories, totals, installments } = quoteData;

    const renderItems = () => {
        let html = '';
        const groupedItems = new Map([['__none__', []]]);

        if (mainCategories) {
            mainCategories.forEach(cat => groupedItems.set(cat.id, []));
        }

        items.forEach(item => {
            const catId = item.mainCategoryId && groupedItems.has(item.mainCategoryId) ? item.mainCategoryId : '__none__';
            groupedItems.get(catId).push(item);
        });

        let categoryCounter = 0;
        let itemCounter = 0;

        const mapItemToRow = (item) => {
            itemCounter++;
            let displayedMeasureText = '';
            if (item.calculatedMeasure && typeof item.calculatedMeasure === 'number' && item.calcType !== 'unit') {
                let measureValue = item.calculatedMeasure;
                if (item.calcType === 'length') measureValue /= 1000;
                else if (item.calcType === 'area') measureValue /= 1000000;
                else if (item.calcType === 'volume') measureValue /= 1000000000;
                displayedMeasureText = `${parseFloat(measureValue.toFixed(4)).toLocaleString('vi-VN')}`;
            }

            let dimParts = [];
            if (item.length) dimParts.push(`D ${item.length}mm`);
            if (item.height) dimParts.push(`C ${item.height}mm`);
            if (item.depth) dimParts.push(`S ${item.depth}mm`);
            const dimensionsString = dimParts.join(' x ');

            return `
                <tr class="item-row">
                    <td class="center">${itemCounter}</td>
                    <td>
                        <div class="item-name">${item.name.toUpperCase()}</div>
                        ${dimensionsString ? `<div class="item-spec">KT: ${dimensionsString}</div>` : ''}
                        ${item.spec ? `<div class="item-spec">${item.spec}</div>` : ''}
                    </td>
                    <td class="center">${item.unit || ''}</td>
                    <td class="right">${displayedMeasureText}</td>
                    <td class="right">${(item.quantity || 0).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                    <td class="right">${formatCurrency(item.price || 0, false)}</td>
                    <td class="right">${formatCurrency(item.lineTotal || 0, false)}</td>
                    <td>${item.notes || ''}</td>
                </tr>
            `;
        };
        
        const processCategory = (itemsInCategory) => {
            itemsInCategory.forEach(item => {
                html += mapItemToRow(item);
            });
        };
        
        if (mainCategories) {
            mainCategories.forEach(category => {
                const itemsInCategory = groupedItems.get(category.id);
                if (itemsInCategory && itemsInCategory.length > 0) {
                    categoryCounter++;
                    const categoryTotal = itemsInCategory.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                    html += `
                        <tr class="category-row">
                            <td class="category-marker">${numberToRoman(categoryCounter)}.</td>
                            <td colspan="5" class="category-name">${category.name.toUpperCase()}</td>
                            <td class="right category-total">${formatCurrency(categoryTotal, false)}</td>
                            <td></td>
                        </tr>
                    `;
                    processCategory(itemsInCategory);
                }
            });
        }
        
        const itemsWithoutCategory = groupedItems.get('__none__');
        if (itemsWithoutCategory && itemsWithoutCategory.length > 0) {
            if (html.length > 0) {
                html += `<tr><td colspan="8" style="padding: 4px;"></td></tr>`;
            }
            processCategory(itemsWithoutCategory);
        }

        return html;
    };
    
    const renderInstallments = () => {
        if (!installments || !installments.enabled || installments.data.length === 0) return '';
        let installmentHtml = `
            <div class="terms-section">
                <h3>Lịch thanh toán</h3>
                <ol class="installments-list">
        `;
        installments.data.forEach(inst => {
            const amount = inst.type === 'percent' 
                ? (totals.grandTotal * inst.value) / 100 
                : inst.value;
            installmentHtml += `<li>${inst.name}: <strong>${formatCurrency(amount)}</strong> (${inst.value}${inst.type === 'percent' ? '%' : ' VNĐ'})</li>`;
        });
        installmentHtml += `</ol></div>`;
        return installmentHtml;
    };

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${(companySettings.printOptions?.title || 'Báo Giá')} - ${quoteId}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                    font-size: 10pt;
                    color: #333;
                    -webkit-print-color-adjust: exact;
                }
                .page {
                    width: 210mm;
                    height: 297mm;
                    box-sizing: border-box;
                    padding: 40px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #eee;
                }
                .company-info { flex: 2; }
                .company-info h2 {
                    margin: 0;
                    font-size: 14pt;
                    font-weight: 700;
                    color: #0056b3;
                }
                .company-info p { margin: 4px 0; font-size: 9pt; color: #555;}
                .company-logo { flex: 1; text-align: right; max-height: 80px;}
                .company-logo img { max-height: 70px; max-width: 180px; object-fit: contain; }
                .quote-title-section { text-align: center; margin: 30px 0; }
                .quote-title-section h1 { margin: 0; font-size: 24pt; letter-spacing: 1px; }
                .quote-title-section p { margin: 5px 0; color: #666; }
                .customer-info {
                    display: flex;
                    justify-content: space-between;
                    background-color: #f9f9f9;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                }
                .customer-info div { font-size: 9.5pt; }
                .customer-info strong { font-weight: 700; color: #333; }
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }
                .items-table th, .items-table td {
                    border: 1px solid #e0e0e0;
                    padding: 8px 10px;
                    text-align: left;
                    vertical-align: top;
                }
                .items-table th {
                    background-color: #0056b3;
                    color: white;
                    font-weight: 700;
                    font-size: 9.5pt;
                }
                .items-table .center { text-align: center; }
                .items-table .right { text-align: right; }
                .item-row .item-name { font-weight: 700; text-transform: uppercase; margin-bottom: 4px;}
                .item-row .item-spec { font-size: 8.5pt; color: #555; font-style: italic; }
                .category-row { background-color: #f0f6ff; }
                .category-row td {
                    padding: 6px 10px;
                    font-weight: 700;
                    color: #0056b3;
                    border-left: 3px solid #0056b3;
                }
                .category-row .category-total { font-size: 11pt; }
                .summary-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-top: 20px;
                }
                .notes-section { flex: 1.5; font-size: 9pt; color: #444; }
                .notes-section h3 { margin-top: 0; font-size: 11pt; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px;}
                .totals-section { flex: 1; max-width: 300px; }
                .totals-table { width: 100%; }
                .totals-table td { padding: 6px 5px; font-size: 10pt; }
                .totals-table .label { font-weight: 500; color: #444; text-align: right;}
                .totals-table .value { font-weight: 700; text-align: right; }
                .grand-total { border-top: 2px solid #333; margin-top: 5px; padding-top: 5px;}
                .grand-total .label, .grand-total .value { font-size: 14pt; color: #0056b3; }
                .signature-section {
                    margin-top: 70px;
                    text-align: right;
                }
                .signature-section .signature-box {
                    display: inline-block;
                    text-align: center;
                }
                .signature-section p { margin: 2px 0; font-size: 10pt; }
                .signature-section .creator-name { margin-top: 50px; font-weight: 700; }
                .terms-section h3 { margin-top: 0; font-size: 11pt; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px;}
                .installments-list { padding-left: 20px; margin: 5px 0; font-size: 9pt; }
                .installments-list li { margin-bottom: 4px; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="company-info">
                        <h2>${(companySettings.name || 'TÊN CÔNG TY').toUpperCase()}</h2>
                        <p>${companySettings.address || 'Địa chỉ công ty'}</p>
                        <p>ĐT: ${companySettings.phone || '[SĐT]'} | Email: ${companySettings.email || '[Email]'}</p>
                        ${companySettings.taxId ? `<p>MST: ${companySettings.taxId}</p>` : ''}
                    </div>
                    ${companySettings.logoDataUrl ? `<div class="company-logo"><img src="${companySettings.logoDataUrl}" alt="Logo"></div>` : ''}
                </div>

                <div class="quote-title-section">
                    <h1>${(companySettings.printOptions?.title || 'BÁO GIÁ').toUpperCase()}</h1>
                    <p>Số: ${quoteId} | Ngày: ${formatDate(customerInfo.date)}</p>
                </div>

                <div class="customer-info">
                    <div class="customer-details">
                        <strong>Khách hàng:</strong> ${customerInfo.name || '[Tên khách hàng]'}<br>
                        <strong>Địa chỉ:</strong> ${customerInfo.address || '[Địa chỉ]'}
                    </div>
                </div>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 5%;" class="center">STT</th>
                            <th style="width: 33%;">Hạng mục / Mô tả</th>
                            <th style="width: 7%;" class="center">ĐVT</th>
                            <th style="width: 8%;" class="right">K.Lượng</th>
                            <th style="width: 7%;" class="right">SL</th>
                            <th style="width: 12%;" class="right">Đơn giá</th>
                            <th style="width: 13%;" class="right">Thành tiền</th>
                            <th style="width: 15%;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderItems()}
                    </tbody>
                </table>

                <div class="summary-section">
                    <div class="notes-section">
                         ${(companySettings.defaultQuoteNotes || companySettings.bankAccount || installments.enabled) ? `
                             ${companySettings.defaultQuoteNotes ? `<div class="terms-section"><h3>Điều khoản & Ghi chú</h3><p>${companySettings.defaultQuoteNotes.replace(/\n/g, '<br>')}</p></div>` : ''}
                             ${companySettings.bankAccount ? `<div class="terms-section" style="margin-top:15px;"><h3>Thông tin thanh toán</h3><p>${companySettings.bankAccount.replace(/\n/g, '<br>')}</p></div>` : ''}
                             ${renderInstallments()}
                         ` : ''}
                    </div>

                    <div class="totals-section">
                        <table class="totals-table">
                            <tr>
                                <td class="label">Tạm tính:</td>
                                <td class="value">${formatCurrency(totals.subTotal, false)}</td>
                            </tr>
                            <tr>
                                <td class="label">Giảm giá (${totals.discountType === 'percent' ? `${totals.discountValue}%` : formatCurrency(totals.discountValue, false)}):</td>
                                <td class="value">${formatCurrency(totals.discountAmount, false)}</td>
                            </tr>
                            <tr>
                                <td class="label">Thuế VAT (${totals.taxPercent}%):</td>
                                <td class="value">${formatCurrency(totals.taxAmount, false)}</td>
                            </tr>
                            <tr class="grand-total">
                                <td class="label">TỔNG CỘNG:</td>
                                <td class="value">${formatCurrency(totals.grandTotal)}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <div class="signature-section">
                    <div class="signature-box">
                        <p><strong>Người lập báo giá</strong></p>
                        <p><em>(Ký, ghi rõ họ tên)</em></p>
                        <p class="creator-name">${companySettings.printOptions?.creatorName || ''}</p>
                    </div>
                </div>

            </div>
        </body>
        </html>
    `;
}

// Main handler for the Vercel Serverless Function
module.exports = async (req, res) => {
    // Set CORS headers for all responses to handle preflight and actual requests
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production: e.g., 'https://your-app-domain.com'
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Ensure the method is POST for the actual PDF generation
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }
    
    let browser = null;
    try {
        const quoteData = req.body;
        
        const executablePath = await chromium.executablePath();

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        const htmlContent = getQuoteHtml(quoteData);
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const footerTemplate = `
            <div style="width:100%; font-size: 8pt; padding: 0 40px; color: #777; display: flex; justify-content: space-between; align-items: center;">
                <div style="max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span>${quoteData.companySettings.printOptions?.footer || ''}</span></div>
                <div>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></div>
            </div>`;
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '40px',
                left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Empty header
            footerTemplate: footerTemplate,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="bao_gia.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error("PDF Generation Error:", error);
        res.status(500).json({ success: false, message: 'Lỗi tạo file PDF.', error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
