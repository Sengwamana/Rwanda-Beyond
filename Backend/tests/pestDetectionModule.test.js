import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getById: jest.fn(),
    list: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
  pestDetections: {
    create: jest.fn(),
    getById: jest.fn(),
    getByFarm: jest.fn(),
    list: jest.fn(),
    getStats: jest.fn(),
    getUnreviewed: jest.fn(),
    getOutbreakMap: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getOldImages: jest.fn(),
  },
};

const mockImageService = {
  uploadImage: jest.fn(),
  validatePestImageFile: jest.fn(),
  validateUploadedPestImage: jest.fn(),
  deleteUploadedImages: jest.fn(),
  getThumbnailUrl: jest.fn(),
};

const mockAiService = {
  analyzePestImage: jest.fn(),
  shouldCreatePestAlertRecommendation: jest.fn(),
};

const mockRecommendationService = {
  createPestAlertRecommendation: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => next(),
  authorize: () => (_req, _res, next) => next(),
  ROLES: { FARMER: 'farmer', EXPERT: 'expert', ADMIN: 'admin' },
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
  validatePagination: (_req, _res, next) => next(),
  validateUUID: () => [],
  handleValidationErrors: (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/errorHandler.js', () => ({
  asyncHandler: (handler) => async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  },
}));

await jest.unstable_mockModule('../src/utils/response.js', () => ({
  successResponse: (res, data, message) => res.status(200).json({ success: true, data, message }),
  createdResponse: (res, data, message) => res.status(201).json({ success: true, data, message }),
  paginatedResponse: (res, data, page, limit, total, message) =>
    res.status(200).json({ success: true, data, page, limit, total, message }),
}));

await jest.unstable_mockModule('../src/services/imageService.js', () => mockImageService);
await jest.unstable_mockModule('../src/services/aiService.js', () => mockAiService);
await jest.unstable_mockModule('../src/services/recommendationService.js', () => mockRecommendationService);
await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const { default: router } = await import('../src/routes/pest-detection.js');

