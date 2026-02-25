const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const config = require('./config');
const vectorStore = require('./vectorStore');
// In-memory document registry
const documents = new Map();

/**
 * Add a document from an uploaded file
 */
async function addDocument(file) {
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Extract text based on file type
    let text = '';
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.pdf') {
        const buffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
    } else if (['.txt', '.md', '.csv'].includes(ext)) {
        text = fs.readFileSync(file.path, 'utf-8');
    } else {
        throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .txt, .md, .csv`);
    }

    if (!text.trim()) {
        throw new Error('Document is empty or could not be parsed.');
    }

    // Chunk the text
    const chunks = chunkText(text, 500, 50);

    console.log(`📄 Document "${file.originalname}": ${text.length} chars → ${chunks.length} chunks`);

    // Generate embeddings
    const ai = require('./ai');
    const embeddings = await ai.getEmbeddings(chunks);

    // Store in vector store
    vectorStore.addChunks(docId, chunks, embeddings);

    // Save metadata
    const docMeta = {
        id: docId,
        filename: file.originalname,
        originalPath: file.path,
        size: file.size,
        type: ext,
        chunks: chunks.length,
        uploadedAt: new Date().toISOString(),
    };
    documents.set(docId, docMeta);

    return docMeta;
}

/**
 * Remove a document
 */
function removeDocument(docId) {
    const doc = documents.get(docId);
    if (!doc) throw new Error('Document not found');

    // Remove from vector store
    vectorStore.removeDocument(docId);

    // Remove file
    try {
        if (fs.existsSync(doc.originalPath)) {
            fs.unlinkSync(doc.originalPath);
        }
    } catch (err) {
        console.error(`⚠️ Failed to delete file: ${err.message}`);
    }

    documents.delete(docId);
    return doc;
}

/**
 * List all documents
 */
function listDocuments() {
    return Array.from(documents.values());
}

/**
 * Search knowledge base for relevant chunks
 */
async function search(query, topK = 5) {
    if (vectorStore.size === 0) return [];

    const ai = require('./ai');
    const queryEmbedding = await ai.getEmbedding(query);
    return vectorStore.search(queryEmbedding, topK);
}

/**
 * Get stats
 */
function getStats() {
    return {
        totalDocuments: documents.size,
        totalChunks: vectorStore.size,
    };
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
    const chunks = [];
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    let currentChunk = '';

    for (const para of paragraphs) {
        const cleanPara = para.trim();
        if (!cleanPara) continue;

        if ((currentChunk + '\n' + cleanPara).length > chunkSize && currentChunk) {
            chunks.push(currentChunk.trim());
            // Keep overlap from the end of the current chunk
            const words = currentChunk.split(/\s+/);
            const overlapWords = words.slice(-Math.floor(overlap / 5));
            currentChunk = overlapWords.join(' ') + '\n' + cleanPara;
        } else {
            currentChunk += (currentChunk ? '\n' : '') + cleanPara;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    // If no chunks were created (single block of text), split by character count
    if (chunks.length === 0 && text.trim()) {
        const words = text.trim().split(/\s+/);
        let chunk = '';
        for (const word of words) {
            if ((chunk + ' ' + word).length > chunkSize && chunk) {
                chunks.push(chunk.trim());
                const overlapWords = chunk.split(/\s+/).slice(-Math.floor(overlap / 5));
                chunk = overlapWords.join(' ') + ' ' + word;
            } else {
                chunk += (chunk ? ' ' : '') + word;
            }
        }
        if (chunk.trim()) chunks.push(chunk.trim());
    }

    return chunks;
}

module.exports = {
    addDocument,
    removeDocument,
    listDocuments,
    search,
    getStats,
};
