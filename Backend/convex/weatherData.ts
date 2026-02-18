import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: { records: v.array(v.any()) },
  returns: v.null(),
  handler: async (ctx, { records }) => {
    for (const record of records) {
      // Check for existing record with same district_id and forecast_date
      if (record.district_id) {
        const existing = await ctx.db
          .query("weather_data")
          .withIndex("by_district_date", (q) =>
            q.eq("district_id", record.district_id).eq("forecast_date", record.forecast_date)
          )
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, { ...record, fetched_at: Date.now() });
          continue;
        }
      }

      await ctx.db.insert("weather_data", {
        ...record,
        fetched_at: record.fetched_at ?? Date.now(),
        created_at: record.created_at ?? Date.now(),
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
    let data = await ctx.db
      .query("weather_data")
      .withIndex("by_district", (q) => q.eq("district_id", args.districtId))
      .order("asc")
      .collect();

    if (args.startDate) data = data.filter((d) => d.forecast_date >= args.startDate!);
    if (args.endDate) data = data.filter((d) => d.forecast_date <= args.endDate!);
    return data;
  },
});

export const deleteOlderThan = mutation({
  args: { date: v.string() },
  returns: v.any(),
  handler: async (ctx, { date }) => {
    const allData = await ctx.db
      .query("weather_data")
      .collect();
    const old = allData.filter((d) => d.forecast_date < date);
    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { count: old.length };
  },
});
