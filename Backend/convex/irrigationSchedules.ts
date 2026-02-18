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
    let schedules = await ctx.db
      .query("irrigation_schedules")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("asc")
      .collect();

    if (typeof args.isExecuted === "boolean") {
      schedules = schedules.filter((s) => s.is_executed === args.isExecuted);
    }
    if (args.afterDate) {
      schedules = schedules.filter((s) => s.scheduled_date >= args.afterDate!);
    }
    if (args.limit) {
      schedules = schedules.slice(0, args.limit);
    }
    return schedules;
  },
});

export const getUpcoming = query({
  args: { farmId: v.id("farms"), afterDate: v.string(), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const schedules = await ctx.db
      .query("irrigation_schedules")
      .withIndex("by_farm_executed", (q) => q.eq("farm_id", args.farmId).eq("is_executed", false))
      .order("asc")
      .collect();
    const filtered = schedules.filter((s) => s.scheduled_date >= args.afterDate);
    return filtered.slice(0, args.limit ?? 7);
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
