
// api/upload.js
// This is a Vercel Serverless Function that acts as a secure proxy to Backblaze B2.

const fetch = require('node-fetch'); // Vercel environment has node-fetch

// Helper to convert stream to buffer
async function streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// Function to authorize with B2 - uses environment variables for security
async function authorizeB2Account(keyId, applicationKey) {
    const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString('base64');
    const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` }
    });
    if (!response.ok) {
        throw new Error('B2 authorization failed.');
    }
    return response.json();
}

// Main handler for the Vercel Serverless Function
module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME } = process.env;

        if (!B2_APPLICATION_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
            console.error("Missing B2 environment variables on the server.");
            return res.status(500).json({ success: false, message: 'Server is not configured for file uploads.' });
        }

        const { fileData, fileName, mimeType } = req.body;
        if (!fileData || !fileName || !mimeType) {
            return res.status(400).json({ success: false, message: 'Missing file data, name, or mime type.' });
        }
        
        // The fileData is a Base64 string, so we need to convert it back to a Buffer.
        const fileBuffer = Buffer.from(fileData, 'base64');

        // 1. Authorize B2 account
        const authData = await authorizeB2Account(B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY);
        const { authorizationToken, apiUrl, downloadUrl } = authData;

        // 2. Get an upload URL
        const getUploadUrlResponse = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: { 'Authorization': authorizationToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucketId: B2_BUCKET_ID })
        });
        const uploadUrlData = await getUploadUrlResponse.json();
        if (!getUploadUrlResponse.ok) throw new Error(uploadUrlData.message || 'Failed to get B2 upload URL.');

        const { uploadUrl, authorizationToken: uploadAuthToken } = uploadUrlData;

        // 3. Upload the file
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadAuthToken,
                'X-Bz-File-Name': encodeURIComponent(fileName),
                'Content-Type': mimeType,
                'Content-Length': fileBuffer.length,
                'X-Bz-Content-Sha1': 'do_not_verify' // Simpler for serverless context
            },
            body: fileBuffer
        });

        const uploadedFileInfo = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadedFileInfo.message || 'File upload to B2 failed.');
        
        // 4. Construct the public URL and send it back to the client
        const publicUrl = `${downloadUrl}/file/${B2_BUCKET_NAME}/${encodeURIComponent(fileName)}`;

        return res.status(200).json({ success: true, url: publicUrl });

    } catch (error) {
        console.error('Error in B2 upload proxy:', error);
        return res.status(500).json({ success: false, message: error.message || 'An internal server error occurred.' });
    }
};
