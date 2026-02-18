import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const id = await ctx.db.insert("messages", {
      ...data,
      status: data.status ?? "queued",
      retry_count: data.retry_count ?? 0,
      created_at: data.created_at ?? Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const createBatch = mutation({
  args: { messages: v.array(v.any()) },
  returns: v.any(),
  handler: async (ctx, { messages }) => {
    const results = [];
    for (const msg of messages) {
      const id = await ctx.db.insert("messages", {
        ...msg,
        status: msg.status ?? "queued",
        retry_count: msg.retry_count ?? 0,
        created_at: msg.created_at ?? Date.now(),
      });
      results.push(await ctx.db.get(id));
    }
    return results;
  },
});

export const update = mutation({
  args: { id: v.id("messages"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, updates);
    return await ctx.db.get(id);
  },
});

export const getFailed = query({
  args: { maxRetries: v.optional(v.number()), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const maxRetries = args.maxRetries ?? 3;
    const limit = args.limit ?? 50;

    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .collect();

    return msgs.filter((m) => m.retry_count < maxRetries).slice(0, limit);
  },
});

export const getStats = query({
  args: { since: v.optional(v.number()), channel: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let msgs = await ctx.db.query("messages").collect();
    if (args.since) msgs = msgs.filter((m) => m.created_at >= args.since!);
    if (args.channel) msgs = msgs.filter((m) => m.channel === args.channel);
    return msgs.map((m) => ({
      status: m.status,
      channel: m.channel,
      cost_units: m.cost_units,
      created_at: m.created_at,
    }));
  },
});

export const countSince = query({
  args: { since: v.number() },
  returns: v.any(),
  handler: async (ctx, { since }) => {
    const allMsgs = await ctx.db
      .query("messages")
      .collect();
    const msgs = allMsgs.filter((m) => m.created_at >= since);
    return msgs.length;
  },
});
