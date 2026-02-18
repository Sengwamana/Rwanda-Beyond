import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("pest_detections") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const det = await ctx.db.get(id);
    if (!det) return null;
    const farm = await ctx.db.get(det.farm_id);
    const reporter = await ctx.db.get(det.reported_by);
    const reviewer = det.reviewed_by ? await ctx.db.get(det.reviewed_by) : null;
    return {
      ...det,
      id: det._id,
      farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id, location_name: farm.location_name, district_id: farm.district_id } : null,
      reporter: reporter ? { id: reporter._id, first_name: reporter.first_name, last_name: reporter.last_name } : null,
      reviewer: reviewer ? { id: reviewer._id, first_name: reviewer.first_name, last_name: reviewer.last_name } : null,
    };
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    pestDetected: v.optional(v.boolean()),
    severity: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let dets = await ctx.db
      .query("pest_detections")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();

    if (typeof args.pestDetected === "boolean") dets = dets.filter((d) => d.pest_detected === args.pestDetected);
    if (args.severity) dets = dets.filter((d) => d.severity === args.severity);

    const total = dets.length;
    const offset = (page - 1) * limit;
    return { data: dets.slice(offset, offset + limit), count: total };
  },
});

export const getRecent = query({
  args: { farmId: v.id("farms"), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const dets = await ctx.db
      .query("pest_detections")
      .withIndex("by_farm", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();
    return dets.filter((d) => d.pest_detected).slice(0, args.limit ?? 5);
  },
});

export const getUnreviewed = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;

    let dets = await ctx.db
      .query("pest_detections")
      .withIndex("by_detected", (q) => q.eq("pest_detected", true))
      .order("desc")
      .collect();

    dets = dets.filter((d) => !d.reviewed_by);
    if (args.since) dets = dets.filter((d) => d.created_at >= args.since!);

    const total = dets.length;
    const offset = (page - 1) * limit;
    const paginated = dets.slice(offset, offset + limit);

    const enriched = await Promise.all(
      paginated.map(async (d) => {
        const farm = await ctx.db.get(d.farm_id);
        const reporter = await ctx.db.get(d.reported_by);
        return {
          ...d,
          id: d._id,
          farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
          reporter: reporter ? { id: reporter._id, first_name: reporter.first_name, last_name: reporter.last_name } : null,
        };
      })
    );

    return { data: enriched, count: total };
  },
});

export const create = mutation({
  args: { data: v.any() },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("pest_detections", {
      ...data,
      pest_detected: data.pest_detected ?? false,
      severity: data.severity ?? "none",
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { id: v.id("pest_detections"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("pest_detections") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});

export const getStats = query({
  args: { since: v.optional(v.number()), until: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let dets = await ctx.db.query("pest_detections").collect();
    if (args.since) dets = dets.filter((d) => d.created_at >= args.since!);
    if (args.until) dets = dets.filter((d) => d.created_at <= args.until!);
    return dets.map((d) => ({
      pest_detected: d.pest_detected,
      severity: d.severity,
      confidence_score: d.confidence_score,
      pest_type: d.pest_type,
      created_at: d.created_at,
    }));
  },
});

export const getOldImages = query({
  args: { before: v.number() },
  returns: v.any(),
  handler: async (ctx, { before }) => {
    const allDets = await ctx.db
      .query("pest_detections")
      .collect();
    const dets = allDets.filter((d) => d.created_at < before);
    return dets
      .filter((d) => !d.pest_detected || d.severity === "none")
      .map((d) => ({ id: d._id, cloudinary_public_id: d.cloudinary_public_id }));
  },
});

export const getOutbreakMap = query({
  args: { since: v.optional(v.number()), statuses: v.optional(v.array(v.string())) },
  returns: v.any(),
  handler: async (ctx, args) => {
    let dets = await ctx.db.query("pest_detections").order("desc").collect();
    if (args.since) dets = dets.filter((d) => d.created_at >= args.since!);
    if (args.statuses) dets = dets.filter((d) => d.pest_detected);

    return await Promise.all(
      dets.map(async (d) => {
        const farm = await ctx.db.get(d.farm_id);
        return { ...d, id: d._id, farm: farm ?? null };
      })
    );
  },
});
