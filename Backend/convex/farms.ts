import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const asUser = (value: any) => value as {
  _id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
} | null;

const asDistrict = (value: any) => value as {
  _id: string;
  name: string;
  province: string;
} | null;

export const getById = query({
  args: { id: v.id("farms") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const farm = await ctx.db.get(id);
    if (!farm) return null;

    const user = farm.user_id ? asUser(await ctx.db.get(farm.user_id)) : null;
    const district = farm.district_id ? asDistrict(await ctx.db.get(farm.district_id)) : null;
    const sensors = [];
    const sensorRows = ctx.db
      .query("sensors")
      .withIndex("by_farm_created", (q) => q.eq("farm_id", id))
      .order("desc");

    for await (const sensor of sensorRows) {
      sensors.push(sensor);
    }

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
    const offset = (page - 1) * limit;
    const paginated = [];
    let total = 0;

    const farmQuery =
      typeof args.isActive === "boolean"
        ? ctx.db
            .query("farms")
            .withIndex("by_user_active", (q) =>
              q.eq("user_id", args.userId).eq("is_active", args.isActive!)
            )
            .order("desc")
        : ctx.db
            .query("farms")
            .withIndex("by_user_created", (q) => q.eq("user_id", args.userId))
            .order("desc");

    for await (const farm of farmQuery) {
      if (typeof args.isActive === "boolean" && farm.is_active !== args.isActive) {
        continue;
      }

      if (total >= offset && paginated.length < limit) {
        paginated.push(farm);
      }

      total += 1;
    }

    // Enrich with district and sensor count
    const enriched = await Promise.all(
      paginated.map(async (f) => {
        const district = f.district_id ? asDistrict(await ctx.db.get(f.district_id)) : null;
        let sensorCount = 0;
        const sensorRows = ctx.db
          .query("sensors")
          .withIndex("by_farm_created", (q) => q.eq("farm_id", f._id))
          .order("desc");

        for await (const _sensor of sensorRows) {
          sensorCount += 1;
        }

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
    since: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;
    const paginated = [];
    let total = 0;
    const searchTerm = args.search?.toLowerCase();

    const baseQuery =
      args.userId
        ? ctx.db
            .query("farms")
            .withIndex("by_user_created", (q) => {
              const base = q.eq("user_id", args.userId as any);
              if (args.since) {
                return base.gte("created_at", args.since);
              }
              return base;
            })
            .order("desc")
        : args.districtId
          ? ctx.db
              .query("farms")
              .withIndex("by_district_created", (q) => {
                const base = q.eq("district_id", args.districtId as any);
                if (args.since) {
                  return base.gte("created_at", args.since);
                }
                return base;
              })
              .order("desc")
          : typeof args.isActive === "boolean"
            ? ctx.db
                .query("farms")
                .withIndex("by_active_created", (q) => {
                  const base = q.eq("is_active", args.isActive!);
                  if (args.since) {
                    return base.gte("created_at", args.since);
                  }
                  return base;
                })
                .order("desc")
            : ctx.db
                .query("farms")
                .withIndex("by_created", (q) => {
                  if (args.since) {
                    return q.gte("created_at", args.since);
                  }
                  return q;
                })
                .order("desc");

    for await (const farm of baseQuery) {
      if (args.userId && String(farm.user_id) !== String(args.userId)) {
        continue;
      }
      if (args.districtId && String(farm.district_id) !== String(args.districtId)) {
        continue;
      }
      if (typeof args.isActive === "boolean" && farm.is_active !== args.isActive) {
        continue;
      }
      if (searchTerm) {
        const matchesSearch =
          farm.name.toLowerCase().includes(searchTerm) ||
          farm.location_name?.toLowerCase().includes(searchTerm);
        if (!matchesSearch) {
          continue;
        }
      }

      if (total >= offset && paginated.length < limit) {
        paginated.push(farm);
      }

      total += 1;
    }

    const enriched = await Promise.all(
      paginated.map(async (f) => {
        const user = asUser(await ctx.db.get(f.user_id));
        const district = f.district_id ? asDistrict(await ctx.db.get(f.district_id)) : null;
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
    const farms = [];
    const rows = ctx.db
      .query("farms")
      .withIndex("by_active_created", (q) => q.eq("is_active", true))
      .order("desc");

    for await (const farm of rows) {
      farms.push(farm);
    }

    return farms;
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
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id);
    if (!existing) {
      return null;
    }

    await ctx.db.patch(id, { is_active: false, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const getStats = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const stats = [];
    const rows = ctx.db.query("farms").withIndex("by_created").order("desc");
    for await (const farm of rows) {
      stats.push({
        is_active: farm.is_active,
        size_hectares: farm.size_hectares,
        current_growth_stage: farm.current_growth_stage,
        district_id: farm.district_id,
      });
    }
    return stats;
  },
});
