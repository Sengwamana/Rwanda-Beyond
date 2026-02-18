import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db.query("system_config").collect();
  },
});

export const getByKey = query({
  args: { key: v.string() },
  returns: v.any(),
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("system_config")
      .withIndex("by_key", (q) => q.eq("config_key", key))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    config_key: v.string(),
    config_value: v.any(),
    description: v.optional(v.string()),
    updated_by: v.optional(v.id("users")),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("system_config")
      .withIndex("by_key", (q) => q.eq("config_key", args.config_key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        config_value: args.config_value,
        description: args.description ?? existing.description,
        updated_by: args.updated_by,
        updated_at: Date.now(),
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("system_config", {
      config_key: args.config_key,
      config_value: args.config_value,
      description: args.description,
      is_active: true,
      updated_by: args.updated_by,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const healthCheck = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const config = await ctx.db.query("system_config").first();
    return config ? true : false;
  },
});
