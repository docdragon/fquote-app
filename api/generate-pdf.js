// api/generate-pdf.js
// Vercel Serverless Function to generate PDFs using `pdfmake`.
// NEW: Proactively fetches images and embeds them as Base64 to avoid network issues during PDF creation.
const path = require('path');
// const fetch = require('node-fetch'); // REMOVED: Use Vercel's global fetch
const PdfPrinter = require('pdfmake');
const vfsFonts = require('pdfmake/build/vfs_fonts.js');
const { getQuoteDocDefinition } = require(path.join(process.cwd(), 'api', '_getQuoteDocDefinition.js'));

// Helper function to fetch an image and convert it to a Base64 Data URI
async function fetchImageAsBase64(url) {
    try {
        if (!url || !url.startsWith('http')) {
             console.log(`Skipping invalid or local URL: ${url}`);
             return null;
        }
        console.log(`Fetching image from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch image from ${url}. Status: ${response.statusText}`);
            return null; // Don't crash, just skip the image
        }
        // Use standard response.arrayBuffer() and convert to Buffer
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error fetching image from ${url}:`, error);
        return null; // Return null on error
    }
}


// Main handler for the Vercel Serverless Function
module.exports = async (req, res) => {
    // Standard CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }
    
    try {
        console.log("PDF generation process started.");
        
        let quoteData = req.body;
        
        // --- Image Pre-fetching and Embedding ---
        console.log("Starting image pre-fetching process...");
        
        // Fetch company logo
        if (quoteData.companySettings && quoteData.companySettings.logoUrl) {
            quoteData.companySettings.logoDataUrl = await fetchImageAsBase64(quoteData.companySettings.logoUrl);
             if(quoteData.companySettings.logoDataUrl) console.log("Company logo fetched successfully.");
        }

        // Fetch all item images concurrently
        if (quoteData.items && quoteData.items.length > 0) {
            const imagePromises = quoteData.items.map(item => fetchImageAsBase64(item.imageUrl));
            const base64Images = await Promise.all(imagePromises);
            
            quoteData.items.forEach((item, index) => {
                if (base64Images[index]) {
                    item.imageDataUrl = base64Images[index];
                }
            });
            console.log("All item images processed.");
        }

        const fonts = {
            Roboto: {
                normal: 'Roboto-Regular.ttf',
                bold: 'Roboto-Medium.ttf',
                italics: 'Roboto-Italic.ttf',
                bolditalics: 'Roboto-MediumItalic.ttf'
            }
        };

        const printer = new PdfPrinter(fonts);
        printer.vfs = vfsFonts.pdfMake.vfs;
        
        // Pass the modified quoteData (with Base64 images) to get the definition
        const docDefinition = getQuoteDocDefinition(quoteData);
        console.log("Document definition created.");
        
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        
        pdfDoc.on('end', () => {
            const result = Buffer.concat(chunks);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="bao_gia.pdf"');
            res.status(200).send(result);
            console.log("PDF buffer successfully sent.");
        });
        
        pdfDoc.on('error', (err) => {
             console.error("Error during PDF document stream:", err);
             res.setHeader('Content-Type', 'application/json');
             res.status(500).json({ success: false, error: err.message });
        });

        pdfDoc.end();

    } catch (error) {
        console.error("--- PDF GENERATION FAILED ---");
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error:", errorMessage);
        console.error("Stack:", error.stack);
        
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ 
            success: false, 
            message: 'A server-side error occurred during PDF generation.',
            error: `[Server] ${errorMessage}`
        });
    }
};