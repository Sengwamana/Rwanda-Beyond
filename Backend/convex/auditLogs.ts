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
    userId: v.optional(v.string()),
    entityType: v.optional(v.string()),
    since: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let logs = await ctx.db.query("audit_logs").order("desc").collect();

    if (args.action) logs = logs.filter((l) => l.action === args.action);
    if (args.userId) logs = logs.filter((l) => l.user_id === args.userId);
    if (args.entityType) logs = logs.filter((l) => l.entity_type === args.entityType);
    if (args.since) logs = logs.filter((l) => l.created_at >= args.since!);

    const total = logs.length;
    const offset = (page - 1) * limit;
    const paginated = logs.slice(offset, offset + limit);

    // Enrich with user info
    const enriched = await Promise.all(
      paginated.map(async (l) => {
        const user = l.user_id ? await ctx.db.get(l.user_id as any) : null;
        return {
          ...l,
          id: l._id,
          user: user ? { id: (user as any)._id, first_name: (user as any).first_name, last_name: (user as any).last_name } : null,
        };
      })
    );

    return { data: enriched, count: total };
  },
});

export const deleteOlderThan = mutation({
  args: { timestamp: v.number() },
  returns: v.any(),
  handler: async (ctx, { timestamp }) => {
    const allLogs = await ctx.db
      .query("audit_logs")
      .collect();
    const old = allLogs.filter((l) => l.created_at < timestamp);
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
    const logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_action", (q) => q.eq("action", "ERROR"))
      .collect();
    return logs.filter((l) => l.created_at >= since).length;
  },
});
