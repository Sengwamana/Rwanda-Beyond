import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("farms") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const farm = await ctx.db.get(id);
    if (!farm) return null;

    const user = farm.user_id ? await ctx.db.get(farm.user_id) : null;
    const district = farm.district_id ? await ctx.db.get(farm.district_id) : null;
    const sensors = await ctx.db
      .query("sensors")
      .withIndex("by_farm", (q) => q.eq("farm_id", id))
      .collect();

    return {
      ...farm,
      id: farm._id,
      user: user ? { id: user._id, first_name: user.first_name, last_name: user.last_name, email: user.email, phone_number: user.phone_number } : null,
      district: district ? { id: district._id, name: district.name, province: district.province } : null,
      sensors: sensors.map((s) => ({ id: s._id, device_id: s.device_id, sensor_type: s.sensor_type, status: s.status, last_reading_at: s.last_reading_at })),
    };
  },
});

export const getByUser = query({
  args: {
    userId: v.id("users"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let farms = await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .order("desc")
      .collect();

    if (typeof args.isActive === "boolean") {
      farms = farms.filter((f) => f.is_active === args.isActive);
    }

    const total = farms.length;
    const offset = (page - 1) * limit;
    const paginated = farms.slice(offset, offset + limit);

    // Enrich with district and sensor count
    const enriched = await Promise.all(
      paginated.map(async (f) => {
        const district = f.district_id ? await ctx.db.get(f.district_id) : null;
        const sensorCount = (await ctx.db.query("sensors").withIndex("by_farm", (q) => q.eq("farm_id", f._id)).collect()).length;
        return {
          ...f,
          id: f._id,
          district: district ? { id: district._id, name: district.name, province: district.province } : null,
          sensors: [{ count: sensorCount }],
        };
      })
    );

    return { data: enriched, count: total };
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    districtId: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    search: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let farms = await ctx.db.query("farms").order("desc").collect();

    if (args.userId) farms = farms.filter((f) => f.user_id === args.userId);
    if (args.districtId) farms = farms.filter((f) => f.district_id === args.districtId);
    if (typeof args.isActive === "boolean") farms = farms.filter((f) => f.is_active === args.isActive);
    if (args.search) {
      const s = args.search.toLowerCase();
      farms = farms.filter((f) => f.name.toLowerCase().includes(s) || f.location_name?.toLowerCase().includes(s));
    }

    const total = farms.length;
    const offset = (page - 1) * limit;
    const paginated = farms.slice(offset, offset + limit);

    const enriched = await Promise.all(
      paginated.map(async (f) => {
        const user = await ctx.db.get(f.user_id);
        const district = f.district_id ? await ctx.db.get(f.district_id) : null;
        return {
          ...f,
          id: f._id,
          user: user ? { id: user._id, first_name: user.first_name, last_name: user.last_name } : null,
          district: district ? { id: district._id, name: district.name, province: district.province } : null,
        };
      })
    );

    return { data: enriched, count: total };
  },
});

export const listActive = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db
      .query("farms")
      .withIndex("by_active", (q) => q.eq("is_active", true))
      .collect();
  },
});

export const getUserId = query({
  args: { farmId: v.id("farms") },
  returns: v.any(),
  handler: async (ctx, { farmId }) => {
    const farm = await ctx.db.get(farmId);
    return farm ? { user_id: farm.user_id } : null;
  },
});

export const create = mutation({
  args: {
    user_id: v.id("users"),
    name: v.string(),
    district_id: v.optional(v.id("districts")),
    location_name: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    size_hectares: v.optional(v.number()),
    soil_type: v.optional(v.string()),
    crop_variety: v.optional(v.string()),
    planting_date: v.optional(v.string()),
    expected_harvest_date: v.optional(v.string()),
    current_growth_stage: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("farms", {
      ...args,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    const farm = await ctx.db.get(id);
    const district = farm?.district_id ? await ctx.db.get(farm.district_id) : null;
    return {
      ...farm,
      id,
      district: district ? { id: district._id, name: district.name, province: district.province } : null,
    };
  },
});

export const update = mutation({
  args: { id: v.id("farms"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    const farm = await ctx.db.get(id);
    const district = farm?.district_id ? await ctx.db.get(farm.district_id) : null;
    return {
      ...farm,
      id,
      district: district ? { id: district._id, name: district.name, province: district.province } : null,
    };
  },
});

export const softDelete = mutation({
  args: { id: v.id("farms") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { is_active: false, updated_at: Date.now() });
    return null;
  },
});

export const getStats = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const farms = await ctx.db.query("farms").collect();
    return farms.map((f) => ({
      is_active: f.is_active,
      size_hectares: f.size_hectares,
      current_growth_stage: f.current_growth_stage,
      district_id: f.district_id,
    }));
  },
});
