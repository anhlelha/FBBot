/**
 * Migration Script: Local RAG (SQLite/Manual Embedding) -> Vertex AI RAG Engine
 * 
 * Usage: node scripts/migrate-to-vertex.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { tenants, documents, db } = require('../src/database');
const vertexRag = require('../src/vertexRag');
const config = require('../src/config');

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
    console.log('🚀 Starting RAG Migration to Vertex AI...');
    if (DRY_RUN) console.log('⚠️ DRY RUN MODE: No actual changes will be made to GCP or Database.');

    const allTenants = tenants.getAll();
    console.log(`📋 Found ${allTenants.length} tenants total.`);

    for (const tenant of allTenants) {
        console.log(`\n--- 🏢 Tenant: ${tenant.name} (${tenant.id}) ---`);

        const tenantDocs = documents.getByTenant(tenant.id);
        if (tenantDocs.length === 0) {
            console.log('⏭️ No documents found. Skipping.');
            continue;
        }

        console.log(`📄 Found ${tenantDocs.length} documents to migrate.`);

        // 1. Ensure Corpus exists
        let corpusName = tenant.corpus_name;

        // FIX: If we stored an operation name by mistake in a previous run
        if (corpusName && corpusName.includes('/operations/')) {
            console.log(`🔧 Fixing corpus_name (waiting for operation ${corpusName})...`);
            if (!DRY_RUN) {
                try {
                    const result = await vertexRag.waitOperation(corpusName);
                    corpusName = result.name;
                    tenants.update(tenant.id, { corpus_name: corpusName });
                    console.log(`✅ Fixed! New corpus name: ${corpusName}`);
                } catch (error) {
                    console.error(`❌ Failed to fix operation for ${tenant.id}:`, error.message);
                    corpusName = null; // Re-create below
                }
            }
        }

        if (!corpusName) {
            console.log(`🏗️ Creating RAG Corpus for ${tenant.name}...`);
            if (!DRY_RUN) {
                try {
                    corpusName = await vertexRag.createCorpus(`corpus-${tenant.id}`);
                    tenants.update(tenant.id, { corpus_name: corpusName });
                    console.log(`✅ Corpus created: ${corpusName}`);
                    // Give GCP a few seconds to stabilize
                    await new Promise(r => setTimeout(r, 5000));
                } catch (error) {
                    console.error(`❌ Failed to create corpus for ${tenant.id}:`, error.message);
                    continue;
                }
            } else {
                corpusName = 'projects/PLACEHOLDER/locations/PLACEHOLDER/ragCorpora/PLACEHOLDER';
                console.log(`[DRY RUN] Would create corpus projects/.../ragCorpora/...`);
            }
        } else {
            console.log(`ℹ️ Existing Corpus found: ${corpusName}`);
        }

        // 2. Upload Documents
        for (const doc of tenantDocs) {
            if (doc.rag_file_name) {
                console.log(`⏭️ File already migrated: ${doc.filename}`);
                continue;
            }

            if (!fs.existsSync(doc.path)) {
                console.error(`⚠️ File not found on disk: ${doc.path}. Skipping.`);
                continue;
            }

            console.log(`📤 Uploading ${doc.filename} (${doc.size} bytes)...`);
            if (!DRY_RUN) {
                try {
                    const fileBuffer = fs.readFileSync(doc.path);
                    const response = await vertexRag.uploadFile(corpusName, fileBuffer, doc.filename, `Migrated from local store`);

                    const ragFileName = response.name;
                    documents.updateRagFileName(doc.id, ragFileName);
                    console.log(`✅ Uploaded: ${ragFileName}`);
                } catch (error) {
                    console.error(`❌ Failed to upload ${doc.filename}:`, error.message);
                }
            } else {
                console.log(`[DRY RUN] Would upload ${doc.filename} to ${corpusName}`);
            }
        }
    }

    console.log('\n🏁 Migration process completed.');

    // Note: Legacy document_chunks table is no longer needed but we keep it for now.
    // If you want to clean up: db.prepare('DROP TABLE IF EXISTS document_chunks').run();
}

migrate().catch(err => {
    console.error('🔥 Critical Migration Error:', err);
    process.exit(1);
});
