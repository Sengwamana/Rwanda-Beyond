import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.id("sensors") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const sensor = await ctx.db.get(id);
    if (!sensor) return null;
    const farm = await ctx.db.get(sensor.farm_id);
    return {
      ...sensor,
      id: sensor._id,
      farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
    };
  },
});

export const getByDeviceId = query({
  args: { deviceId: v.string() },
  returns: v.any(),
  handler: async (ctx, { deviceId }) => {
    const sensor = await ctx.db
      .query("sensors")
      .withIndex("by_device_id", (q) => q.eq("device_id", deviceId))
      .unique();
    if (!sensor) return null;
    const farm = await ctx.db.get(sensor.farm_id);
    return {
      ...sensor,
      id: sensor._id,
      farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
    };
  },
});

export const getByFarm = query({
  args: {
    farmId: v.id("farms"),
    status: v.optional(v.string()),
    sensorType: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const sensors = [];
    const sensorQuery =
      args.status
        ? ctx.db
            .query("sensors")
            .withIndex("by_farm_status_created", (q) =>
              q.eq("farm_id", args.farmId).eq("status", args.status as any)
            )
            .order("desc")
        : ctx.db
            .query("sensors")
            .withIndex("by_farm_created", (q) => q.eq("farm_id", args.farmId))
            .order("desc");

    for await (const sensor of sensorQuery) {
      if (args.sensorType && sensor.sensor_type !== args.sensorType) {
        continue;
      }
      sensors.push(sensor);
    }

    return sensors;
  },
});

export const listActive = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const sensors = [];
    const rows = ctx.db
      .query("sensors")
      .withIndex("by_status_created", (q) => q.eq("status", "active"))
      .order("desc");

    for await (const sensor of rows) {
      sensors.push(sensor);
    }

    return sensors;
  },
});

export const listActiveWithFarm = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const sensors = [];
    const sensorRows = ctx.db
      .query("sensors")
      .withIndex("by_status_created", (q) => q.eq("status", "active"))
      .order("desc");

    for await (const sensor of sensorRows) {
      sensors.push(sensor);
    }

    const farmIds = [...new Set(sensors.map((sensor) => sensor.farm_id))];
    const farms = await Promise.all(farmIds.map((farmId) => ctx.db.get(farmId)));
    const farmById = new Map(
      farms
        .filter(Boolean)
        .map((farm) => [(farm as any)._id, farm])
    );

    return await Promise.all(
      sensors.map(async (s) => {
        const farm = farmById.get(s.farm_id as any);
        return {
          ...s,
          id: s._id,
          farm: farm ? { id: farm._id, name: farm.name, user_id: farm.user_id } : null,
        };
      })
    );
  },
});

export const getHealth = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const sensors = [];
    const sensorRows = ctx.db.query("sensors").withIndex("by_created").order("desc");
    for await (const sensor of sensorRows) {
      sensors.push(sensor);
    }

    const farmIds = [...new Set(sensors.map((sensor) => sensor.farm_id))];
    const farms = await Promise.all(farmIds.map((farmId) => ctx.db.get(farmId)));
    const farmById = new Map(
      farms
        .filter(Boolean)
        .map((farm) => [(farm as any)._id, farm])
    );

    return sensors.map((sensor) => {
      const farm = farmById.get(sensor.farm_id as any);
      return {
        id: sensor._id,
        device_id: sensor.device_id,
        farm_id: sensor.farm_id,
        name: sensor.name,
        status: sensor.status,
        battery_level: sensor.battery_level,
        last_reading_at: sensor.last_reading_at,
        firmware_version: sensor.firmware_version,
        farm: farm ? { id: (farm as any)._id, name: (farm as any).name } : null,
      };
    });
  },
});

export const create = mutation({
  args: {
    farm_id: v.id("farms"),
    device_id: v.string(),
    sensor_type: v.string(),
    name: v.optional(v.string()),
    location_description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    firmware_version: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("sensors", {
      farm_id: args.farm_id,
      device_id: args.device_id,
      sensor_type: args.sensor_type as any,
      name: args.name,
      location_description: args.location_description,
      latitude: args.latitude,
      longitude: args.longitude,
      status: "active",
      firmware_version: args.firmware_version,
      metadata: args.metadata ?? {},
      created_at: now,
      updated_at: now,
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: { id: v.id("sensors"), updates: v.any() },
  returns: v.any(),
  handler: async (ctx, { id, updates }) => {
    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("sensors") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});

export const getDeviceInfo = query({
  args: { deviceId: v.string() },
  returns: v.any(),
  handler: async (ctx, { deviceId }) => {
    const sensor = await ctx.db
      .query("sensors")
      .withIndex("by_device_id", (q) => q.eq("device_id", deviceId))
      .unique();
    if (!sensor) return null;
    return { id: sensor._id, farm_id: sensor.farm_id, status: sensor.status };
  },
});

export const listAllStats = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const stats = [];
    const rows = ctx.db.query("sensors").withIndex("by_created").order("desc");
    for await (const sensor of rows) {
      stats.push({
        status: sensor.status,
        sensor_type: sensor.sensor_type,
      });
    }
    return stats;
  },
});
