import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    since: v.optional(v.string()),
    isExecuted: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let schedules = await ctx.db
      .query("fertilization_schedules")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();

    if (args.since) schedules = schedules.filter((s) => s.scheduled_date >= args.since!);
    if (typeof args.isExecuted === "boolean") schedules = schedules.filter((s) => s.is_executed === args.isExecuted);
    return schedules;
  },
});

export const getLastExecuted = query({
  args: { farmId: v.id("farms") },
  returns: v.any(),
  handler: async (ctx, { farmId }) => {
    const scheds = await ctx.db
      .query("fertilization_schedules")
      .withIndex("by_farm", (q) => q.eq("farm_id", farmId))
      .order("desc")
      .collect();
    return scheds.find((s) => s.is_executed) ?? null;
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

export const getHistory = query({
  args: { farmId: v.id("farms"), since: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let scheds = await ctx.db
      .query("fertilization_schedules")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();
    if (args.since) scheds = scheds.filter((s) => s.scheduled_date >= args.since!);
    return scheds;
  },
});
