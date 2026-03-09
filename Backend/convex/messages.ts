import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const messageChannel = v.union(
  v.literal("sms"),
  v.literal("ussd"),
  v.literal("push"),
  v.literal("email")
);

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
    const defaultCreatedAt = Date.now();
    const ids = [];
    for (const msg of messages) {
      const id = await ctx.db.insert("messages", {
        ...msg,
        status: msg.status ?? "queued",
        retry_count: msg.retry_count ?? 0,
        created_at: msg.created_at ?? defaultCreatedAt,
      });
      ids.push(id);
    }
    return {
      count: ids.length,
      ids,
    };
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
    const results = [];
    const failedMessages = ctx.db
      .query("messages")
      .withIndex("by_status_created", (q) => q.eq("status", "failed"))
      .order("desc");

    for await (const message of failedMessages) {
      if ((message.retry_count ?? 0) >= maxRetries) {
        continue;
      }

      results.push(message);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  },
});

export const getQueued = query({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const results = [];
    const queuedMessages = ctx.db
      .query("messages")
      .withIndex("by_status_created", (q) => q.eq("status", "queued"))
      .order("asc");

    for await (const message of queuedMessages) {
      results.push(message);
      if (results.length >= limit) {
        break;
      }
    }

    return results;
  },
});

export const getStats = query({
  args: {
    userId: v.optional(v.id("users")),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    channel: v.optional(messageChannel),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;
    const rows = [];

    const baseQuery = args.userId
      ? ctx.db
          .query("messages")
          .withIndex("by_user_created", (q) => {
            const base = q.eq("user_id", args.userId!);
            if (args.since) {
              return base.gte("created_at", args.since);
            }
            return base;
          })
          .order("desc")
      : args.channel
        ? ctx.db
            .query("messages")
            .withIndex("by_channel_created", (q) => {
              const base = q.eq("channel", args.channel!);
              if (args.since) {
                return base.gte("created_at", args.since);
              }
              return base;
            })
            .order("desc")
        : ctx.db
            .query("messages")
            .withIndex("by_created", (q) => {
              if (args.since) {
                return q.gte("created_at", args.since);
              }
              return q;
            })
            .order("desc");

    for await (const message of baseQuery) {
      if (args.until && message.created_at > args.until) {
        continue;
      }
      if (args.channel && message.channel !== args.channel) {
        continue;
      }

      rows.push({
        status: message.status,
        channel: message.channel,
        cost_units: message.cost_units,
        created_at: message.created_at,
      });

      if (rows.length >= limit) {
        break;
      }
    }

    return rows;
  },
});

export const countSince = query({
  args: { since: v.number() },
  returns: v.any(),
  handler: async (ctx, { since }) => {
    let count = 0;
    const messages = ctx.db
      .query("messages")
      .withIndex("by_created", (q) => q.gte("created_at", since))
      .order("desc");

    for await (const _message of messages) {
      count += 1;
    }

    return count;
  },
});
