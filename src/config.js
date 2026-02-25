require('dotenv').config();

module.exports = {
  FB_PAGE_ACCESS_TOKEN: process.env.FB_PAGE_ACCESS_TOKEN,
  FB_VERIFY_TOKEN: process.env.FB_VERIFY_TOKEN || 'hotel_bot_verify_2024',
  FB_APP_SECRET: process.env.FB_APP_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PORT: process.env.PORT || 3000,
  SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || 'Bạn là nhân viên lễ tân khách sạn chuyên nghiệp. Hãy trả lời khách hàng một cách lịch sự, thân thiện và hữu ích.',
  UPLOAD_DIR: require('path').join(__dirname, '..', 'uploads'),
};
