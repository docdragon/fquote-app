
// api/generate-pdf.js
// Vercel Serverless Function to generate PDFs using Puppeteer + Chromium for reliability on Vercel.
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const { getQuoteHtml } = require('./_getQuoteHtml.js');

// Main handler for the Vercel Serverless Function
module.exports = async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }
    
    let browser = null;

    try {
        console.log("PDF generation process started with Puppeteer.");
        
        const quoteData = req.body;
        const htmlContent = getQuoteHtml(quoteData);
        console.log("HTML content generated.");

        console.log("Launching browser with optimized settings for Vercel...");
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });
        console.log("Browser launched successfully.");

        const page = await browser.newPage();
        
        console.log("Setting page content...");
        // Using setContent is more direct than goto for local HTML.
        // 'networkidle0' waits for network connections to be idle, crucial for loading external fonts/images.
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        console.log("Page content set successfully.");

        console.log("Generating PDF buffer...");
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
        });
        console.log("PDF buffer generated successfully.");

        // Send the response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="bao_gia.pdf"');
        res.send(pdfBuffer);
        console.log("Response sent successfully.");

    } catch (error) {
        console.error("--- PDF GENERATION FAILED (Puppeteer) ---");
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error Message:", errorMessage);
        console.error("Full Error Object:", error);
        
        res.status(500).json({ 
            success: false, 
            message: 'A server-side error occurred during PDF generation.',
            error: `[Server Puppeteer] ${errorMessage}`
        });
    } finally {
        if (browser !== null) {
            console.log("Closing browser.");
            await browser.close();
        }
        console.log("PDF generation process finished.");
    }
};
