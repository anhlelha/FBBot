const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const config = require('./config');
const ai = require('./ai');
const { documents, documentChunks } = require('./database');

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

async function addDocument(tenantId, file, vectorStore) {
    const ext = path.extname(file.originalname).toLowerCase();
    const supportedTypes = ['.pdf', '.txt', '.md', '.csv'];

    if (!supportedTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
    }

    // Store file in tenant-specific dir
    const tenantUploadDir = path.join(config.UPLOAD_DIR, tenantId);
    if (!fs.existsSync(tenantUploadDir)) {
        fs.mkdirSync(tenantUploadDir, { recursive: true });
    }

    const filePath = path.join(tenantUploadDir, `${Date.now()}-${file.originalname}`);
    fs.writeFileSync(filePath, file.buffer);

    // Extract text
    let text = '';
    if (ext === '.pdf') {
        const data = await pdfParse(file.buffer);
        text = data.text;
    } else {
        text = file.buffer.toString('utf-8');
    }

    if (!text.trim()) {
        throw new Error('File is empty or could not be parsed');
    }

    // Save Doc to DB
    const docId = documents.create(tenantId, file.originalname, filePath, file.size, ext.slice(1));

    // Chunk & embed
    const chunks = chunkText(text);
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await ai.getEmbedding(chunk);
        embeddings.push(embedding);

        // Persist chunk to DB
        documentChunks.create(docId, tenantId, chunk, embedding, i);
    }

    vectorStore.addChunks(docId, chunks, embeddings);
    documents.updateChunks(docId, chunks.length);

    console.log(`📄 [${tenantId}] Document added: ${file.originalname} (${chunks.length} chunks)`);
    return { id: docId, filename: file.originalname, chunks: chunks.length };
}

function removeDocument(docId, vectorStore) {
    const doc = documents.delete(docId);
    if (doc) {
        documentChunks.deleteByDoc(docId);
        vectorStore.removeDocument(docId);
        console.log(`🗑️ Document removed: ${doc.filename}`);
    }
    return doc;
}

function loadTenantKnowledge(tenantId, vectorStore) {
    const chunks = documentChunks.getByTenant(tenantId);
    if (chunks.length > 0) {
        const docChunksMap = {};
        chunks.forEach(c => {
            if (!docChunksMap[c.doc_id]) {
                docChunksMap[c.doc_id] = { chunks: [], embeddings: [] };
            }
            // Embedding is stored as JSON string
            docChunksMap[c.doc_id].chunks.push(c.content);
            docChunksMap[c.doc_id].embeddings.push(JSON.parse(c.embedding));
        });

        for (const [docId, data] of Object.entries(docChunksMap)) {
            vectorStore.addChunks(docId, data.chunks, data.embeddings);
        }
        console.log(`🧠 [${tenantId}] Loaded ${chunks.length} chunks from ${Object.keys(docChunksMap).length} documents.`);
    }
}

function listDocuments(tenantId) {
    return documents.getByTenant(tenantId);
}

function getStats(tenantId) {
    return documents.getStatsByTenant(tenantId);
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + size, text.length);
        chunks.push(text.slice(start, end));
        start += size - overlap;
        if (start >= text.length) break;
    }
    return chunks;
}

module.exports = { addDocument, removeDocument, listDocuments, getStats, loadTenantKnowledge, chunkText };
