import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: { records: v.array(v.any()) },
  returns: v.null(),
  handler: async (ctx, { records }) => {
    const fetchedAt = Date.now();
    for (const record of records) {
      let existing = null;

      if (record.district_id) {
        if (record.forecast_time) {
          existing = await ctx.db
            .query("weather_data")
            .withIndex("by_district_date_time", (q) =>
              q
                .eq("district_id", record.district_id)
                .eq("forecast_date", record.forecast_date)
                .eq("forecast_time", record.forecast_time)
            )
            .unique();
        } else {
          const sameDayRecords = ctx.db
            .query("weather_data")
            .withIndex("by_district_date", (q) =>
              q.eq("district_id", record.district_id).eq("forecast_date", record.forecast_date)
            );

          for await (const entry of sameDayRecords) {
            if (!entry.forecast_time) {
              existing = entry;
              break;
            }
          }
        }
      }

      if (existing) {
        await ctx.db.patch(existing._id, { ...record, fetched_at: fetchedAt });
        continue;
      }

      await ctx.db.insert("weather_data", {
        ...record,
        fetched_at: record.fetched_at ?? fetchedAt,
        created_at: record.created_at ?? fetchedAt,
      });
    }
    return null;
  },
});

export const getByDistrict = query({
  args: {
    districtId: v.id("districts"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const data = [];
    const weatherRows = ctx.db
      .query("weather_data")
      .withIndex("by_district_date", (q) => {
        const base = q.eq("district_id", args.districtId);
        if (args.startDate) {
          return base.gte("forecast_date", args.startDate);
        }
        return base;
      })
      .order("asc");

    for await (const row of weatherRows) {
      if (args.endDate && row.forecast_date > args.endDate) {
        break;
      }
      data.push(row);
    }
    return data;
  },
});

export const deleteOlderThan = mutation({
  args: { date: v.string() },
  returns: v.any(),
  handler: async (ctx, { date }) => {
    const old = [];
    const oldWeatherRows = ctx.db
      .query("weather_data")
      .withIndex("by_date", (q) => q.lt("forecast_date", date))
      .order("asc");

    for await (const row of oldWeatherRows) {
      old.push(row);
    }

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { count: old.length };
  },
});
