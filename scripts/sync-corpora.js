const vertexRag = require('./src/vertexRag');
const { tenants } = require('./src/database');

async function sync() {
    console.log('🔍 Fetching all corpora from Vertex AI...');
    try {
        const corpora = await vertexRag.listCorpora();
        console.log(`✅ Found ${corpora.length} corpora on Vertex AI.`);

        const allTenants = tenants.getAll();
        console.log(`👥 Checking ${allTenants.length} tenants in DB...`);

        for (const tenant of allTenants) {
            if (tenant.corpus_name) {
                console.log(`⏩ Tenant ${tenant.email} already has corpus: ${tenant.corpus_name}`);
                continue;
            }

            // Try to find a matching corpus by display name
            const match = corpora.find(c => c.displayName === `corpus-${tenant.id}`);
            if (match) {
                console.log(`✨ Found matching corpus for ${tenant.email}: ${match.name}`);
                tenants.update(tenant.id, { corpus_name: match.name });
                console.log(`💾 Updated DB for ${tenant.email}`);
            } else {
                console.log(`❌ No corpus found for ${tenant.email} (corpus-${tenant.id})`);

                // Optional: Force create if desired, but let's just sync for now
                /*
                console.log(`🏗️ Creating new corpus for ${tenant.email}...`);
                const newName = await vertexRag.createCorpus(`corpus-${tenant.id}`);
                tenants.update(tenant.id, { corpus_name: newName });
                console.log(`✅ Created and updated: ${newName}`);
                */
            }
        }
        console.log('🏁 Sync complete.');
    } catch (err) {
        console.error('❌ Sync failed:', err);
    }
}

sync();
