import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const toTimestamp = (value?: number) => (typeof value === "number" ? value : undefined);

export const getById = query({
  args: { id: v.id("recommendations") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const rec = await ctx.db.get(id);
    if (!rec) return null;
    const farm = await ctx.db.get(rec.farm_id);
    const user = await ctx.db.get(rec.user_id);
    return {
      ...rec,
      id: rec._id,
      farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id, location_name: farm.location_name } : null,
      user: user ? { id: user._id, first_name: user.first_name, last_name: user.last_name, email: user.email } : null,
    };
  },
});

export const getByUser = query({
  args: {
    userId: v.id("users"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    farmId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let recs = await ctx.db
      .query("recommendations")
      .withIndex("by_user", (q) => q.eq("user_id", args.userId))
      .order("desc")
      .collect();

    if (args.type) recs = recs.filter((r) => r.type === args.type);
    if (args.status) recs = recs.filter((r) => r.status === args.status);
    if (args.priority) recs = recs.filter((r) => r.priority === args.priority);
    if (args.farmId) recs = recs.filter((r) => r.farm_id === args.farmId);

    const total = recs.length;
    const offset = (page - 1) * limit;
    const paginated = recs.slice(offset, offset + limit);

    const enriched = await Promise.all(
      paginated.map(async (r) => {
        const farm = await ctx.db.get(r.farm_id);
        return { ...r, id: r._id, farm: farm ? { id: farm._id, name: farm.name } : null };
      })
    );

    return { data: enriched, count: total };
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    statuses: v.optional(v.array(v.string())),
    priority: v.optional(v.string()),
    userId: v.optional(v.string()),
    farmId: v.optional(v.string()),
    district: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const since = toTimestamp(args.since);
    const until = toTimestamp(args.until);

    let recs = await ctx.db.query("recommendations").order("desc").collect();

    if (args.type) recs = recs.filter((r) => r.type === args.type);
    if (args.status) recs = recs.filter((r) => r.status === args.status);
    if (args.statuses) recs = recs.filter((r) => args.statuses!.includes(r.status));
    if (args.priority) recs = recs.filter((r) => r.priority === args.priority);
    if (args.userId) recs = recs.filter((r) => String(r.user_id) === args.userId);
    if (args.farmId) recs = recs.filter((r) => String(r.farm_id) === args.farmId);
    if (since !== undefined) recs = recs.filter((r) => r.created_at >= since);
    if (until !== undefined) recs = recs.filter((r) => r.created_at <= until);

    if (args.district) {
      const withFarm = await Promise.all(
        recs.map(async (r) => ({ rec: r, farm: await ctx.db.get(r.farm_id) }))
      );
      recs = withFarm
        .filter(({ farm }) => farm && String(farm.district_id) === args.district)
        .map(({ rec }) => rec);
    }

    const total = recs.length;
    const offset = (page - 1) * limit;
    const paginated = recs.slice(offset, offset + limit);

    const enriched = await Promise.all(
      paginated.map(async (r) => {
        const farm = await ctx.db.get(r.farm_id);
        const user = await ctx.db.get(r.user_id);
        return {
          ...r,
          id: r._id,
          farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id, district_id: farm.district_id } : null,
          user: user ? { id: user._id, first_name: user.first_name, last_name: user.last_name, email: user.email } : null,
        };
      })
    );

    return { data: enriched, count: total };
  },
});

export const getPending = query({
  args: {
    userId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let recs = await ctx.db
      .query("recommendations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    if (args.userId) recs = recs.filter((r) => r.user_id === args.userId);
    if (args.limit) recs = recs.slice(0, args.limit);

    return await Promise.all(
      recs.map(async (r) => {
        const farm = await ctx.db.get(r.farm_id);
        return { ...r, id: r._id, farm: farm ? { id: farm._id, name: farm.name } : null };
      })
    );
  },
});

export const getPendingCount = query({
  args: { userId: v.optional(v.id("users")), farmId: v.optional(v.id("farms")) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let recs = await ctx.db
      .query("recommendations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    if (args.userId) recs = recs.filter((r) => r.user_id === args.userId);
    if (args.farmId) recs = recs.filter((r) => r.farm_id === args.farmId);
    return recs.length;
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    status: v.optional(v.string()),
    statuses: v.optional(v.array(v.string())),
    priorities: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let recs = await ctx.db
      .query("recommendations")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();

    if (args.status) recs = recs.filter((r) => r.status === args.status);
    if (args.statuses) recs = recs.filter((r) => args.statuses!.includes(r.status));
    if (args.priorities) recs = recs.filter((r) => args.priorities!.includes(r.priority));
    if (args.since) recs = recs.filter((r) => r.created_at >= args.since!);
    if (args.until) recs = recs.filter((r) => r.created_at <= args.until!);
    if (args.limit) recs = recs.slice(0, args.limit);

    return recs;
  },
});

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("recommendations", {
      ...data,
      status: data.status ?? "pending",
      notification_sent: data.notification_sent ?? false,
      created_at: now,
      updated_at: now,
    });
    const rec = await ctx.db.get(id);
    const farm = rec ? await ctx.db.get(rec.farm_id) : null;
    const user = rec ? await ctx.db.get(rec.user_id) : null;
    return {
      ...rec,
      id,
      farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
      user: user ? { id: user._id, first_name: user.first_name, last_name: user.last_name } : null,
    };
  },
});

export const update = mutation({
  args: { id: v.id("recommendations"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const expirePending = mutation({
  args: { now: v.number(), maxAgeMs: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, { now, maxAgeMs }) => {
    const pending = await ctx.db
      .query("recommendations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const expired: string[] = [];
    for (const r of pending) {
      const shouldExpire =
        (r.expires_at && r.expires_at < now) ||
        (r.action_deadline && r.action_deadline < now) ||
        (maxAgeMs && !r.action_deadline && r.created_at < now - maxAgeMs);

      if (shouldExpire) {
        await ctx.db.patch(r._id, { status: "expired", updated_at: now });
        expired.push(r._id);
      }
    }
    return expired;
  },
});

export const getStats = query({
  args: {
    farmId: v.optional(v.string()),
    userId: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    let recs = await ctx.db.query("recommendations").collect();
    if (args.farmId) recs = recs.filter((r) => String(r.farm_id) === args.farmId);
    if (args.userId) recs = recs.filter((r) => String(r.user_id) === args.userId);
    if (args.since) recs = recs.filter((r) => r.created_at >= args.since!);
    if (args.until) recs = recs.filter((r) => r.created_at <= args.until!);
    return recs.map((r) => ({
      type: r.type,
      status: r.status,
      priority: r.priority,
      created_at: r.created_at,
      responded_at: r.responded_at,
    }));
  },
});

export const countSince = query({
  args: { since: v.number() },
  returns: v.any(),
  handler: async (ctx, { since }) => {
    const allRecs = await ctx.db
      .query("recommendations")
      .collect();
    const recs = allRecs.filter((r) => r.created_at >= since);
    return recs.length;
  },
});
