import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  farms: {
    getUserId: jest.fn(),
    getById: jest.fn(),
    list: jest.fn(),
    listActive: jest.fn(),
  },
  sensorData: {
    list: jest.fn(),
    getDailyAggregates: jest.fn(),
    getLatestReadings: jest.fn(),
    countSince: jest.fn(),
  },
  recommendations: {
    getByFarm: jest.fn(),
    list: jest.fn(),
    getStats: jest.fn(),
  },
  irrigationSchedules: {
    getByFarm: jest.fn(),
    getUpcoming: jest.fn(),
  },
  fertilizationSchedules: {
    getHistory: jest.fn(),
  },
  pestControlSchedules: {
    getByFarm: jest.fn(),
  },
  pestDetections: {
    getByFarm: jest.fn(),
    getRecent: jest.fn(),
    getStats: jest.fn(),
    getOutbreakMap: jest.fn(),
  },
  farmIssues: {
    getByFarm: jest.fn(),
  },
  users: {
    list: jest.fn(),
    listAll: jest.fn(),
  },
  sensors: {
    listAllStats: jest.fn(),
  },
  districts: {
    list: jest.fn(),
  },
};

const mockSensorService = {
  getLatestReadings: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/middleware/auth.js', () => ({
  authenticate: (_req, _res, next) => next(),
  ROLES: { FARMER: 'farmer', EXPERT: 'expert', ADMIN: 'admin' },
  requireOwnership: () => (_req, _res, next) => next(),
  requireMinimumRole: () => (_req, _res, next) => next(),
}));

