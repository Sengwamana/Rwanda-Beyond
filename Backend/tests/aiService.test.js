import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getById: jest.fn(),
  },
  districts: {
    getById: jest.fn(),
  },
  fertilizationSchedules: {
    getLastExecuted: jest.fn(),
  },
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
};

const mockRecommendationService = {
  createIrrigationRecommendation: jest.fn(),
  createPestAlertRecommendation: jest.fn(),
  createFertilizationRecommendation: jest.fn(),
};

const mockGeminiService = {
  getAgriculturalAdvice: jest.fn(),
  getVoiceAssistantReply: jest.fn(),
  analyzeFarmImages: jest.fn(),
  checkServiceHealth: jest.fn(),
  getFertilizationRecommendation: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    ai: {
      farmContextCacheTtlMs: 60000,
      pestDetectionThreshold: 0.75,
      geminiModel: 'gemini-test',
      comprehensiveAnalysisConcurrency: 2,
    },
    maize: {
      optimalSoilMoisture: { min: 40, max: 60 },
      nutrientSufficiency: {
        nitrogen: { min: 40, max: 60 },
        phosphorus: { min: 25, max: 40 },
        potassium: { min: 150, max: 250 },
      },
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

await jest.unstable_mockModule('../src/services/weatherService.js', () => ({
  getWeatherForFarm: jest.fn(),
  analyzeWeatherImpact: jest.fn(),
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => ({
  ...mockSensorService,
}));

await jest.unstable_mockModule('../src/services/recommendationService.js', () => ({
  ...mockRecommendationService,
}));

await jest.unstable_mockModule('../src/services/imageService.js', () => ({
  getAIOptimizedUrl: jest.fn(),
  updateDetectionResults: jest.fn(),
}));

await jest.unstable_mockModule('../src/services/geminiService.js', () => mockGeminiService);

const aiService = await import('../src/services/aiService.js');

describe('aiService performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('caches farm context enrichment across repeated advice requests', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      district_id: 'district-1',
      crop_variety: 'H628',
      size_hectares: 2,
      current_growth_stage: 'tasseling',
      location_name: 'Rwamagana',
    });
    mockDb.districts.getById.mockResolvedValue({ name: 'Rwamagana' });
    mockGeminiService.getAgriculturalAdvice.mockResolvedValue({
      answer: 'Advice',
      suggestions: [],
      relatedTopics: [],
      confidence: 0.8,
      sources: [],
    });

    await aiService.getAgriculturalAdvice('How do I control pests in maize?', { farmId: 'farm-1' });
    await aiService.getAgriculturalAdvice('When should I weed?', { farmId: 'farm-1' });

    expect(mockDb.farms.getById).toHaveBeenCalledTimes(1);
    expect(mockDb.districts.getById).toHaveBeenCalledTimes(1);
    expect(mockGeminiService.getAgriculturalAdvice).toHaveBeenNthCalledWith(
      1,
      'How do I control pests in maize?',
      expect.objectContaining({
        farmId: 'farm-1',
        cropType: 'H628',
        farmSize: 2,
        growthStage: 'tasseling',
        district: 'Rwamagana',
        location: 'Rwamagana',
      })
    );
  });

  it('wraps single farm image analysis in an array and enriches context once', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-2',
      district_id: 'district-2',
      crop_variety: 'Maize',
      size_hectares: 1.5,
      current_growth_stage: 'silking',
      location_name: 'Bugesera',
    });
    mockDb.districts.getById.mockResolvedValue({ name: 'Bugesera' });
    mockGeminiService.analyzeFarmImages.mockResolvedValue({
      overallHealth: 'good',
      observations: [],
      issues: [],
      recommendations: [],
      growthStageEstimate: 'silking',
      confidence: 0.9,
    });

    await aiService.analyzeFarmImage('https://example.com/farm.jpg', { farmId: 'farm-2' });

    expect(mockGeminiService.analyzeFarmImages).toHaveBeenCalledWith(
      ['https://example.com/farm.jpg'],
      expect.objectContaining({
        farmId: 'farm-2',
        district: 'Bugesera',
        growthStage: 'silking',
      })
    );
  });

  it('reports healthy status from the structured Gemini health response', async () => {
    mockGeminiService.checkServiceHealth.mockResolvedValue({
      available: true,
      model: 'gemini-test',
      latencyMs: 120,
    });

    const result = await aiService.checkAIServiceHealth();

    expect(result).toEqual(
      expect.objectContaining({
        status: 'healthy',
        provider: 'gemini',
        model: 'gemini-test',
        details: expect.objectContaining({
          available: true,
          latencyMs: 120,
        }),
      })
    );
  });

  it('does not block nutrient analysis on fertilization recommendation creation', async () => {
    let resolveRecommendation;
    const recommendationPromise = new Promise((resolve) => {
      resolveRecommendation = resolve;
    });

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-3',
      user_id: 'user-3',
      district_id: 'district-3',
      current_growth_stage: 'vegetative',
      size_hectares: 2,
      soil_type: 'loam',
    });
    mockDb.districts.getById.mockResolvedValue({ name: 'Kayonza' });
    mockDb.fertilizationSchedules.getLastExecuted.mockResolvedValue({
      fertilizer_type: 'DAP',
      scheduled_date: '2026-03-01',
    });
    mockSensorService.getLatestReadings.mockResolvedValue({
      nitrogen: 12,
      phosphorus: 9,
      potassium: 40,
      ph_level: 6.2,
    });
    mockGeminiService.getFertilizationRecommendation.mockResolvedValue({
      needsFertilization: true,
      urgency: 'high',
      deficiencies: [{ nutrient: 'Nitrogen', level: 'severe' }],
      recommendedFertilizer: 'UREA',
      applicationRate: '120 kg/ha',
      totalQuantity: 240,
      applicationMethod: 'broadcast',
      timing: 'within 2 days',
      confidence: 0.88,
      reasoning: 'Nitrogen is below target',
      precautions: [],
      costEstimate: null,
    });
    mockRecommendationService.createFertilizationRecommendation.mockReturnValue(recommendationPromise);

    const result = await aiService.analyzeNutrientNeeds('farm-3');

    expect(result).toEqual(
      expect.objectContaining({
        needsFertilization: true,
        recommendedFertilizer: 'UREA',
        aiProvider: 'gemini',
      })
    );
    expect(mockRecommendationService.createFertilizationRecommendation).toHaveBeenCalledWith(
      'farm-3',
      expect.objectContaining({
        resolvedFarm: expect.objectContaining({
          _id: 'farm-3',
          user_id: 'user-3',
        }),
      })
    );

    resolveRecommendation(null);
    await Promise.resolve();
  });

  it('starts irrigation and nutrient analysis in parallel during comprehensive analysis', async () => {
    let resolveFirstReading;
    let resolveSecondReading;
    const firstReadingPromise = new Promise((resolve) => {
      resolveFirstReading = resolve;
    });
    const secondReadingPromise = new Promise((resolve) => {
      resolveSecondReading = resolve;
    });

    mockSensorService.getLatestReadings
      .mockReturnValueOnce(firstReadingPromise)
      .mockReturnValueOnce(secondReadingPromise);

    const analysisPromise = aiService.runComprehensiveAnalysis('farm-4');

    expect(mockSensorService.getLatestReadings).toHaveBeenCalledTimes(2);

    resolveFirstReading(null);
    resolveSecondReading(null);

    const result = await analysisPromise;

    expect(result).toEqual(
      expect.objectContaining({
        irrigation: null,
        nutrients: null,
      })
    );
  });
});
