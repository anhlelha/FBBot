const fs = require('fs');
const path = require('path');
const { documents, documentChunks, db } = require('../src/database');
const knowledgeBase = require('../src/knowledgeBase');
const ai = require('../src/ai');
const config = require('../src/config');
const pdfParse = require('pdf-parse');

async function migrate() {
    console.log(`🚀 Starting RAG Migration for existing documents... (DB: ${config.DB_PATH})`);

    try {
        ai.initAI();

        const allDocs = db.prepare('SELECT * FROM documents').all();
        console.log(`Found ${allDocs.length} documents in database.`);

        for (const doc of allDocs) {
            const existingChunks = db.prepare('SELECT COUNT(*) as count FROM document_chunks WHERE doc_id = ?').get(doc.id).count;
            if (existingChunks > 0) {
                console.log(`⏭️  Skipping ${doc.filename} (already has ${existingChunks} chunks)`);
                continue;
            }

            console.log(`Processing ${doc.filename} for tenant ${doc.tenant_id}...`);

            try {
                if (!fs.existsSync(doc.path)) {
                    console.error(`❌ File not found: ${doc.path}`);
                    continue;
                }

                const buffer = fs.readFileSync(doc.path);
                let text = '';
                if (doc.type === 'pdf') {
                    const data = await pdfParse(buffer);
                    text = data.text;
                } else {
                    text = buffer.toString('utf-8');
                }

                const chunks = knowledgeBase.chunkText(text);
                console.log(`- Split into ${chunks.length} chunks. Generating embeddings...`);

                for (let i = 0; i < chunks.length; i++) {
                    const embedding = await ai.getEmbedding(chunks[i]);
                    documentChunks.create(doc.id, doc.tenant_id, chunks[i], embedding, i);
                }

                documents.updateChunks(doc.id, chunks.length);
                console.log(`✅ Finished ${doc.filename}`);

            } catch (error) {
                console.error(`❌ Error processing ${doc.filename}:`, error.message);
            }
        }

        console.log('🏁 Migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Critical migration error:', error.message);
        process.exit(1);
    }
}

migrate();
