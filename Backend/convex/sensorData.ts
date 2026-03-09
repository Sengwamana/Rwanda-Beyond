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
    if (args.validOnly !== false) {
      return await ctx.db
        .query("sensor_data")
        .withIndex("by_farm_valid_timestamp", (q) =>
          q.eq("farm_id", args.farmId).eq("is_valid", true)
        )
        .order("desc")
        .first();
    }

    return await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_timestamp", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .first();
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
    sensorId: v.optional(v.id("sensors")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 50;
    const offset = (page - 1) * limit;
    const sensorId = args.sensorId;

    const query =
      sensorId
        ? ctx.db
            .query("sensor_data")
            .withIndex("by_farm_sensor_timestamp", (q) => {
              const base = q.eq("farm_id", args.farmId).eq("sensor_id", sensorId);
              if (args.startDate !== undefined && args.endDate !== undefined) {
                return base.gte("reading_timestamp", args.startDate).lte("reading_timestamp", args.endDate);
              }
              if (args.startDate !== undefined) {
                return base.gte("reading_timestamp", args.startDate);
              }
              if (args.endDate !== undefined) {
                return base.lte("reading_timestamp", args.endDate);
              }
              return base;
            })
            .order("desc")
        : args.validOnly !== false
          ? ctx.db
              .query("sensor_data")
              .withIndex("by_farm_valid_timestamp", (q) => {
                const base = q.eq("farm_id", args.farmId).eq("is_valid", true);
                if (args.startDate !== undefined && args.endDate !== undefined) {
                  return base.gte("reading_timestamp", args.startDate).lte("reading_timestamp", args.endDate);
                }
                if (args.startDate !== undefined) {
                  return base.gte("reading_timestamp", args.startDate);
                }
                if (args.endDate !== undefined) {
                  return base.lte("reading_timestamp", args.endDate);
                }
                return base;
              })
              .order("desc")
          : ctx.db
              .query("sensor_data")
              .withIndex("by_farm_timestamp", (q) => {
                const base = q.eq("farm_id", args.farmId);
                if (args.startDate !== undefined && args.endDate !== undefined) {
                  return base.gte("reading_timestamp", args.startDate).lte("reading_timestamp", args.endDate);
                }
                if (args.startDate !== undefined) {
                  return base.gte("reading_timestamp", args.startDate);
                }
                if (args.endDate !== undefined) {
                  return base.lte("reading_timestamp", args.endDate);
                }
                return base;
              })
              .order("desc");

    const paginated = [];
    let count = 0;

    for await (const row of query) {
      if (args.validOnly !== false && row.is_valid !== true) {
        continue;
      }

      if (count >= offset && paginated.length < limit) {
        paginated.push(row);
      }

      count += 1;
    }

    return { data: paginated, count };
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    validOnly: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 50;
    const offset = (page - 1) * limit;

    const query =
      args.validOnly === true
        ? ctx.db
            .query("sensor_data")
            .withIndex("by_valid", (q) => q.eq("is_valid", true))
            .order("desc")
        : ctx.db
            .query("sensor_data")
            .withIndex("by_timestamp", (q) => {
              if (args.since !== undefined && args.until !== undefined) {
                return q.gte("reading_timestamp", args.since).lte("reading_timestamp", args.until);
              }
              if (args.since !== undefined) {
                return q.gte("reading_timestamp", args.since);
              }
              if (args.until !== undefined) {
                return q.lte("reading_timestamp", args.until);
              }
              return q;
            })
            .order("desc");

    const data = [];
    let count = 0;

    for await (const row of query) {
      if (args.validOnly === true && row.is_valid !== true) {
        continue;
      }

      if (args.since !== undefined && row.reading_timestamp < args.since) {
        continue;
      }
      if (args.until !== undefined && row.reading_timestamp > args.until) {
        continue;
      }

      if (count >= offset && data.length < limit) {
        data.push(row);
      }

      count += 1;
    }

    return { data, count };
  },
});

export const getLatestReadings = query({
  args: { farmId: v.id("farms"), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const lim = args.limit ?? 1;
    return await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_valid_timestamp", (q) =>
        q.eq("farm_id", args.farmId).eq("is_valid", true)
      )
      .order("desc")
      .take(lim);
  },
});

export const getDailyAggregates = query({
  args: {
    farmId: v.id("farms"),
    startDate: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const data = await ctx.db
      .query("sensor_data")
      .withIndex("by_farm_valid_timestamp", (q) => {
        const base = q.eq("farm_id", args.farmId).eq("is_valid", true);
        if (args.startDate !== undefined) {
          return base.gte("reading_timestamp", args.startDate);
        }
        return base;
      })
      .order("asc")
      .collect();

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
        avg_soil_temperature: avg((r) => r.soil_temperature),
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
    if (records.length === 0) {
      return [];
    }

    const createdAt = Date.now();
    const ids = [];
    for (const record of records) {
      const id = await ctx.db.insert("sensor_data", {
        ...record,
        is_valid: record.is_valid ?? true,
        created_at: record.created_at ?? createdAt,
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
    const old = await ctx.db
      .query("sensor_data")
      .withIndex("by_timestamp", (q) => q.lt("reading_timestamp", timestamp))
      .collect();
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
    const data = await ctx.db
      .query("sensor_data")
      .withIndex("by_timestamp", (q) => q.gte("reading_timestamp", since))
      .collect();
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