await jest.unstable_mockModule('../src/middleware/validation.js', () => ({
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
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => mockSensorService);

const { default: router } = await import('../src/routes/analytics.js');

const getRouteHandler = (path, method = 'get') => {
  const layer = router.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer.route.stack[layer.route.stack.length - 1].handle;
};

describe('analytics sensor trend route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.listActive.mockResolvedValue([]);
    mockDb.users.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.users.listAll.mockResolvedValue([]);
    mockDb.sensorData.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensorData.countSince.mockResolvedValue(0);
    mockDb.recommendations.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.recommendations.getStats.mockResolvedValue([]);
    mockDb.irrigationSchedules.getByFarm.mockResolvedValue([]);
    mockDb.fertilizationSchedules.getHistory.mockResolvedValue([]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([]);
    mockDb.pestDetections.getByFarm.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getStats.mockResolvedValue([]);
    mockDb.pestDetections.getOutbreakMap.mockResolvedValue([]);
    mockDb.farmIssues.getByFarm.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensors.listAllStats.mockResolvedValue([]);
    mockDb.districts.list.mockResolvedValue([]);
  });

  it('returns daily aggregates with soil temperature and NPK trend fields preserved', async () => {
    const route = getRouteHandler('/farm/:farmId/sensor-trends');
    mockDb.sensorData.getDailyAggregates.mockResolvedValue([
      {
        farm_id: 'farm-1',
        reading_date: '2026-03-09',
        avg_soil_moisture: 45,
        avg_soil_temperature: 21.5,
        avg_temperature: 24,
        avg_humidity: 72,
        avg_nitrogen: 118,
        avg_phosphorus: 31,
        avg_potassium: 165,
        reading_count: 8,
      },
    ]);

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '7' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.sensorData.getDailyAggregates).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          farmId: 'farm-1',
          trends: [
            expect.objectContaining({
              avg_soil_temperature: 21.5,
              avg_nitrogen: 118,
              avg_phosphorus: 31,
              avg_potassium: 165,
            }),
          ],
        }),
      })
    );
  });

  it('returns a merged latest sensor snapshot for dashboard analytics', async () => {
    const route = getRouteHandler('/farm/:farmId/dashboard');
    mockDb.farms.getById.mockResolvedValue({ _id: 'farm-1', name: 'North field' });
    mockSensorService.getLatestReadings.mockResolvedValue({
      farm_id: 'farm-1',
      soil_moisture: 48,
      soil_temperature: 22,
      air_temperature: 25,
      humidity: 74,
      nitrogen: 120,
      phosphorus: 33,
      potassium: 170,
      reading_timestamp: 1741514700000,
    });
    mockDb.recommendations.getByFarm.mockResolvedValue([]);
    mockDb.irrigationSchedules.getUpcoming.mockResolvedValue([]);
    mockDb.pestDetections.getRecent.mockResolvedValue([]);

    const req = {
      params: { farmId: 'farm-1' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockSensorService.getLatestReadings).toHaveBeenCalledWith('farm-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          latestReadings: expect.objectContaining({
            soil_moisture: 48,
            soil_temperature: 22,
            humidity: 74,
            nitrogen: 120,
            phosphorus: 33,
            potassium: 170,
          }),
          latestSensorData: [
            expect.objectContaining({
              soil_moisture: 48,
              soil_temperature: 22,
              humidity: 74,
              nitrogen: 120,
              phosphorus: 33,
              potassium: 170,
            }),
          ],
        }),
      })
    );
  });

  it('exports analytics summary using persisted count fields and the global sensor-data list query', async () => {
    const route = getRouteHandler('/export');
    mockDb.farms.list.mockResolvedValue({ data: [{ _id: 'farm-1' }], count: 25 });
    mockDb.users.list.mockResolvedValue({ data: [{ _id: 'user-1' }], count: 40 });
    mockDb.sensorData.list.mockResolvedValue({ data: [{ _id: 'reading-1' }], count: 320 });
    mockDb.recommendations.list.mockResolvedValue({ data: [{ _id: 'rec-1' }], count: 18 });

    const req = {
      query: {
        format: 'json',
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.sensorData.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 1,
        since: Date.parse('2026-03-01'),
        until: Date.parse('2026-03-09'),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            totalFarms: 25,
            totalUsers: 40,
            totalSensorReadings: 320,
            totalRecommendations: 18,
          }),
        }),
      })
    );
  });

  it('returns recommendation history with persisted response channel data', async () => {
    const route = getRouteHandler('/farm/:farmId/recommendation-history');
    mockDb.recommendations.getByFarm.mockResolvedValue([
      {
        _id: 'rec-1',
        type: 'irrigation',
        status: 'executed',
        priority: 'high',
        created_at: 1741478400000,
        responded_at: 1741482000000,
        responded_by: 'user-1',
        response_channel: 'ussd',
      },
      {
        _id: 'rec-2',
        type: 'fertilization',
        status: 'pending',
        priority: 'medium',
        created_at: 1741564800000,
      },
    ]);

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '30' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.recommendations.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        since: expect.any(Number),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          history: [
            expect.objectContaining({
              responded_by: 'user-1',
              response_channel: 'ussd',
            }),
            expect.objectContaining({
              status: 'pending',
            }),
          ],
          stats: expect.objectContaining({
            total: 2,
            byChannel: {
              ussd: 1,
            },
            responseRate: 50,
            averageResponseTime: 1,
          }),
        }),
      })
    );
  });

  it('returns farm activity history across recommendations, schedules, scans, and issues', async () => {
    const route = getRouteHandler('/farm/:farmId/activity');
    mockDb.recommendations.getByFarm.mockResolvedValue([
      {
        _id: 'rec-1',
        title: 'Irrigate north plot',
        type: 'irrigation',
        priority: 'high',
        status: 'executed',
        created_at: Date.parse('2026-03-08T08:00:00.000Z'),
        responded_at: Date.parse('2026-03-08T09:00:00.000Z'),
        response_channel: 'web',
        updated_at: Date.parse('2026-03-08T10:00:00.000Z'),
      },
    ]);
    mockDb.irrigationSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'irr-1',
        scheduled_date: '2026-03-09',
        scheduled_time: '06:00',
        previous_scheduled_date: '2026-03-08',
        previous_scheduled_time: '06:00',
        postponed_at: Date.parse('2026-03-08T18:00:00.000Z'),
        is_executed: true,
        created_at: Date.parse('2026-03-09T06:30:00.000Z'),
        executed_at: Date.parse('2026-03-09T10:30:00.000Z'),
      },
    ]);
    mockDb.fertilizationSchedules.getHistory.mockResolvedValue([
      {
        _id: 'fert-1',
        scheduled_date: '2026-03-08',
        is_executed: true,
        created_at: Date.parse('2026-03-07T07:00:00.000Z'),
        executed_at: Date.parse('2026-03-07T08:00:00.000Z'),
      },
    ]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-1',
        detection_id: 'pest-1',
        scheduled_date: '2026-03-10',
        control_method: 'Targeted spray application',
        is_executed: true,
        created_at: Date.parse('2026-03-10T10:00:00.000Z'),
        executed_at: Date.parse('2026-03-10T16:00:00.000Z'),
        actual_outcome: 'completed',
      },
    ]);
    mockDb.pestDetections.getByFarm.mockResolvedValue({
      data: [
        {
          _id: 'pest-1',
          pest_detected: true,
          pest_type: 'fall_armyworm',
          severity: 'high',
          created_at: Date.parse('2026-03-10T08:00:00.000Z'),
          reviewed_at: Date.parse('2026-03-10T09:00:00.000Z'),
          is_confirmed: true,
        },
      ],
      count: 1,
    });
    mockDb.farmIssues.getByFarm.mockResolvedValue({
      data: [
        {
          _id: 'issue-1',
          title: 'Sensor offline',
          category: 'sensor',
          severity: 'high',
          status: 'resolved',
          created_at: Date.parse('2026-03-11T08:00:00.000Z'),
          resolved_at: Date.parse('2026-03-11T09:00:00.000Z'),
          updated_at: Date.parse('2026-03-11T09:00:00.000Z'),
        },
      ],
      count: 1,
    });

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '30', limit: '10' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.irrigationSchedules.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        afterDate: expect.any(String),
        limit: 50,
      })
    );
    expect(mockDb.farmIssues.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        page: 1,
        limit: 25,
        since: expect.any(Number),
      })
    );
    expect(mockDb.pestControlSchedules.getByFarm).toHaveBeenCalledWith(
      'farm-1',
      expect.objectContaining({
        since: expect.any(String),
        limit: 50,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          farmId: 'farm-1',
          summary: expect.objectContaining({
            total: expect.any(Number),
            byType: expect.objectContaining({
              recommendation: expect.any(Number),
              irrigation: expect.any(Number),
              fertilization: expect.any(Number),
              pest_control: expect.any(Number),
              pest_detection: expect.any(Number),
              farm_issue: expect.any(Number),
            }),
            byAction: expect.objectContaining({
              postponed: expect.any(Number),
            }),
          }),
          activity: expect.arrayContaining([
            expect.objectContaining({
              type: 'pest_control',
              action: 'executed',
              title: 'Pest Control Executed',
            }),
            expect.objectContaining({
              type: 'farm_issue',
              action: 'completed',
              title: 'Sensor offline',
            }),
            expect.objectContaining({
              type: 'pest_detection',
              action: 'reviewed',
              status: 'confirmed',
            }),
            expect.objectContaining({
              type: 'recommendation',
              action: 'executed',
              title: 'Irrigate north plot',
            }),
            expect.objectContaining({
              type: 'irrigation',
              action: 'postponed',
              title: 'Irrigation Postponed',
            }),
          ]),
        }),
      })
    );
  });

  it('exports farm activity as csv for a farm owner', async () => {
    const route = getRouteHandler('/farm/:farmId/activity/export');
    mockDb.recommendations.getByFarm.mockResolvedValue([
      {
        _id: 'rec-2',
        title: 'Apply fertilizer',
        type: 'fertilization',
        priority: 'medium',
        status: 'executed',
        created_at: Date.parse('2026-03-12T08:00:00.000Z'),
        updated_at: Date.parse('2026-03-12T12:00:00.000Z'),
      },
    ]);
    mockDb.irrigationSchedules.getByFarm.mockResolvedValue([]);
    mockDb.fertilizationSchedules.getHistory.mockResolvedValue([]);
    mockDb.pestDetections.getByFarm.mockResolvedValue({ data: [], count: 0 });
    mockDb.farmIssues.getByFarm.mockResolvedValue({ data: [], count: 0 });

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '30', limit: '20', format: 'csv' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('farm-activity-farm-1-')
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"Apply fertilizer"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"recommendation"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"Fertilization recommendation generated with medium priority."'));
  });

  it('filters exported farm activity by requested type for expert reporting', async () => {
    const route = getRouteHandler('/farm/:farmId/activity/export');
    mockDb.recommendations.getByFarm.mockResolvedValue([
      {
        _id: 'rec-3',
        title: 'Inspect the maize canopy',
        type: 'pest_alert',
        priority: 'high',
        status: 'pending',
        created_at: Date.parse('2026-03-12T08:00:00.000Z'),
      },
    ]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-2',
        detection_id: 'pest-22',
        scheduled_date: '2026-03-13',
        control_method: 'Targeted scouting pass',
        is_executed: true,
        created_at: Date.parse('2026-03-13T07:30:00.000Z'),
        executed_at: Date.parse('2026-03-13T11:00:00.000Z'),
        actual_outcome: 'follow_up_completed',
      },
    ]);

    const req = {
      params: { farmId: 'farm-1' },
      query: { days: '30', limit: '20', format: 'json', type: 'pest_control' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await route(req, res, jest.fn());

    const payload = JSON.parse(res.send.mock.calls[0][0]);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
    expect(payload.filters).toEqual({
      type: 'pest_control',
      limit: 20,
    });
    expect(payload.activity).toHaveLength(2);
    expect(payload.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'pest_control',
          action: 'scheduled',
        }),
        expect.objectContaining({
          type: 'pest_control',
          action: 'executed',
        }),
      ])
    );
    expect(payload.activity).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'recommendation',
        }),
      ])
    );
    expect(payload.summary.byType).toEqual(
      expect.objectContaining({
        pest_control: 2,
      })
    );
  });

  it('returns normalized recent system activity with summary counts and timeline items', async () => {
    const route = getRouteHandler('/activity');
    mockDb.users.list.mockResolvedValue({
      data: [
        {
          _id: 'user-1',
          first_name: 'Aline',
          last_name: 'Mukamana',
          role: 'farmer',
          created_at: Date.parse('2026-03-14T06:00:00.000Z'),
          is_active: true,
        },
      ],
      count: 1,
    });
    mockDb.farms.list.mockResolvedValue({
      data: [
        {
          _id: 'farm-1',
          name: 'East Plot',
          created_at: Date.parse('2026-03-14T07:00:00.000Z'),
          is_active: true,
          district: { name: 'Kayonza' },
        },
      ],
      count: 1,
    });
    mockDb.farms.listActive.mockResolvedValue([
      {
        _id: 'farm-1',
        name: 'East Plot',
      },
    ]);
    mockDb.sensorData.countSince.mockResolvedValue(42);
    mockDb.recommendations.list.mockResolvedValue({
      data: [
        {
          _id: 'rec-1',
          type: 'irrigation',
          title: 'Irrigate East Plot',
          priority: 'high',
          status: 'pending',
          created_at: Date.parse('2026-03-14T08:00:00.000Z'),
        },
      ],
      count: 1,
    });
    mockDb.pestDetections.getStats.mockResolvedValue([
      {
        pest_detected: true,
        pest_type: 'fall_armyworm',
        severity: 'high',
        created_at: Date.parse('2026-03-14T09:00:00.000Z'),
      },
    ]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-1',
        farm_id: 'farm-1',
        detection_id: 'pest-1',
        scheduled_date: '2026-03-14',
        control_method: 'Targeted spray application',
        is_executed: true,
        created_at: Date.parse('2026-03-14T10:00:00.000Z'),
        executed_at: Date.parse('2026-03-14T13:30:00.000Z'),
        actual_outcome: 'completed',
      },
    ]);

    const req = {
      query: { hours: '24', limit: '8' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(mockDb.recommendations.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 50,
        since: expect.any(Number),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            newUsers: 1,
            newFarms: 1,
            sensorReadings: 42,
            recommendations: 1,
            pestDetections: 1,
            pestControlActions: 1,
          }),
          activities: expect.arrayContaining([
            expect.objectContaining({
              type: 'user',
              title: 'Aline Mukamana',
            }),
            expect.objectContaining({
              type: 'farm',
              title: 'East Plot',
            }),
            expect.objectContaining({
              type: 'recommendation',
              title: 'Irrigate East Plot',
            }),
            expect.objectContaining({
              type: 'pest_detection',
              title: 'Fall Armyworm',
            }),
            expect.objectContaining({
              type: 'pest_control',
              title: 'Pest Control Executed',
            }),
            expect.objectContaining({
              type: 'sensor_reading',
              metadata: expect.objectContaining({
                sensorReadings: 42,
              }),
            }),
          ]),
        }),
      })
    );
  });

  it('filters recent system activity by type', async () => {
    const route = getRouteHandler('/activity');
    mockDb.users.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.farms.listActive.mockResolvedValue([{ _id: 'farm-7', name: 'South Plot' }]);
    mockDb.sensorData.countSince.mockResolvedValue(7);
    mockDb.recommendations.list.mockResolvedValue({
      data: [
        {
          _id: 'rec-2',
          type: 'irrigation',
          title: 'Irrigate South Plot',
          priority: 'high',
          status: 'pending',
          created_at: Date.parse('2026-03-14T10:00:00.000Z'),
        },
      ],
      count: 1,
    });
    mockDb.pestDetections.getStats.mockResolvedValue([
      {
        pest_detected: true,
        pest_type: 'maize_streak_virus',
        severity: 'medium',
        created_at: Date.parse('2026-03-14T09:00:00.000Z'),
      },
    ]);
    mockDb.pestControlSchedules.getByFarm.mockResolvedValue([
      {
        _id: 'pcs-2',
        farm_id: 'farm-7',
        detection_id: 'pest-7',
        scheduled_date: '2026-03-14',
        control_method: 'Spot treatment',
        is_executed: false,
        created_at: Date.parse('2026-03-14T11:00:00.000Z'),
      },
    ]);

    const req = {
      query: { hours: '24', limit: '10', type: 'pest_control' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          filters: expect.objectContaining({
            type: 'pest_control',
          }),
          activities: [
            expect.objectContaining({
              type: 'pest_control',
              title: 'Pest Control Scheduled',
            }),
          ],
        }),
      })
    );
  });

  it('exports recent system activity as csv', async () => {
    const route = getRouteHandler('/activity/export');
    mockDb.users.list.mockResolvedValue({
      data: [
        {
          _id: 'user-2',
          first_name: 'Eric',
          last_name: 'Niyonzima',
          role: 'expert',
          created_at: Date.parse('2026-03-14T05:00:00.000Z'),
          is_active: true,
        },
      ],
      count: 1,
    });
    mockDb.farms.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.sensorData.countSince.mockResolvedValue(0);
    mockDb.recommendations.list.mockResolvedValue({ data: [], count: 0 });
    mockDb.pestDetections.getStats.mockResolvedValue([]);

    const req = {
      query: { hours: '24', limit: '20', type: 'user', format: 'csv' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await route(req, res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('system-activity-')
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"user"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('"Eric Niyonzima"'));
  });
});
