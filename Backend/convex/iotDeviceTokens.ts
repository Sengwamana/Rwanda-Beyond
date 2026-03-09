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
    const token = await ctx.db
      .query("iot_device_tokens")
      .withIndex("by_device_active_hash", (q) =>
        q.eq("device_id", deviceId).eq("is_active", true).eq("token_hash", tokenHash)
      )
      .unique();

    if (!token || (token.expires_at && token.expires_at <= now)) {
      return null;
    }

    return token;
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
    if (tokenHash) {
      const token = await ctx.db
        .query("iot_device_tokens")
        .withIndex("by_device_active_hash", (q) =>
          q.eq("device_id", deviceId).eq("is_active", true).eq("token_hash", tokenHash)
        )
        .unique();

      if (token) {
        await ctx.db.patch(token._id, { is_active: false });
      }

      return null;
    }

    const tokens = await ctx.db
      .query("iot_device_tokens")
      .withIndex("by_device_active", (q) =>
        q.eq("device_id", deviceId).eq("is_active", true)
      )
      .collect();

    for (const t of tokens) {
      await ctx.db.patch(t._id, { is_active: false });
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
    const offset = (page - 1) * limit;

    const tokenQuery =
      args.deviceId && typeof args.isActive === "boolean"
        ? ctx.db
            .query("iot_device_tokens")
            .withIndex("by_device_active_created", (q) =>
              q.eq("device_id", args.deviceId!).eq("is_active", args.isActive!)
            )
            .order("desc")
        : args.deviceId
          ? ctx.db
              .query("iot_device_tokens")
              .withIndex("by_device_created", (q) =>
                q.eq("device_id", args.deviceId!)
              )
              .order("desc")
          : typeof args.isActive === "boolean"
            ? ctx.db
                .query("iot_device_tokens")
                .withIndex("by_active_created", (q) =>
                  q.eq("is_active", args.isActive!)
                )
                .order("desc")
            : ctx.db
                .query("iot_device_tokens")
                .withIndex("by_created")
                .order("desc");

    const data = [];
    let count = 0;

    for await (const token of tokenQuery) {
      if (count >= offset && data.length < limit) {
        data.push(token);
      }

      count += 1;
    }

    return { data, count };
  },
});
