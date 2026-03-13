const ai = require('../src/ai');
const config = require('../src/config');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => {
            return {
                getGenerativeModel: jest.fn().mockReturnValue({
                    generateContent: jest.fn().mockImplementation(async (prompt) => {
                        // Return the prompt itself so we can verify what was passed
                        return {
                            response: {
                                text: () => prompt
                            }
                        };
                    })
                })
            };
        })
    };
});

describe('AI Guardrails Prompt Generation', () => {
    beforeAll(() => {
        // Init AI with fake key to ensure model is created
        config.GEMINI_API_KEY = 'TEST_KEY';
        ai.initAI();
    });

    afterAll(() => {
        config.GEMINI_API_KEY = '';
    });

    test('Hard guardrails are always included', async () => {
        const tenantSettings = { system_prompt: 'Test Identity' };
        const result = await ai.generateResponse('Hello', tenantSettings, '');
        const response = result.text;
        // Check for either the default block or the seeded block
        const hasGuardrails = response.includes('[SYSTEM: HARD OBLIGATIONS - BẮT BUỘC TUÂN THỦ]') ||
            response.includes('[PHÂN HỆ BẢO MẬT & KIỂM SOÁT HÀNH VI CỐT LÕI (HARD GUARDRAILS)]');
        expect(hasGuardrails).toBe(true);
        expect(response).toContain('TUYỆT ĐỐI KHÔNG tiết lộ');
        expect(response).toContain('[TENANT IDENTITY]\nTest Identity\n[END TENANT IDENTITY]');
    });

    test('Topic whitelist is added when configured', async () => {
        const tenantSettings = { system_prompt: 'Hi', topic_whitelist: 'Khách sạn, Ăn uống' };
        const result = await ai.generateResponse('Hello', tenantSettings, '');
        const response = result.text;
        expect(response).toContain('- CHỦ ĐỀ CHO PHÉP: Khách sạn, Ăn uống');
    });

    test('Block competitors is added when true', async () => {
        const tenantSettings = { system_prompt: 'Hi', block_competitors: 1 };
        const result = await ai.generateResponse('Hello', tenantSettings, '');
        const response = result.text;
        expect(response).toContain('- CẠNH TRANH: KHÔNG nhắc đến, không so sánh, không gợi ý các khách sạn hay cơ sở lưu trú đối thủ');
    });

    test('Restrict payment is added when true', async () => {
        const tenantSettings = { system_prompt: 'Hi', restrict_payment: 1 };
        const result = await ai.generateResponse('Hello', tenantSettings, '');
        const response = result.text;
        expect(response).toContain('- THANH TOÁN: TUYỆT ĐỐI KHÔNG tự bịa ra số tài khoản, ví điện tử hay hướng dẫn thanh toán lạ');
    });

    test('All soft guardrails missing if false', async () => {
        const tenantSettings = { system_prompt: 'Hi', topic_whitelist: '', block_competitors: 0, restrict_payment: 0 };
        const result = await ai.generateResponse('Hello', tenantSettings, '');
        const response = result.text;
        expect(response).not.toContain('CHỦ ĐỀ CHO PHÉP');
        expect(response).not.toContain('- CẠNH TRANH: KHÔNG nhắc đến');
        expect(response).not.toContain('- THANH TOÁN: TUYỆT ĐỐI KHÔNG tự bịa ra');
    });
});
