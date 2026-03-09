import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const destroyMock = jest.fn();
const mockDb = {
  auditLogs: {
    create: jest.fn(),
  },
  pestDetections: {
    create: jest.fn(),
    getById: jest.fn(),
    getOldImages: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
  },
};
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: destroyMock,
    },
    url: jest.fn((publicId) => `https://cloudinary.example/${publicId}`),
  },
}));

await jest.unstable_mockModule('multer', () => ({
  default: Object.assign(
    () => ({}),
    {
      memoryStorage: jest.fn(() => ({})),
    }
  ),
}));

await jest.unstable_mockModule('multer-storage-cloudinary', () => ({
  CloudinaryStorage: class {},
}));

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    cloudinary: {
      cloudName: 'demo',
      apiKey: 'demo',
      apiSecret: 'demo',
    },
    server: {
      isDevelopment: true,
    },
  },
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const imageService = await import('../src/services/imageService.js');

describe('imageService pest cleanup performance fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cleans up stale pest images using the returned record ids', async () => {
    mockDb.pestDetections.getOldImages.mockResolvedValue([
      { id: 'det-1', cloudinary_public_id: 'public-1', created_at: 1000, is_confirmed: false },
      { id: 'det-2', cloudinary_public_id: null, created_at: 2000, is_confirmed: false },
    ]);
    mockDb.pestDetections.remove.mockResolvedValue(null);
    destroyMock.mockResolvedValue({ result: 'ok' });

    await imageService.cleanupOldImages(90);

    expect(destroyMock).toHaveBeenCalledWith('public-1');
    expect(mockDb.pestDetections.remove).toHaveBeenCalledWith('det-1');
    expect(mockDb.pestDetections.remove).toHaveBeenCalledWith('det-2');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'det-1',
        old_values: expect.objectContaining({
          cloudinary_public_id: 'public-1',
          created_at: 1000,
          is_confirmed: false,
        }),
        new_values: {
          deleted_by_cleanup: true,
          retention_days: 90,
        },
      })
    );
  });

  it('stores pest image capture metadata using latitude and longitude fields', async () => {
    mockDb.pestDetections.create.mockResolvedValue({ _id: 'det-3' });

    const result = await imageService.processPestDetectionImage(
      {
        filename: 'pest-123',
        path: 'https://cloudinary.example/pest-123',
      },
      {
        farmId: 'farm-1',
        userId: 'user-1',
        latitude: -1.95,
        longitude: 30.06,
        capturedAt: '2026-03-09T10:15:00.000Z',
      }
    );

    expect(mockDb.pestDetections.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 'farm-1',
        reported_by: 'user-1',
        latitude: -1.95,
        longitude: 30.06,
        detection_metadata: {
          captured_at: '2026-03-09T10:15:00.000Z',
        },
      })
    );
    expect(mockDb.pestDetections.create.mock.calls[0][0]).not.toHaveProperty('coordinates');
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'det-3',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        detectionId: 'det-3',
        capturedAt: '2026-03-09T10:15:00.000Z',
      })
    );
  });

  it('writes an audit log when persisting AI detection result updates', async () => {
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'det-4',
      reported_by: 'user-1',
      pest_detected: false,
      pest_type: null,
      severity: 'none',
      confidence_score: 0.15,
    });
    mockDb.pestDetections.update.mockResolvedValue({ _id: 'det-4' });

    await imageService.updateDetectionResults('det-4', {
      pestDetected: true,
      pestType: 'fall_armyworm',
      severity: 'high',
      confidenceScore: 0.91,
      affectedAreaPercentage: 18,
      modelVersion: 'gemini-test',
      detectionMetadata: { analysis: { pestDetected: true } },
    });

    expect(mockDb.pestDetections.update).toHaveBeenCalledWith(
      'det-4',
      expect.objectContaining({
        pest_detected: true,
        pest_type: 'fall_armyworm',
        severity: 'high',
        confidence_score: 0.91,
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'UPDATE_PEST_DETECTION_RESULTS',
        entity_type: 'pest_detections',
        entity_id: 'det-4',
        old_values: expect.objectContaining({
          pest_detected: false,
          severity: 'none',
        }),
        new_values: expect.objectContaining({
          pest_detected: true,
          pest_type: 'fall_armyworm',
        }),
      })
    );
  });

  it('fails before persistence when updating AI detection results for a missing record', async () => {
    mockDb.pestDetections.getById.mockResolvedValue(null);

    await expect(
      imageService.updateDetectionResults('missing-det', {
        pestDetected: true,
        pestType: 'fall_armyworm',
        severity: 'high',
        confidenceScore: 0.91,
      })
    ).rejects.toMatchObject({
      message: 'Pest detection not found',
    });

    expect(mockDb.pestDetections.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('fails cleanly when a pest detection disappears before AI result persistence', async () => {
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'det-4',
      reported_by: 'user-1',
      pest_detected: false,
      pest_type: null,
      severity: 'none',
      confidence_score: 0.15,
    });
    mockDb.pestDetections.update.mockResolvedValue(null);

    await expect(
      imageService.updateDetectionResults('det-4', {
        pestDetected: true,
        pestType: 'fall_armyworm',
        severity: 'high',
        confidenceScore: 0.91,
      })
    ).rejects.toMatchObject({
      message: 'Pest detection not found',
    });

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('writes an audit log when storing expert review results', async () => {
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'det-5',
      reviewed_by: null,
      is_confirmed: undefined,
      expert_notes: undefined,
    });
    mockDb.pestDetections.update.mockResolvedValue({ _id: 'det-5' });

    await imageService.addExpertReview('det-5', 'expert-1', {
      isConfirmed: true,
      notes: 'Confirmed by field expert',
    });

    expect(mockDb.pestDetections.update).toHaveBeenCalledWith(
      'det-5',
      expect.objectContaining({
        reviewed_by: 'expert-1',
        is_confirmed: true,
        expert_notes: 'Confirmed by field expert',
      })
    );
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'expert-1',
        action: 'REVIEW_PEST_DETECTION',
        entity_type: 'pest_detections',
        entity_id: 'det-5',
      })
    );
  });

  it('fails before persistence when storing expert review for a missing record', async () => {
    mockDb.pestDetections.getById.mockResolvedValue(null);

    await expect(
      imageService.addExpertReview('missing-det', 'expert-1', {
        isConfirmed: true,
        notes: 'Confirmed by field expert',
      })
    ).rejects.toMatchObject({
      message: 'Pest detection not found',
    });

    expect(mockDb.pestDetections.update).not.toHaveBeenCalled();
    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('fails cleanly when a pest detection disappears before expert review persistence', async () => {
    mockDb.pestDetections.getById.mockResolvedValue({
      _id: 'det-5',
      reviewed_by: null,
      is_confirmed: undefined,
      expert_notes: undefined,
    });
    mockDb.pestDetections.update.mockResolvedValue(null);

    await expect(
      imageService.addExpertReview('det-5', 'expert-1', {
        isConfirmed: true,
        notes: 'Confirmed by field expert',
      })
    ).rejects.toMatchObject({
      message: 'Pest detection not found',
    });

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });
});
