import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const generateContentMock = jest.fn();
const getGenerativeModelMock = jest.fn(() => ({
  generateContent: generateContentMock,
}));
const axiosGetMock = jest.fn();
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel(...args) {
      return getGenerativeModelMock(...args);
    }
  },
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'harassment',
    HARM_CATEGORY_HATE_SPEECH: 'hate',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'sexual',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'danger',
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 'block-none',
  },
}));

await jest.unstable_mockModule('axios', () => ({
  default: {
    get: axiosGetMock,
  },
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    ai: {
      geminiApiKey: 'test-key',
      geminiModel: 'gemini-test',
      requestTimeoutMs: 20000,
      imageFetchTimeoutMs: 15000,
      imageFetchCacheTtlMs: 300000,
      imageFetchMaxBytes: 5242880,
      responseCacheTtlMs: 60000,
      healthCacheTtlMs: 30000,
      maxWeatherForecastEntries: 6,
      maxConversationHistoryEntries: 6,
      maxConversationEntryChars: 40,
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const geminiService = await import('../src/services/geminiService.js');

describe('geminiService performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGenerativeModelMock.mockReturnValue({
      generateContent: generateContentMock,
    });
  });

  it('caches repeated image fetches for the same image url', async () => {
    axiosGetMock.mockResolvedValue({
      data: Buffer.from('image-bytes'),
      headers: { 'content-type': 'image/jpeg' },
    });
    generateContentMock.mockResolvedValue({
      response: Promise.resolve({
        text: () => '{"pest_detected":false,"confidence":0.2,"affected_area":0,"severity":"none"}',
      }),
    });

    await geminiService.analyzePestImage('https://example.com/pest.jpg');
    await geminiService.analyzePestImage('https://example.com/pest.jpg');

    expect(axiosGetMock).toHaveBeenCalledTimes(1);
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it('trims conversation history before sending voice prompts to Gemini', async () => {
    let capturedPrompt = null;
    generateContentMock.mockImplementation(async (promptParts) => {
      capturedPrompt = promptParts;
      return {
        response: Promise.resolve({
          text: () => 'Keep checking the crop this afternoon.',
        }),
      };
    });

    const conversationHistory = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `entry-${index} ${'x'.repeat(80)}`,
    }));

    await geminiService.getVoiceAssistantReply('My maize leaves are curling badly today', {
      language: 'en',
      district: 'Kayonza',
      conversationHistory,
    });

    const historyPart = capturedPrompt.find((part) => part.text?.startsWith('Recent conversation:'));
    expect(historyPart.text).toContain('entry-2');
    expect(historyPart.text).toContain('entry-7');
    expect(historyPart.text).not.toContain('entry-0');
    expect(historyPart.text).not.toContain('x'.repeat(60));
  });

  it('summarizes weather forecast payloads before sending irrigation prompts', async () => {
    let capturedPrompt = '';
    generateContentMock.mockImplementation(async (prompt) => {
      capturedPrompt = prompt;
      return {
        response: Promise.resolve({
          text: () => '{"needs_irrigation":true,"urgency":"medium","recommended_time":"06:00","duration_minutes":20,"water_volume_liters":2000,"confidence":0.8}',
        }),
      };
    });

    const weatherForecast = Array.from({ length: 8 }, (_, index) => ({
      forecast_date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      temperature: 20 + index,
      humidity: 60 + index,
      precipitation_mm: index,
      weather_description: `weather-${index}`,
      unused_field: `unused-${index}`,
    }));

    await geminiService.getIrrigationRecommendation({
      soilMoisture: 30,
      soilTemperature: 22,
      airTemperature: 28,
      humidity: 65,
      growthStage: 'tasseling',
      farmSize: 2,
      soilType: 'Loam',
      weatherForecast,
    });

    expect(capturedPrompt).toContain('2026-03-01');
    expect(capturedPrompt).toContain('2026-03-06');
    expect(capturedPrompt).not.toContain('2026-03-07');
    expect(capturedPrompt).not.toContain('unused-0');
  });

  it('reuses cached advice responses for identical requests', async () => {
    generateContentMock.mockResolvedValue({
      response: Promise.resolve({
        text: () => 'Apply scouting and check for leaf damage.',
      }),
    });

    await geminiService.getAgriculturalAdvice('What should I do about leaf damage in maize?', {
      district: 'Ngoma',
      growthStage: 'tasseling',
      language: 'en',
    });
    await geminiService.getAgriculturalAdvice('What should I do about leaf damage in maize?', {
      district: 'Ngoma',
      growthStage: 'tasseling',
      language: 'en',
    });

    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it('reuses cached Gemini health checks within the health ttl', async () => {
    generateContentMock.mockResolvedValue({
      response: Promise.resolve({
        text: () => 'OK',
      }),
    });

    const first = await geminiService.checkServiceHealth();
    const second = await geminiService.checkServiceHealth();

    expect(first).toEqual(expect.objectContaining({ available: true }));
    expect(second).toEqual(expect.objectContaining({ available: true }));
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });
});
