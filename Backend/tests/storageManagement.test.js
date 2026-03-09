import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  users: {
    getByClerkId: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
  },
  farms: {
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

await jest.unstable_mockModule('../src/services/sensorService.js', () => ({
  getLatestReadings: jest.fn(),
}));

const {
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  updateUserRole,
} = await import('../src/services/userService.js');

const {
  createFarm,
  updateFarm,
  deleteFarm,
} = await import('../src/services/farmService.js');

describe('data storage and management audit coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes an audit log when creating a user profile', async () => {
    mockDb.users.getByClerkId.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      _id: 'user-1',
      clerk_id: 'clerk-1',
      email: 'farmer@example.com',
      phone_number: '+250788000001',
      first_name: 'Ada',
      last_name: 'Lovelace',
      role: 'farmer',
      preferred_language: 'rw',
      metadata: { notifications: true },
      is_active: true,
    });

    await createUser({
      clerkId: 'clerk-1',
      email: 'farmer@example.com',
      phoneNumber: '+250788000001',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'farmer',
      preferredLanguage: 'rw',
      metadata: { notifications: true },
    });

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_USER',
        entity_type: 'users',
        entity_id: 'user-1',
        new_values: expect.objectContaining({
          email: 'farmer@example.com',
          first_name: 'Ada',
          role: 'farmer',
        }),
      })
    );
  });

  it('still stores a user profile when audit logging fails after create', async () => {
    mockDb.users.getByClerkId.mockResolvedValue(null);
    mockDb.users.create.mockResolvedValue({
      _id: 'user-1',
      clerk_id: 'clerk-1',
      email: 'farmer@example.com',
      role: 'farmer',
    });
    mockDb.auditLogs.create.mockRejectedValue(new Error('audit offline'));

    const result = await createUser({
      clerkId: 'clerk-1',
      email: 'farmer@example.com',
    });

    expect(result).toEqual(expect.objectContaining({
      _id: 'user-1',
      id: 'user-1',
    }));
    expect(mockDb.users.create).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Failed to write user audit log:', 'audit offline');
  });

  it('writes an audit log with old and new values when updating a user profile', async () => {
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone_number: '+250788000001',
      preferred_language: 'rw',
      metadata: { notifications: true },
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      first_name: 'Grace',
      last_name: 'Lovelace',
      phone_number: '+250788000001',
      preferred_language: 'en',
      metadata: { notifications: false },
    });

    await updateUser('user-1', {
      firstName: 'Grace',
      preferredLanguage: 'en',
      metadata: { notifications: false },
    });

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'UPDATE_USER',
      entity_type: 'users',
      entity_id: 'user-1',
      old_values: {
        first_name: 'Ada',
        preferred_language: 'rw',
        metadata: { notifications: true },
      },
      new_values: {
        first_name: 'Grace',
        preferred_language: 'en',
        metadata: { notifications: false },
      },
    });
  });

  it('writes old and new values when deactivating a user profile', async () => {
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      is_active: true,
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      is_active: false,
    });

    await deactivateUser('user-1', 'admin-1');

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith({
      user_id: 'admin-1',
      action: 'DEACTIVATE_USER',
      entity_type: 'users',
      entity_id: 'user-1',
      old_values: { is_active: true },
      new_values: { is_active: false },
    });
  });

  it('writes old and new values when reactivating a user profile', async () => {
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      is_active: false,
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      is_active: true,
    });

    await reactivateUser('user-1', 'admin-1');

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith({
      user_id: 'admin-1',
      action: 'REACTIVATE_USER',
      entity_type: 'users',
      entity_id: 'user-1',
      old_values: { is_active: false },
      new_values: { is_active: true },
    });
  });

  it('fails cleanly when a user profile disappears before role persistence', async () => {
    mockDb.users.getById.mockResolvedValue({
      _id: 'user-1',
      role: 'farmer',
    });
    mockDb.users.update.mockResolvedValue(null);

    await expect(updateUserRole('user-1', 'expert', 'admin-1')).rejects.toMatchObject({
      message: 'User not found',
    });

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('writes an audit log when creating farm information', async () => {
    mockDb.farms.create.mockResolvedValue({
      _id: 'farm-1',
      user_id: 'user-1',
      name: 'North Plot',
      district_id: 'district-1',
      location_name: 'Musanze',
      size_hectares: 2.5,
      soil_type: 'loam',
      crop_variety: 'maize',
      metadata: { irrigation: 'drip' },
    });

    await createFarm('user-1', {
      name: 'North Plot',
      districtId: 'district-1',
      locationName: 'Musanze',
      sizeHectares: 2.5,
      soilType: 'loam',
      cropVariety: 'maize',
      metadata: { irrigation: 'drip' },
    });

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_FARM',
        entity_type: 'farms',
        entity_id: 'farm-1',
        new_values: expect.objectContaining({
          name: 'North Plot',
          district_id: 'district-1',
          soil_type: 'loam',
        }),
      })
    );
  });

  it('still stores farm information when audit logging fails after create', async () => {
    mockDb.farms.create.mockResolvedValue({
      _id: 'farm-1',
      user_id: 'user-1',
      name: 'North Plot',
      district_id: 'district-1',
    });
    mockDb.auditLogs.create.mockRejectedValue(new Error('audit offline'));

    const result = await createFarm('user-1', {
      name: 'North Plot',
      districtId: 'district-1',
    });

    expect(result).toEqual(expect.objectContaining({
      _id: 'farm-1',
      user_id: 'user-1',
      name: 'North Plot',
    }));
    expect(mockDb.farms.create).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Failed to write farm audit log:', 'audit offline');
  });

  it('writes an audit log with old and new values when updating farm information', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      user_id: 'user-1',
      name: 'North Plot',
      district_id: 'district-1',
      location_name: 'Musanze',
      latitude: -1.5,
      longitude: 29.6,
      size_hectares: 2.5,
      soil_type: 'loam',
      current_growth_stage: 'germination',
    });
    mockDb.farms.update.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot Expanded',
      district_id: 'district-1',
      location_name: 'Musanze Sector A',
      latitude: -1.51,
      longitude: 29.61,
      size_hectares: 3,
      soil_type: 'clay',
      current_growth_stage: 'vegetative',
    });

    await updateFarm(
      'farm-1',
      {
        name: 'North Plot Expanded',
        locationName: 'Musanze Sector A',
        latitude: -1.51,
        longitude: 29.61,
        sizeHectares: 3,
        soilType: 'clay',
        currentGrowthStage: 'vegetative',
      },
      'user-1'
    );

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'UPDATE_FARM',
      entity_type: 'farms',
      entity_id: 'farm-1',
      old_values: {
        name: 'North Plot',
        location_name: 'Musanze',
        latitude: -1.5,
        longitude: 29.6,
        size_hectares: 2.5,
        soil_type: 'loam',
        current_growth_stage: 'germination',
      },
      new_values: {
        name: 'North Plot Expanded',
        location_name: 'Musanze Sector A',
        size_hectares: 3,
        soil_type: 'clay',
        current_growth_stage: 'vegetative',
        latitude: -1.51,
        longitude: 29.61,
      },
    });
  });

  it('fails cleanly when a farm disappears before update persistence', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      location_name: 'Musanze',
    });
    mockDb.farms.update.mockResolvedValue(null);

    await expect(
      updateFarm(
        'farm-1',
        {
          name: 'North Plot Expanded',
        },
        'user-1'
      )
    ).rejects.toMatchObject({
      message: 'Farm not found',
    });

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('writes old and new values when soft deleting farm information', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      district_id: 'district-1',
      location_name: 'Musanze',
      latitude: -1.5,
      longitude: 29.6,
      size_hectares: 2.5,
      soil_type: 'loam',
      crop_variety: 'maize',
      current_growth_stage: 'vegetative',
      is_active: true,
    });
    mockDb.farms.softDelete.mockResolvedValue({
      _id: 'farm-1',
      is_active: false,
    });

    await deleteFarm('farm-1', 'user-1');

    expect(mockDb.auditLogs.create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'DELETE_FARM',
      entity_type: 'farms',
      entity_id: 'farm-1',
      old_values: {
        name: 'North Plot',
        district_id: 'district-1',
        location_name: 'Musanze',
        latitude: -1.5,
        longitude: 29.6,
        size_hectares: 2.5,
        soil_type: 'loam',
        crop_variety: 'maize',
        current_growth_stage: 'vegetative',
        is_active: true,
      },
      new_values: { is_active: false },
    });
  });

  it('fails cleanly when a farm disappears before soft delete persistence', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      is_active: true,
    });
    mockDb.farms.softDelete.mockResolvedValue(null);

    await expect(deleteFarm('farm-1', 'user-1')).rejects.toMatchObject({
      message: 'Farm not found',
    });

    expect(mockDb.auditLogs.create).not.toHaveBeenCalled();
  });

  it('accepts the persisted soft delete result shape returned by Convex', async () => {
    mockDb.farms.getById.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      is_active: true,
    });
    mockDb.farms.softDelete.mockResolvedValue({
      _id: 'farm-1',
      name: 'North Plot',
      is_active: false,
      updated_at: 123,
    });

    await expect(deleteFarm('farm-1', 'user-1')).resolves.toBeUndefined();
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_FARM',
        entity_id: 'farm-1',
      })
    );
  });
});
