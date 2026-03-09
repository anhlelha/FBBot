require('dotenv').config();
const path = require('path');

module.exports = {
  // Facebook App (platform-level, shared across tenants)
  FB_APP_SECRET: process.env.FB_APP_SECRET,
  FB_VERIFY_TOKEN: process.env.FB_VERIFY_TOKEN || 'ai4all_verify_2026',

  // Google Gemini (platform key, shared across tenants)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'ai4all_session_secret_change_me',

  // Owner
  OWNER_EMAIL: process.env.OWNER_EMAIL || 'anhle.lha@gmail.com',

  // Server
  PORT: process.env.PORT || 3000,

  // Defaults
  DEFAULT_SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || 'Bạn là nhân viên lễ tân khách sạn chuyên nghiệp. Hãy trả lời khách hàng một cách lịch sự, thân thiện và hữu ích.',
  DEFAULT_AI_MODEL: 'gemini-2.5-flash',
  DEFAULT_BOT_NAME: 'AI Assistant',

  // Paths
  UPLOAD_DIR: path.join(__dirname, '..', 'uploads'),
  DB_PATH: path.join(__dirname, '..', 'data', 'app.db'),

  // Limits
  DEFAULT_TRIAL_TOKEN_LIMIT: parseInt(process.env.TRIAL_TOKEN_LIMIT) || 5000,
  DEFAULT_BASIC_TOKEN_LIMIT: parseInt(process.env.BASIC_TOKEN_LIMIT) || 50000,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB

  // SePay Payment
  SEPAY_ENV: process.env.SEPAY_ENV || 'sandbox',
  SEPAY_API_KEY: process.env.SEPAY_API_KEY || '',
  SEPAY_BANK_ACCOUNT: process.env.SEPAY_BANK_ACCOUNT || '',
  SEPAY_BANK_NAME: process.env.SEPAY_BANK_NAME || 'MBBank',
  SEPAY_ACCOUNT_NAME: process.env.SEPAY_ACCOUNT_NAME || '',
  get SEPAY_BASE_URL() {
    return this.SEPAY_ENV === 'production'
      ? 'https://my.sepay.vn/userapi'
      : 'https://my.dev.sepay.vn/userapi';
  },

  // Plan Pricing (VND)
  PLAN_BASIC_PRICE: parseInt(process.env.PLAN_BASIC_PRICE) || 200000,
  PLAN_PRO_PRICE: parseInt(process.env.PLAN_PRO_PRICE) || 500000,
  PLAN_BASIC_TOKENS: parseInt(process.env.PLAN_BASIC_TOKENS) || 50000,
  PLAN_PRO_TOKENS: parseInt(process.env.PLAN_PRO_TOKENS) || 200000,

  // Hand-off Keywords (Vietnamese)
  HANDOFF_KEYWORDS: [
    'gặp nhân viên', 'nói chuyện người thật', 'quản lý',
    'hotline', 'tư vấn viên', 'nhân viên hỗ trợ',
    'gặp người', 'nói chuyện với người', 'kết nối nhân viên',
  ],

  // Vertex AI RAG Engine
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  GCP_LOCATION: process.env.GCP_LOCATION || 'asia-southeast1',
  GCP_KEY_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  get GCP_RAG_BASE_URL() {
    return `https://${this.GCP_LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${this.GCP_PROJECT_ID}/locations/${this.GCP_LOCATION}`;
  },
};
