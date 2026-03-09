import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("users") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  returns: v.any(),
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", clerkId))
      .unique();
  },
});

export const getByPhone = query({
  args: { phone: v.string() },
  returns: v.any(),
  handler: async (ctx, { phone }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone_number", phone))
      .unique();
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  returns: v.any(),
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

export const list = query({
  args: {
    role: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    search: v.optional(v.string()),
    since: v.optional(v.number()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const offset = (page - 1) * limit;
    const paginated = [];
    let count = 0;
    const searchTerm = args.search?.toLowerCase();

    const baseQuery =
      args.role
        ? ctx.db
            .query("users")
            .withIndex("by_role_created", (q) => {
              const base = q.eq("role", args.role as any);
              if (args.since) {
                return base.gte("created_at", args.since);
              }
              return base;
            })
            .order("desc")
        : typeof args.isActive === "boolean"
          ? ctx.db
              .query("users")
              .withIndex("by_active_created", (q) => {
                const base = q.eq("is_active", args.isActive!);
                if (args.since) {
                  return base.gte("created_at", args.since);
                }
                return base;
              })
              .order("desc")
          : ctx.db
              .query("users")
              .withIndex("by_created", (q) => {
                if (args.since) {
                  return q.gte("created_at", args.since);
                }
                return q;
              })
              .order("desc");

    for await (const user of baseQuery) {
      if (typeof args.isActive === "boolean" && user.is_active !== args.isActive) {
        continue;
      }

      if (searchTerm) {
        const matchesSearch =
          user.first_name?.toLowerCase().includes(searchTerm) ||
          user.last_name?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm);

        if (!matchesSearch) {
          continue;
        }
      }

      if (count >= offset && paginated.length < limit) {
        paginated.push(user);
      }

      count += 1;
    }

    return { data: paginated, count };
  },
});

export const listAll = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const users = [];
    const rows = ctx.db.query("users").withIndex("by_created").order("desc");
    for await (const user of rows) {
      users.push(user);
    }
    return users;
  },
});

export const listActive = query({
  args: { role: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, { role }) => {
    const users = [];
    const rows = role
      ? ctx.db
          .query("users")
          .withIndex("by_active_role", (q) => q.eq("is_active", true).eq("role", role as any))
          .order("desc")
      : ctx.db
          .query("users")
          .withIndex("by_active_created", (q) => q.eq("is_active", true))
          .order("desc");

    for await (const user of rows) {
      users.push(user);
    }
    return users;
  },
});

export const create = mutation({
  args: {
    clerk_id: v.string(),
    email: v.optional(v.string()),
    phone_number: v.optional(v.string()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    role: v.optional(v.string()),
    preferred_language: v.optional(v.string()),
    profile_image_url: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("users", {
      clerk_id: args.clerk_id,
      email: args.email,
      phone_number: args.phone_number,
      first_name: args.first_name,
      last_name: args.last_name,
      role: (args.role as any) ?? "farmer",
      preferred_language: args.preferred_language ?? "rw",
      profile_image_url: args.profile_image_url,
      is_active: true,
      is_verified: false,
      metadata: args.metadata ?? {},
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("users"),
    updates: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    const existing = await ctx.db.get(id);
    if (!existing) return null;
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const updateByClerkId = mutation({
  args: {
    clerkId: v.string(),
    updates: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, { clerkId, updates }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerk_id", clerkId))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(user._id);
  },
});

export const getStats = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const stats = [];
    const rows = ctx.db.query("users").withIndex("by_created").order("desc");
    for await (const user of rows) {
      stats.push({
        _id: user._id,
        role: user.role,
        is_active: user.is_active,
      });
    }
    return stats;
  },
});
