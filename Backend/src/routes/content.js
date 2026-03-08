/**
 * Content Routes
 *
 * Public content APIs for dynamic website sections (resources, FAQ, careers).
 * Content is stored in Convex system_config to avoid hardcoded frontend data.
 *
 * @module routes/content
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse } from '../utils/response.js';
import { db } from '../database/convex.js';

const router = Router();

const CONTENT_KEYS = {
  RESOURCES: 'content.resources',
  FAQ: 'content.faq',
  CAREERS: 'content.careers',
  FEATURES: 'content.features',
  PRICING: 'content.pricing',
  ABOUT: 'content.about',
};

const getConfigValue = async (configKey, defaultValue) => {
  const configEntry = await db.systemConfig.getByKey(configKey);
  if (!configEntry) return defaultValue;

  const value = configEntry.config_value;
  if (value === undefined || value === null) return defaultValue;
  return value;
};

const toStringArray = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

/**
 * @route GET /api/v1/content/resources
 * @desc Get dynamic resources content
 * @access Public
 */
router.get('/resources',
  asyncHandler(async (req, res) => {
    const { category } = req.query;
    const payload = await getConfigValue(CONTENT_KEYS.RESOURCES, { items: [], categories: [] });

    const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
    const computedCategories = [...new Set(items.map((item) => item?.category).filter(Boolean))];
    const categories = [
      ...new Set([
        ...toStringArray(payload?.categories),
        ...computedCategories,
      ]),
    ];

    const filteredItems = typeof category === 'string'
      ? items.filter((item) => item?.category === category)
      : items;

    return successResponse(res, { items: filteredItems, categories }, 'Resources content retrieved successfully');
  })
);

/**
 * @route GET /api/v1/content/faq
 * @desc Get dynamic FAQ content
 * @access Public
 */
router.get('/faq',
  asyncHandler(async (req, res) => {
    const payload = await getConfigValue(CONTENT_KEYS.FAQ, { items: [], categories: [] });
    const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
    const computedCategories = [...new Set(items.map((item) => item?.category).filter(Boolean))];
    const categories = [
      ...new Set([
        ...toStringArray(payload?.categories),
        ...computedCategories,
      ]),
    ];

    return successResponse(res, { items, categories }, 'FAQ content retrieved successfully');
  })
);

/**
 * @route GET /api/v1/content/careers
 * @desc Get dynamic careers content
 * @access Public
 */
router.get('/careers',
  asyncHandler(async (req, res) => {
    const payload = await getConfigValue(CONTENT_KEYS.CAREERS, {
      positions: [],
      values: [],
      hero: {},
    });

    const positions = Array.isArray(payload?.positions) ? payload.positions : [];
    const values = Array.isArray(payload?.values) ? payload.values : [];
    const hero = payload?.hero && typeof payload.hero === 'object' ? payload.hero : {};

    return successResponse(res, { positions, values, hero }, 'Careers content retrieved successfully');
  })
);

/**
 * @route GET /api/v1/content/features
 * @desc Get dynamic features page content
 * @access Public
 */
router.get('/features',
  asyncHandler(async (req, res) => {
    const payload = await getConfigValue(CONTENT_KEYS.FEATURES, {
      hero: {},
      cards: [],
      highlights: [],
      integrations: [],
    });

    const hero = payload?.hero && typeof payload.hero === 'object' ? payload.hero : {};
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    const highlights = Array.isArray(payload?.highlights) ? payload.highlights : [];
    const integrations = Array.isArray(payload?.integrations) ? payload.integrations : [];

    return successResponse(res, { hero, cards, highlights, integrations }, 'Features content retrieved successfully');
  })
);

/**
 * @route GET /api/v1/content/pricing
 * @desc Get dynamic pricing page content
 * @access Public
 */
router.get('/pricing',
  asyncHandler(async (req, res) => {
    const payload = await getConfigValue(CONTENT_KEYS.PRICING, {
      hero: {},
      plans: [],
      footnote: '',
    });

    const hero = payload?.hero && typeof payload.hero === 'object' ? payload.hero : {};
    const plans = Array.isArray(payload?.plans) ? payload.plans : [];
    const footnote = typeof payload?.footnote === 'string' ? payload.footnote : '';

    return successResponse(res, { hero, plans, footnote }, 'Pricing content retrieved successfully');
  })
);

/**
 * @route GET /api/v1/content/about
 * @desc Get dynamic about page content
 * @access Public
 */
router.get('/about',
  asyncHandler(async (req, res) => {
    const payload = await getConfigValue(CONTENT_KEYS.ABOUT, {
      hero: {},
      mission: {},
      values: [],
      team: [],
      cta: {},
    });

    const hero = payload?.hero && typeof payload.hero === 'object' ? payload.hero : {};
    const mission = payload?.mission && typeof payload.mission === 'object' ? payload.mission : {};
    const values = Array.isArray(payload?.values) ? payload.values : [];
    const team = Array.isArray(payload?.team) ? payload.team : [];
    const cta = payload?.cta && typeof payload.cta === 'object' ? payload.cta : {};

    return successResponse(res, { hero, mission, values, team, cta }, 'About content retrieved successfully');
  })
);

/**
 * @route POST /api/v1/content/careers/apply
 * @desc Submit lightweight career interest signal
 * @access Public
 */
router.post('/careers/apply',
  asyncHandler(async (req, res) => {
    const { positionId, positionTitle } = req.body || {};

    if (!positionTitle || typeof positionTitle !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'positionTitle is required',
        code: 'VALIDATION_ERROR',
      });
    }

    await db.auditLogs.create({
      action: 'CAREER_INTEREST_SUBMITTED',
      entity_type: 'careers',
      entity_id: positionId ? String(positionId) : undefined,
      new_values: {
        position_title: positionTitle,
      },
      ip_address: req.ip || null,
      user_agent: req.get('user-agent') || null,
      created_at: Date.now(),
    });

    return successResponse(res, {
      submitted: true,
      positionId: positionId ? String(positionId) : null,
      positionTitle,
    }, 'Career interest submitted successfully');
  })
);

/**
 * @route POST /api/v1/content/newsletter/subscribe
 * @desc Subscribe an email to newsletter
 * @access Public
 */
router.post('/newsletter/subscribe',
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'email is required',
        code: 'VALIDATION_ERROR',
      });
    }

    await db.auditLogs.create({
      action: 'NEWSLETTER_SUBSCRIBED',
      entity_type: 'newsletter',
      entity_id: email.toLowerCase(),
      new_values: { email: email.toLowerCase() },
      ip_address: req.ip || null,
      user_agent: req.get('user-agent') || null,
      created_at: Date.now(),
    });

    return successResponse(res, { subscribed: true, email: email.toLowerCase() }, 'Newsletter subscription received');
  })
);

/**
 * @route POST /api/v1/content/consultations
 * @desc Submit consultation request
 * @access Public
 */
router.post('/consultations',
  asyncHandler(async (req, res) => {
    const { name, size, topic, message, language } = req.body || {};

    if (!name || !topic || !message) {
      return res.status(400).json({
        success: false,
        message: 'name, topic, and message are required',
        code: 'VALIDATION_ERROR',
      });
    }

    await db.auditLogs.create({
      action: 'CONSULTATION_REQUEST_SUBMITTED',
      entity_type: 'consultation',
      new_values: {
        name,
        size,
        topic,
        message,
        language,
      },
      ip_address: req.ip || null,
      user_agent: req.get('user-agent') || null,
      created_at: Date.now(),
    });

    return successResponse(res, { submitted: true }, 'Consultation request submitted successfully');
  })
);

export default router;
