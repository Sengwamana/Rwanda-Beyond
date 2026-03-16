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

export const getById = query({
  args: { id: v.id("messages") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    channel: v.optional(messageChannel),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;
    const rows = [];
    let unreadCount = 0;

    const messages = ctx.db
      .query("messages")
      .withIndex("by_user_created", (q) => q.eq("user_id", args.userId))
      .order("desc");

    for await (const message of messages) {
      const effectiveStatus = message.read_at ? "read" : message.status;

      if (!message.read_at) {
        unreadCount += 1;
      }

      if (args.channel && message.channel !== args.channel) {
        continue;
      }

      if (args.unreadOnly && message.read_at) {
        continue;
      }

      if (args.status && effectiveStatus !== args.status) {
        continue;
      }

      rows.push({
        ...message,
        status: effectiveStatus,
      });
    }

    return {
      data: rows.slice(offset, offset + limit),
      count: rows.length,
      unreadCount,
      page,
      limit,
    };
  },
});

export const markRead = mutation({
  args: {
    id: v.id("messages"),
    userId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, { id, userId }) => {
    const message = await ctx.db.get(id);
    if (!message || message.user_id !== userId) {
      return null;
    }

    if (!message.read_at) {
      await ctx.db.patch(id, {
        read_at: Date.now(),
      });
    }

    const updated = await ctx.db.get(id);
    return updated
      ? {
          ...updated,
          status: updated.read_at ? "read" : updated.status,
        }
      : null;
  },
});

export const markAllRead = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.any(),
  handler: async (ctx, { userId }) => {
    let updatedCount = 0;
    const now = Date.now();

    const messages = ctx.db
      .query("messages")
      .withIndex("by_user_created", (q) => q.eq("user_id", userId))
      .order("desc");

    for await (const message of messages) {
      if (message.read_at) {
        continue;
      }

      await ctx.db.patch(message._id, {
        read_at: now,
      });
      updatedCount += 1;
    }

    return { updatedCount };
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
