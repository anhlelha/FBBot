const fs = require('fs');
const path = require('path');
const config = require('./config');
const vertexRag = require('./vertexRag');
const { documents } = require('./database');

async function addDocument(tenantId, file, corpusName) {
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

    // Upload to Vertex AI RAG Engine
    console.log(`🚀 [${tenantId}] Uploading to Vertex AI RAG Corpus: ${corpusName}...`);
    const ragFileResponse = await vertexRag.uploadFile(
        corpusName,
        file.buffer,
        file.originalname,
        `Document for tenant ${tenantId}`
    );

    const ragFileName = ragFileResponse.name; // projects/.../ragFiles/...

    // Save Doc to DB (using rag_file_name to track in Vertex)
    const docId = documents.create(tenantId, file.originalname, filePath, file.size, ext.slice(1));

    // Update DB with rag_file_name
    documents.updateRagFileName(docId, ragFileName);

    console.log(`✅ [${tenantId}] Document added: ${file.originalname} (RAG ID: ${ragFileName})`);
    return { id: docId, filename: file.originalname, ragFileName };
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

function listDocuments(tenantId) {
    return documents.getByTenant(tenantId);
}

function getStats(tenantId) {
    return documents.getStatsByTenant(tenantId);
}

module.exports = { addDocument, removeDocument, listDocuments, getStats };
