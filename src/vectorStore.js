/**
 * Simple in-memory vector store using cosine similarity.
 * Stores document chunks with their embeddings for semantic search.
 */

class VectorStore {
    constructor() {
        // Array of { docId, chunkIndex, text, embedding }
        this.entries = [];
    }

    /**
     * Add chunks with their embeddings
     */
    addChunks(docId, chunks, embeddings) {
        for (let i = 0; i < chunks.length; i++) {
            this.entries.push({
                docId,
                chunkIndex: i,
                text: chunks[i],
                embedding: embeddings[i],
            });
        }
        console.log(`📦 Added ${chunks.length} chunks for document: ${docId}`);
    }

    /**
     * Remove all chunks for a document
     */
    removeDocument(docId) {
        const before = this.entries.length;
        this.entries = this.entries.filter(e => e.docId !== docId);
        const removed = before - this.entries.length;
        console.log(`🗑️ Removed ${removed} chunks for document: ${docId}`);
    }

    /**
     * Search for top-K most similar chunks
     */
    search(queryEmbedding, topK = 5) {
        if (this.entries.length === 0) return [];

        const scored = this.entries.map(entry => ({
            ...entry,
            score: cosineSimilarity(queryEmbedding, entry.embedding),
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    /**
     * Get total number of entries
     */
    get size() {
        return this.entries.length;
    }

    /**
     * Get number of unique documents
     */
    get documentCount() {
        return new Set(this.entries.map(e => e.docId)).size;
    }
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
}

// Singleton instance
const vectorStore = new VectorStore();

module.exports = vectorStore;
