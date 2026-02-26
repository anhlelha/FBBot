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
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
};
