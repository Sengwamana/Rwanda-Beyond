import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const asFarm = (value: any) => value as {
  _id: string;
  name: string;
  user_id: string;
  location_name?: string;
  district_id?: string;
} | null;

const asUser = (value: any) => value as {
  _id: string;
  first_name?: string;
  last_name?: string;
} | null;

export const getById = query({
  args: { id: v.id("pest_detections") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const det = await ctx.db.get(id);
    if (!det) return null;
    const farm = asFarm(await ctx.db.get(det.farm_id));
    const reporter = asUser(await ctx.db.get(det.reported_by));
    const reviewer = det.reviewed_by ? asUser(await ctx.db.get(det.reviewed_by)) : null;
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
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;

    const detQuery =
      typeof args.pestDetected === "boolean"
        ? ctx.db
            .query("pest_detections")
            .withIndex("by_farm_detected_created", (q) =>
              {
                const base = q.eq("farm_id", args.farmId).eq("pest_detected", args.pestDetected!);
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
              }
            )
            .order("desc")
        : ctx.db
            .query("pest_detections")
            .withIndex("by_farm_created", (q) => {
              const base = q.eq("farm_id", args.farmId);
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
            .order("desc");

    const data = [];
    let count = 0;

    for await (const det of detQuery) {
      if (args.severity && det.severity !== args.severity) {
        continue;
      }

      if (count >= offset && data.length < limit) {
        data.push(det);
      }

      count += 1;
    }

    return { data, count };
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    pestDetected: v.optional(v.boolean()),
    severity: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;

    const detQuery =
      typeof args.pestDetected === "boolean"
        ? ctx.db
            .query("pest_detections")
            .withIndex("by_detected_created", (q) => {
              const base = q.eq("pest_detected", args.pestDetected!);
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
            .query("pest_detections")
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

    const data = [];
    let count = 0;

    for await (const det of detQuery) {
      if (args.severity && det.severity !== args.severity) {
        continue;
      }

      if (count >= offset && data.length < limit) {
        data.push(det);
      }

      count += 1;
    }

    return { data, count };
  },
});

export const getRecent = query({
  args: { farmId: v.id("farms"), limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pest_detections")
      .withIndex("by_farm_detected_created", (q) =>
        q.eq("farm_id", args.farmId).eq("pest_detected", true)
      )
      .order("desc")
      .take(args.limit ?? 5);
  },
});

export const getUnreviewed = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    since: v.optional(v.number()),
    severity: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;
    const detQuery = ctx.db
      .query("pest_detections")
      .withIndex("by_detected_created", (q) => {
        const base = q.eq("pest_detected", true);
        if (args.since) {
          return base.gte("created_at", args.since);
        }
        return base;
      })
      .order("desc");

    const paginated = [];
    let count = 0;

    for await (const det of detQuery) {
      if (det.reviewed_by) {
        continue;
      }
      if (args.severity && det.severity !== args.severity) {
        continue;
      }

      if (count >= offset && paginated.length < limit) {
        paginated.push(det);
      }

      count += 1;
    }

    const enriched = await Promise.all(
      paginated.map(async (d) => {
        const farm = asFarm(await ctx.db.get(d.farm_id));
        const reporter = asUser(await ctx.db.get(d.reported_by));
        return {
          ...d,
          id: d._id,
          farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
          reporter: reporter ? { id: reporter._id, first_name: reporter.first_name, last_name: reporter.last_name } : null,
        };
      })
    );

    return { data: enriched, count };
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
    const detQuery = ctx.db
      .query("pest_detections")
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

    const dets = [];
    for await (const det of detQuery) {
      dets.push(det);
    }

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
    const oldDetQuery = ctx.db
      .query("pest_detections")
      .withIndex("by_created", (q) => q.lt("created_at", before))
      .order("asc");

    const stale = [];
    for await (const det of oldDetQuery) {
      if (!det.pest_detected || det.severity === "none") {
        stale.push({ id: det._id, cloudinary_public_id: det.cloudinary_public_id });
      }
    }

    return stale;
  },
});

export const getOutbreakMap = query({
  args: { since: v.optional(v.number()), statuses: v.optional(v.array(v.string())) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const detections = [];
    const requestedStatuses = Array.isArray(args.statuses)
      ? new Set(args.statuses.map((status) => String(status).toLowerCase()))
      : null;

    const detectionQuery = args.since
      ? ctx.db
          .query("pest_detections")
          .withIndex("by_created", (q) => q.gte("created_at", args.since!))
          .order("desc")
      : ctx.db
          .query("pest_detections")
          .withIndex("by_created")
          .order("desc");

    for await (const detection of detectionQuery) {
      if (requestedStatuses) {
        const statusValue = detection.pest_detected ? "detected" : "clear";
        if (!requestedStatuses.has(statusValue) && !requestedStatuses.has(String(detection.severity).toLowerCase())) {
          continue;
        }
      }

      detections.push(detection);
    }

    const farmIds = [...new Set(detections.map((detection) => detection.farm_id).filter(Boolean))];
    const farms = await Promise.all(farmIds.map((farmId) => ctx.db.get(farmId as any)));
    const farmById = new Map(
      farms
        .filter(Boolean)
        .map((farm) => [(farm as any)._id, farm])
    );

    return detections.map((detection) => ({
      ...detection,
      id: detection._id,
      farm: farmById.get(detection.farm_id as any) ?? null,
    }));
  },
});
