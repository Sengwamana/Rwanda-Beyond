import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Enum validators
const userRole = v.union(v.literal("farmer"), v.literal("expert"), v.literal("admin"));
const recommendationStatus = v.union(
  v.literal("pending"), v.literal("accepted"), v.literal("rejected"),
  v.literal("deferred"), v.literal("executed"), v.literal("expired")
);
const recommendationType = v.union(
  v.literal("irrigation"), v.literal("fertilization"),
  v.literal("pest_alert"), v.literal("weather_alert"), v.literal("general")
);
const recommendationPriority = v.union(
  v.literal("critical"), v.literal("high"), v.literal("medium"), v.literal("low")
);
const sensorType = v.union(
  v.literal("soil_moisture"), v.literal("temperature"), v.literal("humidity"),
  v.literal("npk"), v.literal("rainfall"), v.literal("light")
);
const sensorStatus = v.union(
  v.literal("active"), v.literal("inactive"), v.literal("maintenance"), v.literal("faulty")
);
const pestSeverity = v.union(
  v.literal("none"), v.literal("low"), v.literal("moderate"), v.literal("high"), v.literal("severe")
);
const messageStatus = v.union(
  v.literal("queued"), v.literal("sent"), v.literal("delivered"), v.literal("failed"), v.literal("read")
);
const messageChannel = v.union(
  v.literal("sms"), v.literal("ussd"), v.literal("push"), v.literal("email")
);

