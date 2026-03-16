import { db } from '../database/convex.js';
import logger from '../utils/logger.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const ASSIGNABLE_ROLES = new Set(['expert', 'admin']);

const resolveUserDistrictId = (user) => {
  if (!user || typeof user !== 'object') return null;

  const metadata = user.metadata && typeof user.metadata === 'object' ? user.metadata : {};

  return (
    user.district_id
    || user.districtId
    || metadata.districtId
    || metadata.district_id
    || metadata.coverageDistrictId
    || null
  );
};

const logFarmIssueAuditEvent = async (entry) => {
  try {
    await db.auditLogs.create(entry);
  } catch (error) {
    logger.warn('Failed to write farm issue audit log:', error?.message || error);
  }
};

const validateAssignedUser = async (userId, farmDistrictId) => {
  if (!userId) return null;

  const user = await db.users.getById(userId);
  if (!user) {
    throw new BadRequestError('Assigned user not found');
  }

  const role = user.role;
  const isActive = user.is_active ?? user.isActive ?? true;

  if (!ASSIGNABLE_ROLES.has(role)) {
    throw new BadRequestError('Farm issues can only be assigned to experts or admins');
  }

  if (!isActive) {
    throw new BadRequestError('Assigned user must be active');
  }

  if (role === 'expert' && farmDistrictId) {
    const expertDistrictId = resolveUserDistrictId(user);

    if (!expertDistrictId) {
      throw new BadRequestError('Assigned expert must have a coverage district configured');
    }

    if (String(expertDistrictId) !== String(farmDistrictId)) {
      throw new BadRequestError('Expert agronomists can only be assigned to farmers in the same district');
    }
  }

  return user;
};

export const createFarmIssue = async (userId, farmId, issueData = {}) => {
  const farm = await db.farms.getById(farmId);
  if (!farm) {
    throw new NotFoundError('Farm not found');
  }

  const created = await db.farmIssues.create({
    farm_id: farmId,
    reported_by: userId,
    title: issueData.title,
    description: issueData.description,
    category: issueData.category || 'general',
    severity: issueData.severity || 'medium',
    status: 'open',
    source_channel: issueData.sourceChannel || 'web',
    location_description: issueData.locationDescription,
    metadata: issueData.metadata || undefined,
  });

  await logFarmIssueAuditEvent({
    user_id: userId,
    action: 'CREATE_FARM_ISSUE',
    entity_type: 'farm_issues',
    entity_id: created?._id,
    new_values: {
      farm_id: farmId,
      title: created?.title,
      category: created?.category,
      severity: created?.severity,
      status: created?.status,
      source_channel: created?.source_channel,
    },
  });

  return db.farmIssues.getById(created._id);
};

export const getFarmIssueById = async (issueId) => {
  const issue = await db.farmIssues.getById(issueId);
  if (!issue) {
    throw new NotFoundError('Farm issue not found');
  }

  return issue;
};

export const getFarmIssues = async (farmId, options = {}) => {
  const result = await db.farmIssues.getByFarm(farmId, options);
  const data = result?.data || [];
  const total = result?.count ?? data.length;

  return {
    data,
    total,
    page: options.page || 1,
    limit: options.limit || 20,
    totalPages: Math.ceil(total / (options.limit || 20)),
  };
};

export const listFarmIssues = async (options = {}) => {
  const result = await db.farmIssues.list(options);
  const data = result?.data || [];
  const total = result?.count ?? data.length;

  return {
    data,
    total,
    page: options.page || 1,
    limit: options.limit || 20,
    totalPages: Math.ceil(total / (options.limit || 20)),
  };
};

export const updateFarmIssue = async (issueId, actorId, updates = {}) => {
  const existing = await db.farmIssues.getById(issueId);
  if (!existing) {
    throw new NotFoundError('Farm issue not found');
  }

  const payload = {};

  if (updates.status) {
    if (!ISSUE_STATUSES.includes(updates.status)) {
      throw new BadRequestError('Invalid farm issue status');
    }
    payload.status = updates.status;
    if (updates.status === 'resolved' || updates.status === 'closed') {
      payload.resolved_at = Date.now();
    }
  }

  if (updates.severity) payload.severity = updates.severity;
  if (updates.assignedTo) {
    const farm = existing.farm_id ? await db.farms.getById(existing.farm_id) : null;
    await validateAssignedUser(updates.assignedTo, farm?.district_id);
    payload.assigned_to = updates.assignedTo;
  }
  if (updates.expertNotes !== undefined) payload.expert_notes = updates.expertNotes;
  if (updates.resolutionNotes !== undefined) payload.resolution_notes = updates.resolutionNotes;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  const updated = await db.farmIssues.update(issueId, payload);

  await logFarmIssueAuditEvent({
    user_id: actorId,
    action: 'UPDATE_FARM_ISSUE',
    entity_type: 'farm_issues',
    entity_id: issueId,
    old_values: {
      status: existing.status,
      severity: existing.severity,
      assigned_to: existing.assigned_to,
      expert_notes: existing.expert_notes,
      resolution_notes: existing.resolution_notes,
      resolved_at: existing.resolved_at,
    },
    new_values: {
      status: updated?.status,
      severity: updated?.severity,
      assigned_to: updated?.assigned_to,
      expert_notes: updated?.expert_notes,
      resolution_notes: updated?.resolution_notes,
      resolved_at: updated?.resolved_at,
    },
  });

  return db.farmIssues.getById(issueId);
};
