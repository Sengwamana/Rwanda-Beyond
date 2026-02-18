import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db
      .query("districts")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("districts") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getByName = query({
  args: { name: v.string() },
  returns: v.any(),
  handler: async (ctx, { name }) => {
    return await ctx.db
      .query("districts")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
  },
});

export const listWithCoordinates = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db
      .query("districts")
      .collect();
  },
});

export const seed = mutation({
  args: { districts: v.array(v.object({ name: v.string(), province: v.string() })) },
  returns: v.null(),
  handler: async (ctx, { districts }) => {
    for (const d of districts) {
      const existing = await ctx.db
        .query("districts")
        .withIndex("by_name", (q) => q.eq("name", d.name))
        .unique();
      if (!existing) {
        await ctx.db.insert("districts", {
          name: d.name,
          province: d.province,
          created_at: Date.now(),
        });
      }
    }
    return null;
  },
});
