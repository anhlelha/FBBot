const fs = require('fs');
const path = require('path');
const config = require('./config');
const vertexRag = require('./vertexRag');
const { documents } = require('./database');

async function addDocument(tenantId, file, corpusName, folderId = null, source = 'upload') {
    const ext = path.extname(file.originalname).toLowerCase();
    const supportedTypes = ['.pdf', '.txt', '.md', '.csv', '.docx'];

    if (!supportedTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Store file in tenant-specific dir for local backup/reference
    const tenantUploadDir = path.join(config.UPLOAD_DIR, tenantId);
    if (!fs.existsSync(tenantUploadDir)) {
        fs.mkdirSync(tenantUploadDir, { recursive: true });
    }

    const filePath = path.join(tenantUploadDir, `${Date.now()}-${file.originalname}`);
    fs.writeFileSync(filePath, file.buffer);

    try {
        // Upload to Vertex AI RAG Engine
        console.log(`🚀 [${tenantId}] Uploading to Vertex AI RAG Corpus: ${corpusName}...`);
        const ragFileResponse = await vertexRag.uploadFile(
            corpusName,
            file.buffer,
            file.originalname,
            `Document for tenant ${tenantId}`
        );

        const ragFileName = ragFileResponse.name;

        // Save Doc to DB
        const docId = documents.create(tenantId, file.originalname, filePath, file.size, ext.slice(1), folderId, source);

        // Update DB with rag_file_name
        documents.updateRagFileName(docId, ragFileName);

        console.log(`✅ [${tenantId}] Document added: ${file.originalname} (RAG ID: ${ragFileName}, source: ${source})`);
        return { id: docId, filename: file.originalname, ragFileName };
    } catch (error) {
        // If anything fails after saving the file locally, clean up the file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🧹 Cleaned up local file after upload failure: ${filePath}`);
        }
        throw error;
    }
}

async function removeDocument(docId) {
    const doc = documents.getById(docId);
    if (doc && doc.rag_file_name) {
        try {
            await vertexRag.deleteFile(doc.rag_file_name);
            console.log(`🗑️ Deleted from Vertex AI: ${doc.rag_file_name}`);
        } catch (error) {
            console.error(`⚠️ Error deleting from Vertex AI: ${error.message}`);
        }
    }

    const deletedDoc = documents.delete(docId);
    if (deletedDoc) {
        console.log(`🗑️ Document removed from DB: ${deletedDoc.filename}`);
    }
    return deletedDoc;
}

function listDocuments(tenantId, folderId = undefined) {
    return documents.getByTenant(tenantId, folderId);
}

function getStats(tenantId) {
    return documents.getStatsByTenant(tenantId);
}

module.exports = { addDocument, removeDocument, listDocuments, getStats };