const getRouteHandler = (path, method = 'post') => {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('pest detection performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getByFarm.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getStats.mockResolvedValue([]);
    mockDb.pestDetections.getUnreviewed.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getOutbreakMap.mockResolvedValue([]);
  });

  it('analyzes the primary image before uploading secondary images', async () => {
    const uploadRoute = getRouteHandler('/upload/:farmId');

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      is_active: true,
    });
    mockImageService.validatePestImageFile.mockReturnValue({ valid: true });
    mockImageService.uploadImage
      .mockResolvedValueOnce({
        url: 'https://img.example/primary.jpg',
        publicId: 'primary',
        width: 600,
        height: 600,
      })
      .mockResolvedValueOnce({
        url: 'https://img.example/secondary.jpg',
        publicId: 'secondary',
        width: 600,
        height: 600,
      });
    mockImageService.validateUploadedPestImage.mockReturnValue({ valid: true });
    mockImageService.getThumbnailUrl.mockReturnValue('https://img.example/thumb.jpg');
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: false,
      pestType: null,
      severity: 'none',
      confidenceScore: 0.2,
      affectedAreaPercentage: 0,
      modelVersion: 'gemini-test',
      recommendations: [],
    });
    mockAiService.shouldCreatePestAlertRecommendation.mockReturnValue(false);
    mockDb.pestDetections.create.mockResolvedValue({ _id: 'detection-1' });

    const req = {
      params: { farmId: 'farm-1' },
      body: {},
      user: { id: 'user-1' },
      files: [
        { buffer: Buffer.from('primary'), size: 50000, mimetype: 'image/jpeg' },
        { buffer: Buffer.from('secondary'), size: 50000, mimetype: 'image/jpeg' },
      ],
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await uploadRoute(req, res, jest.fn());

    expect(mockImageService.uploadImage).toHaveBeenNthCalledWith(
      1,
      req.files[0].buffer,
      expect.objectContaining({ farmId: 'farm-1' })
    );
    expect(mockAiService.analyzePestImage).toHaveBeenCalledWith(
      'https://img.example/primary.jpg',
      expect.objectContaining({ farmId: 'farm-1' })
    );
    expect(mockImageService.uploadImage).toHaveBeenCalledTimes(2);
  });

  it('does not block upload response on pest alert recommendation creation', async () => {
    const uploadRoute = getRouteHandler('/upload/:farmId');
    let resolveRecommendation;
    const recommendationPromise = new Promise((resolve) => {
      resolveRecommendation = resolve;
    });

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      is_active: true,
    });
    mockImageService.validatePestImageFile.mockReturnValue({ valid: true });
    mockImageService.uploadImage.mockResolvedValue({
      url: 'https://img.example/primary.jpg',
      publicId: 'primary',
      width: 600,
      height: 600,
    });
    mockImageService.validateUploadedPestImage.mockReturnValue({ valid: true });
    mockImageService.getThumbnailUrl.mockReturnValue('https://img.example/thumb.jpg');
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: true,
      pestType: 'fall_armyworm',
      severity: 'moderate',
      confidenceScore: 0.9,
      affectedAreaPercentage: 12,
      modelVersion: 'gemini-test',
      recommendations: ['Scout nearby plants'],
    });
    mockAiService.shouldCreatePestAlertRecommendation.mockReturnValue(true);
    mockRecommendationService.createPestAlertRecommendation.mockReturnValue(recommendationPromise);
    mockDb.pestDetections.create.mockResolvedValue({ _id: 'detection-1' });

    const req = {
      params: { farmId: 'farm-1' },
      body: {},
      user: { id: 'user-1' },
      files: [{ buffer: Buffer.from('primary'), size: 50000, mimetype: 'image/jpeg' }],
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await uploadRoute(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockRecommendationService.createPestAlertRecommendation).toHaveBeenCalledTimes(1);

    resolveRecommendation(null);
    await Promise.resolve();
  });

  it('preserves capturedAt in pest upload detection metadata', async () => {
    const uploadRoute = getRouteHandler('/upload/:farmId');

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      is_active: true,
    });
    mockImageService.validatePestImageFile.mockReturnValue({ valid: true });
    mockImageService.uploadImage.mockResolvedValue({
      url: 'https://img.example/primary.jpg',
      publicId: 'primary',
      width: 600,
      height: 600,
    });
    mockImageService.validateUploadedPestImage.mockReturnValue({ valid: true });
    mockImageService.getThumbnailUrl.mockReturnValue('https://img.example/thumb.jpg');
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: false,
      pestType: null,
      severity: 'none',
      confidenceScore: 0.2,
      affectedAreaPercentage: 0,
      modelVersion: 'gemini-test',
      recommendations: [],
    });
    mockAiService.shouldCreatePestAlertRecommendation.mockReturnValue(false);
    mockDb.pestDetections.create.mockResolvedValue({ _id: 'detection-1' });

    const req = {
      params: { farmId: 'farm-1' },
      body: {
        capturedAt: '2026-03-09T10:15:00.000Z',
        location: JSON.stringify({ lat: -1.95, lng: 30.06 }),
      },
      user: { id: 'user-1' },
      files: [{ buffer: Buffer.from('primary'), size: 50000, mimetype: 'image/jpeg' }],
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await uploadRoute(req, res, jest.fn());

    expect(mockDb.pestDetections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -1.95,
        longitude: 30.06,
        detection_metadata: expect.objectContaining({
          captured_at: '2026-03-09T10:15:00.000Z',
          location: { lat: -1.95, lng: 30.06 },
        }),
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'detection-1',
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns a validation error for malformed upload location payloads', async () => {
    const uploadRoute = getRouteHandler('/upload/:farmId');

    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      is_active: true,
    });
    mockImageService.validatePestImageFile.mockReturnValue({ valid: true });
    mockImageService.uploadImage.mockResolvedValue({
      url: 'https://img.example/primary.jpg',
      publicId: 'primary',
      width: 600,
      height: 600,
    });
    mockImageService.validateUploadedPestImage.mockReturnValue({ valid: true });
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: false,
      pestType: null,
      severity: 'none',
      confidenceScore: 0.2,
      affectedAreaPercentage: 0,
      modelVersion: 'gemini-test',
      recommendations: [],
    });

    const req = {
      params: { farmId: 'farm-1' },
      body: {
        location: '{bad-json',
      },
      user: { id: 'user-1' },
      files: [{ buffer: Buffer.from('primary'), size: 50000, mimetype: 'image/jpeg' }],
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await uploadRoute(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Location must be valid JSON',
      })
    );
    expect(mockImageService.uploadImage).not.toHaveBeenCalled();
    expect(mockAiService.analyzePestImage).not.toHaveBeenCalled();
    expect(mockDb.pestDetections.create).not.toHaveBeenCalled();
  });

  it('stores reanalysis results back into the pest detection schema fields', async () => {
    const reanalyzeRoute = getRouteHandler('/:detectionId/reanalyze');

    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-2',
      farm_id: 'farm-1',
      image_url: 'https://img.example/existing.jpg',
      pest_detected: false,
      pest_type: null,
      severity: 'none',
      confidence_score: 0.2,
      affected_area_percentage: 0,
      model_version: 'old-model',
      detection_metadata: {
        analysis: { pestDetected: false },
      },
    });
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: true,
      pestType: 'fall_armyworm',
      severity: 'high',
      confidenceScore: 0.94,
      affectedAreaPercentage: 21,
      modelVersion: 'gemini-test',
      recommendations: ['Apply treatment'],
    });
    mockDb.pestDetections.update.mockResolvedValue({
      _id: 'detection-2',
      pest_detected: true,
      pest_type: 'fall_armyworm',
      severity: 'high',
      confidence_score: 0.94,
    });

    const req = {
      params: { detectionId: 'detection-2' },
      user: { _id: 'expert-1', id: 'expert-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await reanalyzeRoute(req, res, jest.fn());

    expect(mockAiService.analyzePestImage).toHaveBeenCalledWith(
      'https://img.example/existing.jpg',
      expect.objectContaining({
        farmId: 'farm-1',
        existingAnalysis: { pestDetected: false },
      })
    );
    expect(mockDb.pestDetections.update).toHaveBeenCalledWith(
      'detection-2',
      expect.objectContaining({
        pest_detected: true,
        pest_type: 'fall_armyworm',
        severity: 'high',
        confidence_score: 0.94,
        affected_area_percentage: 21,
        model_version: 'gemini-test',
        detection_metadata: expect.objectContaining({
          analysis: expect.objectContaining({
            pestDetected: true,
            pestType: 'fall_armyworm',
          }),
          reanalysis: expect.objectContaining({
            pestDetected: true,
            pestType: 'fall_armyworm',
          }),
          reanalyzedBy: 'expert-1',
        }),
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-1',
        action: 'REANALYZE_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'detection-2',
      })
    );
  });

  it('returns not found when the pest detection disappears before reanalysis persistence', async () => {
    const reanalyzeRoute = getRouteHandler('/:detectionId/reanalyze');

    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-2',
      farm_id: 'farm-1',
      image_url: 'https://img.example/existing.jpg',
      pest_detected: false,
      pest_type: null,
      severity: 'none',
      confidence_score: 0.2,
      affected_area_percentage: 0,
      model_version: 'old-model',
      detection_metadata: {
        analysis: { pestDetected: false },
      },
    });
    mockAiService.analyzePestImage.mockResolvedValue({
      pestDetected: true,
      pestType: 'fall_armyworm',
      severity: 'high',
      confidenceScore: 0.94,
      affectedAreaPercentage: 21,
      modelVersion: 'gemini-test',
      recommendations: ['Apply treatment'],
    });
    mockDb.pestDetections.update.mockResolvedValue(null);

    const req = {
      params: { detectionId: 'detection-2' },
      user: { _id: 'expert-1', id: 'expert-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await reanalyzeRoute(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('does not block expert review response on recommendation creation', async () => {
    const reviewRoute = getRouteHandler('/:detectionId/review');
    let resolveRecommendation;
    const recommendationPromise = new Promise((resolve) => {
      resolveRecommendation = resolve;
    });

    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-1',
      farm_id: 'farm-1',
      pest_type: 'fall_armyworm',
      severity: 'high',
      confidence_score: 0.92,
      affected_area_percentage: 18,
      image_url: 'https://img.example/primary.jpg',
      detection_metadata: {
        analysis: {
          recommendations: ['Apply control measures'],
        },
      },
    });
    mockDb.pestDetections.update.mockResolvedValue({
      _id: 'detection-1',
      farm_id: 'farm-1',
      confidence_score: 0.92,
      affected_area_percentage: 18,
      image_url: 'https://img.example/primary.jpg',
      detection_metadata: {
        analysis: {
          recommendations: ['Apply control measures'],
        },
      },
    });
    mockAiService.shouldCreatePestAlertRecommendation.mockReturnValue(true);
    mockRecommendationService.createPestAlertRecommendation.mockReturnValue(recommendationPromise);

    const req = {
      params: { detectionId: 'detection-1' },
      body: {
        isConfirmed: true,
        confirmedPest: 'fall_armyworm',
        confirmedSeverity: 'high',
      },
      user: { _id: 'expert-1', id: 'expert-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await reviewRoute(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRecommendationService.createPestAlertRecommendation).toHaveBeenCalledTimes(1);
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-1',
        action: 'REVIEW_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'detection-1',
      })
    );

    resolveRecommendation(null);
    await Promise.resolve();
  });

  it('returns not found when the pest detection disappears before expert review persistence', async () => {
    const reviewRoute = getRouteHandler('/:detectionId/review');

    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-1',
      farm_id: 'farm-1',
      pest_type: 'fall_armyworm',
      severity: 'high',
      confidence_score: 0.92,
      affected_area_percentage: 18,
      image_url: 'https://img.example/primary.jpg',
      detection_metadata: {},
    });
    mockDb.pestDetections.update.mockResolvedValue(null);

    const req = {
      params: { detectionId: 'detection-1' },
      body: {
        isConfirmed: true,
        confirmedPest: 'fall_armyworm',
        confirmedSeverity: 'high',
      },
      user: { _id: 'expert-1', id: 'expert-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await reviewRoute(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
    expect(mockRecommendationService.createPestAlertRecommendation).not.toHaveBeenCalled();
  });

  it('writes an audit log when deleting a stored pest detection', async () => {
    const deleteRoute = getRouteHandler('/:detectionId', 'delete');

    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'detection-9',
      farm_id: 'farm-1',
      image_url: 'https://img.example/delete.jpg',
      pest_detected: true,
      pest_type: 'fall_armyworm',
      severity: 'high',
    });
    mockDb.pestDetections.remove.mockResolvedValue(null);

    const req = {
      params: { detectionId: 'detection-9' },
      user: { id: 'expert-1', _id: 'expert-1', role: 'expert' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await deleteRoute(req, res, jest.fn());

    expect(mockDb.pestDetections.remove).toHaveBeenCalledWith('detection-9');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-1',
        action: 'DELETE_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'detection-9',
        old_values: expect.objectContaining({
          farm_id: 'farm-1',
          pest_type: 'fall_armyworm',
          severity: 'high',
        }),
      })
    );
  });

  it('maps farm detection status/date filters to persisted pest query fields and uses count', async () => {
    const farmListRoute = getRouteHandler('/farm/:farmId', 'get');
    mockDb.pestDetections.getByFarm.mockResolvedValue({
      data: [{ _id: 'detection-1' }],
      count: 11,
    });

    const req = {
      params: { farmId: 'farm-1' },
      query: {
        page: '2',
        limit: '5',
        status: 'detected',
        severity: 'high',
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      },
      user: { id: 'user-1', _id: 'user-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await farmListRoute(req, res, jest.fn());

    expect(mockDb.pestDetections.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        page: 2,
        limit: 5,
        pestDetected: true,
        severity: 'high',
        since: Date.parse('2026-03-01'),
        until: Date.parse('2026-03-09'),
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 11,
      })
    );
  });

  it('uses the persisted detection list query for unscoped listing and returns backend count', async () => {
    const listRoute = getRouteHandler('/', 'get');
    mockDb.pestDetections.list.mockResolvedValue({
      data: [{ _id: 'detection-2' }],
      count: 7,
    });

    const req = {
      query: {
        page: '1',
        limit: '10',
        status: 'clear',
      },
      user: { id: 'expert-1', _id: 'expert-1', role: 'expert' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await listRoute(req, res, jest.fn());

    expect(mockDb.pestDetections.list).toHaveBeenCalledWith(
      expect.objectContaining({
        pestDetected: false,
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 7,
      })
    );
  });

  it('builds pest statistics from stored pest_type values and mapped date filters', async () => {
    const statsRoute = getRouteHandler('/stats', 'get');
    mockDb.pestDetections.getStats.mockResolvedValue([
      { severity: 'high', pest_type: 'fall_armyworm' },
      { severity: 'moderate', pest_type: 'fall_armyworm' },
      { severity: 'low', pest_type: 'leaf_beetle' },
    ]);

    const req = {
      query: {
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      },
      user: { id: 'expert-1', _id: 'expert-1', role: 'expert' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await statsRoute(req, res, jest.fn());

    expect(mockDb.pestDetections.getStats).toHaveBeenCalledWith({
      since: Date.parse('2026-03-01'),
      until: Date.parse('2026-03-09'),
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          byPest: expect.arrayContaining([
            expect.objectContaining({ pest: 'fall_armyworm', count: 2 }),
            expect.objectContaining({ pest: 'leaf_beetle', count: 1 }),
          ]),
          totalDetections: 3,
        }),
      })
    );
  });

});
