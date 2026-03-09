import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    isExecuted: v.optional(v.boolean()),
    afterDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const scheduleQuery =
      typeof args.isExecuted === "boolean"
        ? ctx.db
            .query("irrigation_schedules")
            .withIndex("by_farm_executed_date", (q) => {
              const base = q.eq("farm_id", args.farmId).eq("is_executed", args.isExecuted!);
              if (args.afterDate) {
                return base.gte("scheduled_date", args.afterDate);
              }
              return base;
            })
            .order("asc")
        : ctx.db
            .query("irrigation_schedules")
            .withIndex("by_farm_date", (q) => {
              const base = q.eq("farm_id", args.farmId);
              if (args.afterDate) {
                return base.gte("scheduled_date", args.afterDate);
              }
              return base;
            })
            .order("asc");

    return await scheduleQuery.take(limit);
  },
});

export const getUpcoming = query({
  args: { farmId: v.id("farms"), afterDate: v.string(), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("irrigation_schedules")
      .withIndex("by_farm_executed_date", (q) =>
        q
          .eq("farm_id", args.farmId)
          .eq("is_executed", false)
          .gte("scheduled_date", args.afterDate)
      )
      .order("asc")
      .take(args.limit ?? 7);
  },
});

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("irrigation_schedules", {
      ...data,
      is_executed: data.is_executed ?? false,
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { id: v.id("irrigation_schedules"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});
