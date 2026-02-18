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
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    let users = await ctx.db.query("users").order("desc").collect();

    if (args.role) {
      users = users.filter((u) => u.role === args.role);
    }
    if (typeof args.isActive === "boolean") {
      users = users.filter((u) => u.is_active === args.isActive);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      users = users.filter(
        (u) =>
          (u.first_name?.toLowerCase().includes(s)) ||
          (u.last_name?.toLowerCase().includes(s)) ||
          (u.email?.toLowerCase().includes(s))
      );
    }

    const total = users.length;
    const offset = (page - 1) * limit;
    const paginated = users.slice(offset, offset + limit);

    return { data: paginated, count: total };
  },
});

export const listAll = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listActive = query({
  args: { role: v.optional(v.string()) },
  returns: v.any(),
  handler: async (ctx, { role }) => {
    let users = await ctx.db.query("users").collect();
    users = users.filter((u) => u.is_active);
    if (role) users = users.filter((u) => u.role === role);
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
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      role: u.role,
      is_active: u.is_active,
    }));
  },
});
