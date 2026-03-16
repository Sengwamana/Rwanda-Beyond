import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const issueCategory = v.union(
  v.literal("general"),
  v.literal("irrigation"),
  v.literal("fertilization"),
  v.literal("pest"),
  v.literal("sensor"),
  v.literal("weather")
);
const issueSeverity = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);
const issueStatus = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("resolved"),
  v.literal("closed")
);
const issueChannel = v.union(
  v.literal("web"),
  v.literal("sms"),
  v.literal("ussd"),
  v.literal("voice"),
  v.literal("system")
);

const enrichIssue = async (ctx: any, issue: any) => {
  const [farm, reporter, assignee] = await Promise.all([
    ctx.db.get(issue.farm_id),
    ctx.db.get(issue.reported_by),
    issue.assigned_to ? ctx.db.get(issue.assigned_to) : null,
  ]);
  const district = farm?.district_id ? await ctx.db.get(farm.district_id) : null;

  return {
    ...issue,
    id: issue._id,
    farm: farm
      ? {
          id: farm._id,
          name: farm.name,
          user_id: farm.user_id,
          location_name: farm.location_name,
          district_id: farm.district_id,
          district: district
            ? {
                id: district._id,
                name: district.name,
                province: district.province,
              }
            : null,
        }
      : null,
    reporter: reporter
      ? {
          id: reporter._id,
          first_name: reporter.first_name,
          last_name: reporter.last_name,
          phone_number: reporter.phone_number,
        }
      : null,
    assignee: assignee
      ? {
          id: assignee._id,
          first_name: assignee.first_name,
          last_name: assignee.last_name,
          email: assignee.email,
        }
      : null,
  };
};

export const create = mutation({
  args: {
    data: v.object({
      farm_id: v.id("farms"),
      reported_by: v.id("users"),
      title: v.string(),
      description: v.string(),
      category: issueCategory,
      severity: issueSeverity,
      status: issueStatus,
      source_channel: issueChannel,
      assigned_to: v.optional(v.id("users")),
      location_description: v.optional(v.string()),
      expert_notes: v.optional(v.string()),
      resolution_notes: v.optional(v.string()),
      metadata: v.optional(v.any()),
      resolved_at: v.optional(v.number()),
    }),
  },
  returns: v.any(),
  handler: async (ctx, { data }) => {
    const now = Date.now();
    const id = await ctx.db.insert("farm_issues", {
      ...data,
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("farm_issues"),
    updates: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, {
      ...updates,
      updated_at: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const getById = query({
  args: { id: v.id("farm_issues") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const issue = await ctx.db.get(id);
    if (!issue) return null;
    return await enrichIssue(ctx, issue);
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    severity: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const rows = await ctx.db
      .query("farm_issues")
      .withIndex("by_farm_created", (q) => q.eq("farm_id", args.farmId))
      .order("desc")
      .collect();

    const filtered = rows.filter((row) => {
      if (args.status && row.status !== args.status) return false;
      if (args.category && row.category !== args.category) return false;
      if (args.severity && row.severity !== args.severity) return false;
      if (args.since && row.created_at < args.since) return false;
      if (args.until && row.created_at > args.until) return false;
      return true;
    });

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit);

    return {
      data: await Promise.all(pageRows.map((row) => enrichIssue(ctx, row))),
      count: total,
      page,
      limit,
    };
  },
});

export const list = query({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    farmId: v.optional(v.string()),
    reportedBy: v.optional(v.string()),
    status: v.optional(v.string()),
    category: v.optional(v.string()),
    severity: v.optional(v.string()),
    sourceChannel: v.optional(v.string()),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const rows = await ctx.db.query("farm_issues").withIndex("by_created").order("desc").collect();

    const filtered = rows.filter((row) => {
      if (args.farmId && String(row.farm_id) !== args.farmId) return false;
      if (args.reportedBy && String(row.reported_by) !== args.reportedBy) return false;
      if (args.status && row.status !== args.status) return false;
      if (args.category && row.category !== args.category) return false;
      if (args.severity && row.severity !== args.severity) return false;
      if (args.sourceChannel && row.source_channel !== args.sourceChannel) return false;
      if (args.since && row.created_at < args.since) return false;
      if (args.until && row.created_at > args.until) return false;
      return true;
    });

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit);

    return {
      data: await Promise.all(pageRows.map((row) => enrichIssue(ctx, row))),
      count: total,
      page,
      limit,
    };
  },
});
