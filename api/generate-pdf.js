// api/generate-pdf.js
// Vercel Serverless Function to generate PDFs using `pdfmake` for reliability and performance.
const path = require('path');
const PdfPrinter = require('pdfmake');
// Import the Virtual File System for fonts
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
const { getQuoteDocDefinition } = require(path.join(process.cwd(), 'api', '_getQuoteDocDefinition.js'));

// Main handler for the Vercel Serverless Function
module.exports = async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production if needed
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
    
    try {
        console.log("PDF generation process started with pdfmake (VFS).");
        
        const quoteData = req.body;
        
        // Define fonts for pdfmake. These names must match the fonts in the VFS.
        const fonts = {
            Roboto: {
                normal: 'Roboto-Regular.ttf',
                bold: 'Roboto-Medium.ttf',
                italics: 'Roboto-Italic.ttf',
                bolditalics: 'Roboto-MediumItalic.ttf'
            }
        };

        const printer = new PdfPrinter(fonts);
        
        // Assign the VFS to the printer instance. This is the crucial step.
        // The `vfs_fonts.js` file exports an object with `pdfMake.vfs`.
        printer.vfs = vfsFonts.pdfMake.vfs;
        
        const docDefinition = getQuoteDocDefinition(quoteData);
        console.log("Document definition created.");
        
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        // Collect the PDF into a buffer instead of streaming directly
        const chunks = [];
        pdfDoc.on('data', chunk => {
            chunks.push(chunk);
        });
        
        pdfDoc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="bao_gia.pdf"');
            res.status(200).send(result);
            console.log("PDF buffer successfully sent to response.");
        });
        
        pdfDoc.on('error', (err) => {
             console.error("Error during PDF document stream:", err);
             res.setHeader('Content-Type', 'application/json');
             res.status(500).json({
                success: false,
                message: 'Error creating PDF document stream.',
                error: err.message
             });
        });

        pdfDoc.end();

    } catch (error) {
        console.error("--- PDF GENERATION FAILED (pdfmake VFS) ---");
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error Message:", errorMessage);
        console.error("Full Error Object:", error);
        
        // Ensure headers are set for JSON response in case of error
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            success: false, 
            message: 'A server-side error occurred during PDF generation.',
            error: `[Server pdfmake] ${errorMessage}`
        });
    }
};