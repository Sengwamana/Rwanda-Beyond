import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getLatestBySensor = query({
  args: { sensorId: v.id("sensors") },
  returns: v.any(),
  handler: async (ctx, { sensorId }) => {
    return await ctx.db
      .query("sensor_data")
      .withIndex("by_sensor_timestamp", (q) => q.eq("sensor_id", sensorId))
      .order("desc")
      .first();
  },
});

export const getLatestByFarm = query({
  args: { farmId: v.id("farms"), validOnly: v.optional(v.boolean()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("sensor_data")
      .withIndex("by_farm_timestamp", (q) => q.eq("farm_id", args.farmId))
      .order("desc");
    const results = await q.collect();
    const filtered = args.validOnly !== false ? results.filter((r) => r.is_valid) : results;
    return filtered[0] ?? null;
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    validOnly: v.optional(v.boolean()),
    sensorId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 50;

    let data = await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_timestamp", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();

    if (args.startDate) data = data.filter((d) => d.reading_timestamp >= args.startDate!);
    if (args.endDate) data = data.filter((d) => d.reading_timestamp <= args.endDate!);
    if (args.validOnly !== false) data = data.filter((d) => d.is_valid);
    if (args.sensorId) data = data.filter((d) => d.sensor_id === args.sensorId);

    const total = data.length;
    const offset = (page - 1) * limit;
    const paginated = data.slice(offset, offset + limit);

    return { data: paginated, count: total };
  },
});

export const getLatestReadings = query({
  args: { farmId: v.id("farms"), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lim = args.limit ?? 1;
    const data = await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_timestamp", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();
    return data.filter((d) => d.is_valid).slice(0, lim);
  },
});

export const getDailyAggregates = query({
  args: {
    farmId: v.id("farms"),
    startDate: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let data = await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_timestamp", (q) => q.eq("farm_id", args.farmId))
      .order("asc")
      .collect();

    data = data.filter((d) => d.is_valid);
    if (args.startDate) data = data.filter((d) => d.reading_timestamp >= args.startDate!);

    // Group by day
    const groups: Record<string, typeof data> = {};
    for (const d of data) {
      const day = new Date(d.reading_timestamp).toISOString().split("T")[0];
      (groups[day] ??= []).push(d);
    }

    return Object.entries(groups).map(([date, readings]) => {
      const avg = (fn: (r: any) => number | undefined | null) => {
        const vals = readings.map(fn).filter((v): v is number => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const minMax = (fn: (r: any) => number | undefined | null) => {
        const vals = readings.map(fn).filter((v): v is number => v != null);
        return { min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
      };
      const sm = minMax((r) => r.soil_moisture);
      return {
        farm_id: args.farmId,
        reading_date: date,
        avg_soil_moisture: avg((r) => r.soil_moisture),
        min_soil_moisture: sm.min,
        max_soil_moisture: sm.max,
        avg_temperature: avg((r) => r.air_temperature),
        avg_humidity: avg((r) => r.humidity),
        avg_nitrogen: avg((r) => r.nitrogen),
        avg_phosphorus: avg((r) => r.phosphorus),
        avg_potassium: avg((r) => r.potassium),
        reading_count: readings.length,
      };
    });
  },
});

export const insertBatch = mutation({
  args: { records: v.array(v.any()) },
  returns: v.any(),
  handler: async (ctx, { records }) => {
    const ids = [];
    for (const record of records) {
      const id = await ctx.db.insert("sensor_data", {
        ...record,
        is_valid: record.is_valid ?? true,
        created_at: record.created_at ?? Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

export const deleteOlderThan = mutation({
  args: { timestamp: v.number() },
  returns: v.any(),
  handler: async (ctx, { timestamp }) => {
    const allData = await ctx.db
      .query("sensor_data")
      .collect();
    const old = allData.filter((d) => d.reading_timestamp < timestamp);
    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { count: old.length };
  },
});

export const countSince = query({
  args: { since: v.number() },
  returns: v.any(),
  handler: async (ctx, { since }) => {
    const allData = await ctx.db
      .query("sensor_data")
      .collect();
    const data = allData.filter((d) => d.reading_timestamp >= since);
    return data.length;
  },
});

export const getLatestOne = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db
      .query("sensor_data")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
  },
});
