class VectorStore {
    constructor() {
        this.entries = [];
    }

    get size() {
        return this.entries.length;
    }

    addChunks(docId, chunks, embeddings) {
        for (let i = 0; i < chunks.length; i++) {
            this.entries.push({
                docId,
                chunkIndex: i,
                text: chunks[i],
                embedding: embeddings[i],
            });
        }
    }

    removeDocument(docId) {
        this.entries = this.entries.filter(e => e.docId !== docId);
    }

    search(queryEmbedding, topK = 5) {
        if (this.entries.length === 0) return [];

        const scored = this.entries.map(entry => ({
            ...entry,
            score: cosineSimilarity(queryEmbedding, entry.embedding),
        }));

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    clear() {
        this.entries = [];
    }
}

function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

module.exports = VectorStore;