export default defineSchema({
  users: defineTable({
    clerk_id: v.string(),
    email: v.optional(v.string()),
    phone_number: v.optional(v.string()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    role: userRole,
    preferred_language: v.optional(v.string()),
    profile_image_url: v.optional(v.string()),
    is_active: v.boolean(),
    is_verified: v.boolean(),
    deactivation_reason: v.optional(v.string()),
    last_login_at: v.optional(v.number()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_clerk_id", ["clerk_id"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone_number"])
    .index("by_role", ["role"])
    .index("by_active_role", ["is_active", "role"])
    .index("by_created", ["created_at"])
    .index("by_role_created", ["role", "created_at"])
    .index("by_active_created", ["is_active", "created_at"]),

  districts: defineTable({
    name: v.string(),
    province: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    created_at: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_province", ["province"]),

  farms: defineTable({
    user_id: v.id("users"),
    name: v.string(),
    district_id: v.optional(v.id("districts")),
    location_name: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    size_hectares: v.optional(v.number()),
    soil_type: v.optional(v.string()),
    crop_variety: v.optional(v.string()),
    planting_date: v.optional(v.string()),
    expected_harvest_date: v.optional(v.string()),
    current_growth_stage: v.optional(v.string()),
    is_active: v.boolean(),
    metadata: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_district", ["district_id"])
    .index("by_active", ["is_active"])
    .index("by_user_active", ["user_id", "is_active"])
    .index("by_created", ["created_at"])
    .index("by_user_created", ["user_id", "created_at"])
    .index("by_active_created", ["is_active", "created_at"])
    .index("by_district_created", ["district_id", "created_at"]),

  sensors: defineTable({
    farm_id: v.id("farms"),
    device_id: v.string(),
    sensor_type: sensorType,
    name: v.optional(v.string()),
    location_description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    status: sensorStatus,
    battery_level: v.optional(v.number()),
    firmware_version: v.optional(v.string()),
    last_reading_at: v.optional(v.number()),
    calibration_date: v.optional(v.string()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_farm", ["farm_id"])
    .index("by_device_id", ["device_id"])
    .index("by_type", ["sensor_type"])
    .index("by_status", ["status"])
    .index("by_farm_status", ["farm_id", "status"])
    .index("by_created", ["created_at"])
    .index("by_status_created", ["status", "created_at"])
    .index("by_farm_created", ["farm_id", "created_at"])
    .index("by_farm_status_created", ["farm_id", "status", "created_at"]),

  sensor_data: defineTable({
    sensor_id: v.id("sensors"),
    farm_id: v.id("farms"),
    reading_timestamp: v.number(),
    soil_moisture: v.optional(v.number()),
    soil_temperature: v.optional(v.number()),
    air_temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    nitrogen: v.optional(v.number()),
    phosphorus: v.optional(v.number()),
    potassium: v.optional(v.number()),
    ph_level: v.optional(v.number()),
    light_intensity: v.optional(v.number()),
    rainfall_mm: v.optional(v.number()),
    is_valid: v.boolean(),
    validation_flags: v.optional(v.any()),
    raw_payload: v.optional(v.any()),
    created_at: v.number(),
    })
      .index("by_sensor", ["sensor_id"])
      .index("by_farm", ["farm_id"])
      .index("by_timestamp", ["reading_timestamp"])
      .index("by_farm_timestamp", ["farm_id", "reading_timestamp"])
      .index("by_farm_valid_timestamp", ["farm_id", "is_valid", "reading_timestamp"])
      .index("by_farm_sensor_timestamp", ["farm_id", "sensor_id", "reading_timestamp"])
      .index("by_sensor_timestamp", ["sensor_id", "reading_timestamp"])
      .index("by_valid", ["is_valid"]),

  weather_data: defineTable({
    district_id: v.optional(v.id("districts")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    forecast_date: v.string(),
    forecast_time: v.optional(v.string()),
    temperature: v.optional(v.number()),
    feels_like: v.optional(v.number()),
    humidity: v.optional(v.number()),
    pressure: v.optional(v.number()),
    wind_speed: v.optional(v.number()),
    wind_direction: v.optional(v.number()),
    precipitation_probability: v.optional(v.number()),
    precipitation_mm: v.optional(v.number()),
    rain_mm: v.optional(v.number()),
    weather_condition: v.optional(v.string()),
    weather_description: v.optional(v.string()),
    cloud_cover: v.optional(v.number()),
    uv_index: v.optional(v.number()),
    source: v.optional(v.string()),
    raw_response: v.optional(v.any()),
    fetched_at: v.number(),
    created_at: v.number(),
  })
    .index("by_district", ["district_id"])
    .index("by_date", ["forecast_date"])
    .index("by_district_date", ["district_id", "forecast_date"])
    .index("by_district_date_time", ["district_id", "forecast_date", "forecast_time"])
    .index("by_fetched", ["fetched_at"]),

  pest_detections: defineTable({
    farm_id: v.id("farms"),
    reported_by: v.id("users"),
    image_url: v.string(),
    cloudinary_public_id: v.optional(v.string()),
    thumbnail_url: v.optional(v.string()),
    pest_detected: v.boolean(),
    pest_type: v.optional(v.string()),
    severity: pestSeverity,
    confidence_score: v.optional(v.number()),
    affected_area_percentage: v.optional(v.number()),
    model_version: v.optional(v.string()),
    detection_metadata: v.optional(v.any()),
    location_description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    reviewed_by: v.optional(v.id("users")),
    reviewed_at: v.optional(v.number()),
    expert_notes: v.optional(v.string()),
    is_confirmed: v.optional(v.boolean()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_farm", ["farm_id"])
    .index("by_reporter", ["reported_by"])
    .index("by_detected", ["pest_detected"])
    .index("by_severity", ["severity"])
    .index("by_created", ["created_at"])
    .index("by_farm_created", ["farm_id", "created_at"])
    .index("by_farm_detected", ["farm_id", "pest_detected"])
    .index("by_farm_detected_created", ["farm_id", "pest_detected", "created_at"])
    .index("by_detected_created", ["pest_detected", "created_at"]),

  irrigation_schedules: defineTable({
    farm_id: v.id("farms"),
    recommendation_id: v.optional(v.id("recommendations")),
    scheduled_date: v.string(),
    scheduled_time: v.optional(v.string()),
    duration_minutes: v.number(),
    water_volume_liters: v.optional(v.number()),
    is_executed: v.boolean(),
    executed_at: v.optional(v.number()),
    actual_duration_minutes: v.optional(v.number()),
    actual_water_volume: v.optional(v.number()),
    trigger_source: v.optional(v.string()),
    soil_moisture_at_scheduling: v.optional(v.number()),
    target_soil_moisture: v.optional(v.number()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_farm", ["farm_id"])
    .index("by_date", ["scheduled_date"])
    .index("by_executed", ["is_executed"])
    .index("by_farm_date", ["farm_id", "scheduled_date"])
    .index("by_farm_executed", ["farm_id", "is_executed"])
    .index("by_farm_executed_date", ["farm_id", "is_executed", "scheduled_date"]),

  fertilization_schedules: defineTable({
    farm_id: v.id("farms"),
    recommendation_id: v.optional(v.id("recommendations")),
    scheduled_date: v.string(),
    fertilizer_type: v.string(),
    application_method: v.optional(v.string()),
    nitrogen_kg: v.optional(v.number()),
    phosphorus_kg: v.optional(v.number()),
    potassium_kg: v.optional(v.number()),
    total_quantity_kg: v.optional(v.number()),
    is_executed: v.boolean(),
    executed_at: v.optional(v.number()),
    actual_quantity_kg: v.optional(v.number()),
    growth_stage: v.optional(v.string()),
    soil_npk_at_scheduling: v.optional(v.any()),
    notes: v.optional(v.string()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_farm", ["farm_id"])
    .index("by_date", ["scheduled_date"])
    .index("by_executed", ["is_executed"])
    .index("by_farm_date", ["farm_id", "scheduled_date"])
    .index("by_farm_executed_date", ["farm_id", "is_executed", "scheduled_date"]),

  recommendations: defineTable({
    farm_id: v.id("farms"),
    user_id: v.id("users"),
    type: recommendationType,
    priority: recommendationPriority,
    status: recommendationStatus,
    title: v.string(),
    title_rw: v.optional(v.string()),
    description: v.string(),
    description_rw: v.optional(v.string()),
    recommended_action: v.optional(v.string()),
    action_deadline: v.optional(v.number()),
    supporting_data: v.optional(v.any()),
    confidence_score: v.optional(v.number()),
    model_version: v.optional(v.string()),
    responded_at: v.optional(v.number()),
    response_notes: v.optional(v.string()),
    deferred_until: v.optional(v.number()),
    notification_sent: v.boolean(),
    notification_sent_at: v.optional(v.number()),
    notification_channel: v.optional(messageChannel),
    irrigation_schedule_id: v.optional(v.id("irrigation_schedules")),
    fertilization_schedule_id: v.optional(v.id("fertilization_schedules")),
    pest_detection_id: v.optional(v.id("pest_detections")),
    expires_at: v.optional(v.number()),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_farm", ["farm_id"])
    .index("by_user", ["user_id"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_created", ["created_at"])
    .index("by_user_status", ["user_id", "status"])
    .index("by_farm_status", ["farm_id", "status"]),

  messages: defineTable({
    user_id: v.id("users"),
    recommendation_id: v.optional(v.id("recommendations")),
    channel: messageChannel,
    recipient: v.string(),
    subject: v.optional(v.string()),
    content: v.string(),
    content_rw: v.optional(v.string()),
    status: messageStatus,
    external_message_id: v.optional(v.string()),
    sent_at: v.optional(v.number()),
    delivered_at: v.optional(v.number()),
    read_at: v.optional(v.number()),
    failed_reason: v.optional(v.string()),
    retry_count: v.number(),
    cost_units: v.optional(v.number()),
    metadata: v.optional(v.any()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"])
    .index("by_recommendation", ["recommendation_id"])
    .index("by_status", ["status"])
    .index("by_status_created", ["status", "created_at"])
    .index("by_channel", ["channel"])
    .index("by_channel_created", ["channel", "created_at"])
    .index("by_created", ["created_at"]),

  system_config: defineTable({
    config_key: v.string(),
    config_value: v.any(),
    description: v.optional(v.string()),
    is_active: v.boolean(),
    updated_by: v.optional(v.id("users")),
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_key", ["config_key"]),

  audit_logs: defineTable({
    user_id: v.optional(v.id("users")),
    action: v.string(),
    entity_type: v.string(),
    entity_id: v.optional(v.string()),
    old_values: v.optional(v.any()),
    new_values: v.optional(v.any()),
    ip_address: v.optional(v.string()),
    user_agent: v.optional(v.string()),
    created_at: v.number(),
  })
    .index("by_user", ["user_id"])
    .index("by_user_created", ["user_id", "created_at"])
    .index("by_action", ["action"])
    .index("by_action_created", ["action", "created_at"])
    .index("by_entity", ["entity_type", "entity_id"])
    .index("by_entity_created", ["entity_type", "created_at"])
    .index("by_created", ["created_at"]),

  iot_device_tokens: defineTable({
    device_id: v.string(),
    token_hash: v.string(),
    is_active: v.boolean(),
    last_used_at: v.optional(v.number()),
    expires_at: v.optional(v.number()),
    created_at: v.number(),
    })
      .index("by_device", ["device_id"])
      .index("by_active", ["is_active"])
      .index("by_created", ["created_at"])
      .index("by_device_active", ["device_id", "is_active"])
      .index("by_active_created", ["is_active", "created_at"])
      .index("by_device_created", ["device_id", "created_at"])
      .index("by_device_active_created", ["device_id", "is_active", "created_at"])
      .index("by_device_active_hash", ["device_id", "is_active", "token_hash"]),
  });
