import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockVerifyToken = jest.fn();
const mockGetUser = jest.fn();

const mockDb = {
  users: {
    getByClerkId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  auditLogs: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

await jest.unstable_mockModule('@clerk/clerk-sdk-node', () => ({
  verifyToken: mockVerifyToken,
  clerkClient: {
    users: {
      getUser: mockGetUser,
    },
  },
}));

await jest.unstable_mockModule('../src/config/index.js', () => ({
  default: {
    clerk: {
      secretKey: 'test-secret',
    },
    auth: {
      bootstrapAdminEmails: [],
    },
  },
}));

await jest.unstable_mockModule('../src/database/convex.js', () => ({
  db: mockDb,
}));

await jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: mockLogger,
}));

const { authenticate } = await import('../src/middleware/auth.js');

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('auth storage management audit coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes an audit log when Clerk bootstrap creates a stored user profile', async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 'clerk-1',
      email: 'farmer@example.com',
      given_name: 'Ada',
      family_name: 'Lovelace',
      locale: 'rw',
      email_verified: true,
    });
    mockDb.users.getByClerkId.mockResolvedValue(null);
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'farmer@example.com', verification: { status: 'verified' } }],
      phoneNumbers: [{ phoneNumber: '+250788000001' }],
      firstName: 'Ada',
      lastName: 'Lovelace',
      imageUrl: 'https://example.com/avatar.png',
      publicMetadata: {},
      unsafeMetadata: {},
    });
    mockDb.users.create.mockResolvedValue({
      _id: 'user-1',
      clerk_id: 'clerk-1',
      email: 'farmer@example.com',
      phone_number: '+250788000001',
      first_name: 'Ada',
      last_name: 'Lovelace',
      role: 'farmer',
      preferred_language: 'rw',
      profile_image_url: 'https://example.com/avatar.png',
      metadata: { is_verified: true },
      is_active: true,
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-1',
      is_active: true,
    });

    const req = {
      headers: {
        authorization: 'Bearer token-1',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action: 'CREATE_USER',
        entity_type: 'users',
        entity_id: 'user-1',
        new_values: expect.objectContaining({
          email: 'farmer@example.com',
          role: 'farmer',
        }),
      })
    );
  });

  it('writes an audit log when Clerk role sync updates a stored user profile role', async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 'clerk-2',
    });
    mockDb.users.getByClerkId.mockResolvedValue({
      _id: 'user-2',
      clerk_id: 'clerk-2',
      email: 'expert@example.com',
      role: 'farmer',
      is_active: true,
    });
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'expert@example.com', verification: { status: 'verified' } }],
      phoneNumbers: [],
      firstName: 'Grace',
      lastName: 'Hopper',
      imageUrl: null,
      publicMetadata: { role: 'expert' },
      unsafeMetadata: {},
    });
    mockDb.users.update
      .mockResolvedValueOnce({
        _id: 'user-2',
        clerk_id: 'clerk-2',
        email: 'expert@example.com',
        role: 'expert',
        is_active: true,
      })
      .mockResolvedValueOnce({
        _id: 'user-2',
        clerk_id: 'clerk-2',
        email: 'expert@example.com',
        role: 'expert',
        is_active: true,
      });

    const req = {
      headers: {
        authorization: 'Bearer token-2',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-2',
        action: 'UPDATE_USER_ROLE',
        entity_type: 'users',
        entity_id: 'user-2',
        old_values: { role: 'farmer' },
        new_values: { role: 'expert' },
      })
    );
  });

  it('writes an audit log when authentication updates the stored last login timestamp', async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 'clerk-3',
    });
    mockDb.users.getByClerkId.mockResolvedValue({
      _id: 'user-3',
      clerk_id: 'clerk-3',
      email: 'farmer3@example.com',
      role: 'farmer',
      is_active: true,
      last_login_at: 1700000000000,
    });
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'farmer3@example.com', verification: { status: 'verified' } }],
      phoneNumbers: [],
      firstName: 'Katherine',
      lastName: 'Johnson',
      imageUrl: null,
      publicMetadata: { role: 'farmer' },
      unsafeMetadata: {},
    });
    mockDb.users.update.mockResolvedValue({
      _id: 'user-3',
      clerk_id: 'clerk-3',
      email: 'farmer3@example.com',
      role: 'farmer',
      is_active: true,
      last_login_at: 1700000005000,
    });

    const req = {
      headers: {
        authorization: 'Bearer token-3',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockDb.auditLogs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-3',
        action: 'UPDATE_USER_LAST_LOGIN',
        entity_type: 'users',
        entity_id: 'user-3',
        old_values: { last_login_at: 1700000000000 },
        new_values: expect.objectContaining({
          last_login_at: expect.any(Number),
        }),
      })
    );
  });

  it('returns not found when the user disappears before last-login persistence', async () => {
    mockVerifyToken.mockResolvedValue({
      sub: 'clerk-4',
    });
    mockDb.users.getByClerkId.mockResolvedValue({
      _id: 'user-4',
      clerk_id: 'clerk-4',
      email: 'farmer4@example.com',
      role: 'farmer',
      is_active: true,
      last_login_at: 1700000000000,
    });
    mockGetUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'farmer4@example.com', verification: { status: 'verified' } }],
      phoneNumbers: [],
      firstName: 'Dorothy',
      lastName: 'Vaughan',
      imageUrl: null,
      publicMetadata: { role: 'farmer' },
      unsafeMetadata: {},
    });
    mockDb.users.update.mockResolvedValue(null);

    const req = {
      headers: {
        authorization: 'Bearer token-4',
      },
    };
    const res = createRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDb.auditLogs.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_USER_LAST_LOGIN',
        entity_id: 'user-4',
      })
    );
  });
});
