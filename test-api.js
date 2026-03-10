const { tenants } = require('./src/database');
const tenant = tenants.getByEmail('anhle.vinmec@gmail.com');
console.log('Tenant Object from DB:', JSON.stringify(tenant, null, 2));

const responseObj = {
    tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
        corpus_name: tenant.corpus_name,
    }
};
console.log('Simulated Response:', JSON.stringify(responseObj, null, 2));
