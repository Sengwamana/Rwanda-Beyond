import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { data: v.any() },
  returns: v.null(),
  handler: async (ctx, { data }) => {
    const payload =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (data as any).data &&
      typeof (data as any).data === "object" &&
      !(data as any).action
        ? (data as any).data
        : data;

    await ctx.db.insert("audit_logs", {
      ...payload,
      created_at: payload.created_at ?? Date.now(),
    });
    return null;
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    entityType: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;
    const paginated = [];
    let total = 0;

    const baseQuery = args.action
      ? ctx.db
          .query("audit_logs")
          .withIndex("by_action_created", (q) => {
            const base = q.eq("action", args.action!);
            if (args.since !== undefined && args.until !== undefined) {
              return base.gte("created_at", args.since).lte("created_at", args.until);
            }
            if (args.since !== undefined) {
              return base.gte("created_at", args.since);
            }
            if (args.until !== undefined) {
              return base.lte("created_at", args.until);
            }
            return base;
          })
          .order("desc")
      : args.userId
        ? ctx.db
            .query("audit_logs")
            .withIndex("by_user_created", (q) => {
              const base = q.eq("user_id", args.userId!);
              if (args.since !== undefined && args.until !== undefined) {
                return base.gte("created_at", args.since).lte("created_at", args.until);
              }
              if (args.since !== undefined) {
                return base.gte("created_at", args.since);
              }
              if (args.until !== undefined) {
                return base.lte("created_at", args.until);
              }
              return base;
            })
            .order("desc")
        : args.entityType
          ? ctx.db
              .query("audit_logs")
              .withIndex("by_entity_created", (q) => {
                const base = q.eq("entity_type", args.entityType!);
                if (args.since !== undefined && args.until !== undefined) {
                  return base.gte("created_at", args.since).lte("created_at", args.until);
                }
                if (args.since !== undefined) {
                  return base.gte("created_at", args.since);
                }
                if (args.until !== undefined) {
                  return base.lte("created_at", args.until);
                }
                return base;
              })
              .order("desc")
          : ctx.db
              .query("audit_logs")
              .withIndex("by_created", (q) => {
                if (args.since !== undefined && args.until !== undefined) {
                  return q.gte("created_at", args.since).lte("created_at", args.until);
                }
                if (args.since !== undefined) {
                  return q.gte("created_at", args.since);
                }
                if (args.until !== undefined) {
                  return q.lte("created_at", args.until);
                }
                return q;
              })
              .order("desc");

    for await (const log of baseQuery) {
      total += 1;
      if (total <= offset) {
        continue;
      }

      if (paginated.length < limit) {
        paginated.push(log);
      }
    }

    const userIds = [...new Set(paginated.map((log) => log.user_id).filter(Boolean))];
    const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId as any)));
    const userById = new Map(
      users
        .filter(Boolean)
        .map((user) => [(user as any)._id, user])
    );

    const enriched = paginated.map((log) => {
      const user = log.user_id ? userById.get(log.user_id as any) : null;
      return {
        ...log,
        id: log._id,
        user: user ? { id: (user as any)._id, first_name: (user as any).first_name, last_name: (user as any).last_name } : null,
      };
    });

    return { data: enriched, count: total };
  },
});

export const deleteOlderThan = mutation({
  args: { timestamp: v.number() },
  returns: v.any(),
  handler: async (ctx, { timestamp }) => {
    const old = [];
    const oldLogs = ctx.db
      .query("audit_logs")
      .withIndex("by_created", (q) => q.lt("created_at", timestamp))
      .order("asc");

    for await (const log of oldLogs) {
      old.push(log);
    }

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }
    return { count: old.length };
  },
});

export const countErrors = query({
  args: { since: v.number() },
  returns: v.any(),
  handler: async (ctx, { since }) => {
    let count = 0;
    const logs = ctx.db
      .query("audit_logs")
      .withIndex("by_action_created", (q) =>
        q.eq("action", "ERROR").gte("created_at", since)
      )
      .order("desc");

    for await (const _log of logs) {
      count += 1;
    }

    return count;
  },
});
