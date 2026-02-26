const { OAuth2Client } = require('google-auth-library');
const config = require('./config');
const { tenants } = require('./database');

const oauthClient = config.GOOGLE_CLIENT_ID ? new OAuth2Client(config.GOOGLE_CLIENT_ID) : null;

async function verifyGoogleToken(idToken) {
    if (!oauthClient) throw new Error('Google OAuth not configured');
    const ticket = await oauthClient.verifyIdToken({
        idToken,
        audience: config.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return {
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
    };
}

async function handleGoogleLogin(idToken) {
    const googleUser = await verifyGoogleToken(idToken);
    let tenant = tenants.getByEmail(googleUser.email);

    if (!tenant) {
        tenant = tenants.create(googleUser.email, googleUser.name);
        console.log(`✅ New tenant created: ${tenant.email} (plan: ${tenant.plan})`);
    }

    if (tenant.status !== 'active') {
        throw new Error('Account suspended');
    }

    return { tenant, isNew: !tenant.created_at };
}

function isOwner(email) {
    return email === config.OWNER_EMAIL;
}

// Middleware: require login
function requireAuth(req, res, next) {
    if (!req.session || !req.session.tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const tenant = tenants.getById(req.session.tenantId);
    if (!tenant || tenant.status !== 'active') {
        req.session = null;
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.tenant = tenant;
    next();
}

// Middleware: require owner
function requireOwner(req, res, next) {
    if (!req.session || !req.session.tenantId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const tenant = tenants.getById(req.session.tenantId);
    if (!tenant || !isOwner(tenant.email)) {
        return res.status(403).json({ error: 'Forbidden: Owner access required' });
    }
    req.tenant = tenant;
    next();
}

module.exports = { verifyGoogleToken, handleGoogleLogin, isOwner, requireAuth, requireOwner };
