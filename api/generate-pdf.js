// api/generate-pdf.js
// Vercel Serverless Function to generate PDFs using `pdfmake` for reliability and performance.
const path = require('path');
const PdfPrinter = require('pdfmake');
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
        console.log("PDF generation process started with pdfmake.");
        
        const quoteData = req.body;
        
        // Define fonts for pdfmake. Using the default Roboto is the most reliable
        // approach in a serverless environment without bundling custom font files.
        const fonts = {
            Roboto: {
                normal: 'node_modules/pdfmake/build/vfs_fonts.js',
                bold: 'node_modules/pdfmake/build/vfs_fonts.js',
                italics: 'node_modules/pdfmake/build/vfs_fonts.js',
                bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js'
            }
        };

        const printer = new PdfPrinter(fonts);
        const docDefinition = getQuoteDocDefinition(quoteData);
        console.log("Document definition created.");
        
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        // Pipe the PDF document directly to the response stream
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="bao_gia.pdf"');
        
        pdfDoc.pipe(res);
        pdfDoc.end();

        console.log("PDF stream successfully piped to response.");

    } catch (error) {
        console.error("--- PDF GENERATION FAILED (pdfmake) ---");
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
