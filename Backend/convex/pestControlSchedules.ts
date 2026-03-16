import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("pest_control_schedules") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    detectionId: v.optional(v.id("pest_detections")),
    isExecuted: v.optional(v.boolean()),
    since: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.detectionId) {
      let schedules = await ctx.db
        .query("pest_control_schedules")
        .withIndex("by_farm_detection", (q) =>
          q.eq("farm_id", args.farmId).eq("detection_id", args.detectionId!)
        )
        .order("desc")
        .take(limit);

      if (typeof args.isExecuted === "boolean") {
        schedules = schedules.filter((item) => item.is_executed === args.isExecuted);
      }

      if (args.since) {
        schedules = schedules.filter((item) => item.scheduled_date >= args.since!);
      }

      return schedules;
    }

    const scheduleQuery =
      typeof args.isExecuted === "boolean"
        ? ctx.db
            .query("pest_control_schedules")
            .withIndex("by_farm_executed_date", (q) => {
              const base = q.eq("farm_id", args.farmId).eq("is_executed", args.isExecuted!);
              if (args.since) {
                return base.gte("scheduled_date", args.since);
              }
              return base;
            })
            .order("desc")
        : ctx.db
            .query("pest_control_schedules")
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

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("pest_control_schedules", {
      ...data,
      is_executed: data.is_executed ?? false,
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { id: v.id("pest_control_schedules"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("pest_control_schedules") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});
