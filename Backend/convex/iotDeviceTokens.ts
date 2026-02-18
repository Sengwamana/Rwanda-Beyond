import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    device_id: v.string(),
    token_hash: v.string(),
    expires_at: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("iot_device_tokens", {
      device_id: args.device_id,
      token_hash: args.token_hash,
      is_active: true,
      expires_at: args.expires_at,
      created_at: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const verify = query({
  args: { deviceId: v.string(), tokenHash: v.string(), now: v.number() },
  returns: v.any(),
  handler: async (ctx, { deviceId, tokenHash, now }) => {
    const tokens = await ctx.db
      .query("iot_device_tokens")
      .withIndex("by_device_active", (q) => q.eq("device_id", deviceId).eq("is_active", true))
      .collect();

    return tokens.find(
      (t) => t.token_hash === tokenHash && (!t.expires_at || t.expires_at > now)
    ) ?? null;
  },
});

export const updateLastUsed = mutation({
  args: { id: v.id("iot_device_tokens") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { last_used_at: Date.now() });
    return null;
  },
});

export const revoke = mutation({
  args: { deviceId: v.string(), tokenHash: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { deviceId, tokenHash }) => {
    const tokens = await ctx.db
      .query("iot_device_tokens")
      .withIndex("by_device", (q) => q.eq("device_id", deviceId))
      .collect();

    for (const t of tokens) {
      if (!tokenHash || t.token_hash === tokenHash) {
        await ctx.db.patch(t._id, { is_active: false });
      }
    }
    return null;
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    deviceId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let tokens = await ctx.db.query("iot_device_tokens").order("desc").collect();

    if (typeof args.isActive === "boolean") tokens = tokens.filter((t) => t.is_active === args.isActive);
    if (args.deviceId) tokens = tokens.filter((t) => t.device_id === args.deviceId);

    const total = tokens.length;
    const offset = (page - 1) * limit;
    return { data: tokens.slice(offset, offset + limit), count: total };
  },
});
