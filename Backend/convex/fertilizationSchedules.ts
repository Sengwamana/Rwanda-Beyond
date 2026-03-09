import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    since: v.optional(v.string()),
    isExecuted: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const scheduleQuery =
      typeof args.isExecuted === "boolean"
        ? ctx.db
            .query("fertilization_schedules")
            .withIndex("by_farm_executed_date", (q) => {
              const base = q.eq("farm_id", args.farmId).eq("is_executed", args.isExecuted!);
              if (args.since) {
                return base.gte("scheduled_date", args.since);
              }
              return base;
            })
            .order("desc")
        : ctx.db
            .query("fertilization_schedules")
            .withIndex("by_farm_date", (q) => {
              const base = q.eq("farm_id", args.farmId);
              if (args.since) {
                return base.gte("scheduled_date", args.since);
              }
              return base;
            })
            .order("desc");

    return await scheduleQuery.take(limit);
  },
});

export const getLastExecuted = query({
  args: { farmId: v.id("farms") },
  returns: v.any(),
  handler: async (ctx, { farmId }) => {
    const scheds = await ctx.db
      .query("fertilization_schedules")
      .withIndex("by_farm_executed_date", (q) =>
        q.eq("farm_id", farmId).eq("is_executed", true)
      )
      .order("desc")
      .take(1);
    return scheds[0] ?? null;
  },
});

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("fertilization_schedules", {
      ...data,
      is_executed: data.is_executed ?? false,
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { id: v.id("fertilization_schedules"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("fertilization_schedules") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});

export const getHistory = query({
  args: {
    farmId: v.id("farms"),
    since: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("fertilization_schedules")
      .withIndex("by_farm_date", (q) => {
        const base = q.eq("farm_id", args.farmId);
        if (args.since) {
          return base.gte("scheduled_date", args.since);
        }
        return base;
      })
      .order("desc")
      .take(args.limit ?? 200);
  },
});
