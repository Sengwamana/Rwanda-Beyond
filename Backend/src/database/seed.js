/**
 * Database Seed Script
 * 
 * Populates the Convex database with initial data for testing and development.
 * 
 * Usage: npm run seed
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

const client = new ConvexHttpClient(process.env.CONVEX_URL);

// Rwanda districts grouped by province
const districtsByProvince = {
  'Eastern': ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana'],
  'Kigali': ['Gasabo', 'Kicukiro', 'Nyarugenge'],
  'Northern': ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo'],
  'Southern': ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango'],
  'Western': ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro'],
};

async function seedDistricts() {
  console.log('Seeding districts...');

  // districts.seed expects: { districts: [{ name: string, province: string }] }
  const districts = [];
  for (const [province, names] of Object.entries(districtsByProvince)) {
    for (const name of names) {
      districts.push({ name, province });
    }
  }

  try {
    await client.mutation(api.districts.seed, { districts });
    console.log(`✓ Seeded ${districts.length} districts`);
  } catch (error) {
    console.error('Error seeding districts:', error.message);
  }
}

async function seedSystemConfig() {
  console.log('Seeding system configuration...');

  const configs = [
    // Alert thresholds
    { key: 'alerts.soil_moisture.critical_low', value: '15', description: 'Critical low soil moisture threshold (%)' },
    { key: 'alerts.soil_moisture.low', value: '25', description: 'Low soil moisture threshold (%)' },
    { key: 'alerts.soil_moisture.high', value: '85', description: 'High soil moisture threshold (%)' },
    { key: 'alerts.temperature.high', value: '35', description: 'High temperature alert threshold (°C)' },
    { key: 'alerts.temperature.low', value: '10', description: 'Low temperature alert threshold (°C)' },
    // AI model settings
    { key: 'ai.pest_detection.confidence_threshold', value: '0.75', description: 'Minimum confidence for pest detection alerts' },
    { key: 'ai.irrigation.model_version', value: 'v1.0', description: 'Current irrigation optimization model version' },
    // Notification settings
    { key: 'notifications.sms.enabled', value: 'true', description: 'Enable SMS notifications' },
    { key: 'notifications.ussd.enabled', value: 'true', description: 'Enable USSD interface' },
    { key: 'notifications.batch_interval', value: '3600', description: 'Batch notification interval (seconds)' },
    // System settings
    { key: 'system.maintenance_mode', value: 'false', description: 'System maintenance mode flag' },
    { key: 'system.sensor_timeout_minutes', value: '60', description: 'Minutes before sensor is marked offline' },
    { key: 'system.weather_update_interval', value: '3600', description: 'Weather data update interval (seconds)' },
  ];

  try {
    for (const cfg of configs) {
      await client.mutation(api.systemConfig.upsert, {
        config_key: cfg.key,
        config_value: cfg.value,
        description: cfg.description,
      });
    }
    console.log(`✓ Seeded ${configs.length} configuration entries`);
  } catch (error) {
    console.error('Error seeding system config:', error.message);
  }
}

async function seedDemoUser() {
  console.log('Seeding demo user...');

  // users.create expects: clerk_id (required), optional email, phone_number, first_name, last_name, role, preferred_language
  const demoUser = {
    clerk_id: 'demo_user_clerk_id',
    email: 'demo@smartmaize.rw',
    phone_number: '+250788000001',
    first_name: 'Demo',
    last_name: 'Farmer',
    role: 'farmer',
    preferred_language: 'rw',
  };

  try {
    // Check if demo user already exists
    const existing = await client.query(api.users.getByClerkId, { clerkId: demoUser.clerk_id });
    if (existing) {
      console.log('✓ Demo user already exists (ID:', existing._id, ')');
      return existing._id;
    }

    const result = await client.mutation(api.users.create, demoUser);
    // Result may be the full user object or just the ID
    const userId = typeof result === 'string' ? result : result?._id;
    console.log('✓ Seeded demo user (ID:', userId, ')');
    return userId;
  } catch (error) {
    console.error('Error seeding demo user:', error.message);
    return null;
  }
}

async function lookupDistrictId(districtName) {
  try {
    const district = await client.query(api.districts.getByName, { name: districtName });
    return district?._id ?? null;
  } catch {
    return null;
  }
}

async function seedDemoFarm(userId) {
  console.log('Seeding demo farm...');

  if (!userId) {
    console.error('Skipping farm seed — no userId');
    return null;
  }

  // Resolve district_id from name
  const districtId = await lookupDistrictId('Rwamagana');

  // farms.create expects: user_id (v.id), name (string), optional district_id, latitude, longitude, size_hectares, etc.
  const demoFarm = {
    user_id: userId,
    name: 'Demo Maize Farm',
    latitude: -1.9403,
    longitude: 30.4389,
    size_hectares: 2.5,
    crop_variety: 'maize',
    planting_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    current_growth_stage: 'vegetative',
    location_name: 'Gishari, Rwamagana',
  };

  if (districtId) {
    demoFarm.district_id = districtId;
  }

  try {
    const result = await client.mutation(api.farms.create, demoFarm);
    const farmId = typeof result === 'string' ? result : result?._id;
    console.log('✓ Seeded demo farm (ID:', farmId, ')');
    return farmId;
  } catch (error) {
    console.error('Error seeding demo farm:', error.message);
    return null;
  }
}

async function seedDemoSensors(farmId) {
  console.log('Seeding demo sensors...');

  if (!farmId) {
    console.error('Skipping sensor seed — no farmId');
    return [];
  }

  // sensors.create expects: farm_id (v.id), device_id (string), sensor_type (string), optional name, latitude, longitude, location_description
  const sensors = [
    {
      farm_id: farmId,
      device_id: 'SM-SENSOR-001',
      sensor_type: 'soil_moisture',
      name: 'Soil Moisture Sensor 1',
      latitude: -1.9403,
      longitude: 30.4389,
      location_description: 'Zone A - center',
    },
    {
      farm_id: farmId,
      device_id: 'ST-SENSOR-001',
      sensor_type: 'temperature',
      name: 'Temperature Sensor 1 (soil/air)',
      latitude: -1.9403,
      longitude: 30.4389,
      location_description: 'Zone A - center',
    },
    {
      farm_id: farmId,
      device_id: 'HU-SENSOR-001',
      sensor_type: 'humidity',
      name: 'Humidity Sensor 1',
      latitude: -1.9403,
      longitude: 30.4389,
      location_description: 'Zone A - center',
    },
  ];

  const sensorIds = [];
  for (const sensor of sensors) {
    try {
      const result = await client.mutation(api.sensors.create, sensor);
      const id = typeof result === 'string' ? result : result?._id;
      sensorIds.push({ id, type: sensor.sensor_type });
    } catch (error) {
      console.error(`Error seeding ${sensor.sensor_type} sensor:`, error.message);
    }
  }
  console.log(`✓ Seeded ${sensorIds.length} sensors`);
  return sensorIds;
}

async function seedDemoSensorData(sensorEntries, farmId) {
  console.log('Seeding demo sensor data...');

  if (!sensorEntries.length || !farmId) {
    console.error('Skipping sensor data seed — no sensors or farmId');
    return;
  }

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  // Build a map of sensor type → sensor id
  const sensorMap = {};
  for (const entry of sensorEntries) {
    sensorMap[entry.type] = entry.id;
  }

  const records = [];

  // Generate data for the last 7 days, every 4 hours (to keep batch sizes reasonable)
  for (let day = 6; day >= 0; day--) {
    for (let hour = 0; hour < 24; hour += 4) {
      const ts = now - day * ONE_DAY + hour * ONE_HOUR;

      const isDaytime = hour > 10 && hour < 16;

      // Each record uses typed sensor value fields instead of generic value/unit
      if (sensorMap['soil_moisture']) {
        records.push({
          sensor_id: sensorMap['soil_moisture'],
          farm_id: farmId,
          reading_timestamp: ts,
          soil_moisture: +(40 + Math.random() * 20 - (isDaytime ? 10 : 0)).toFixed(1),
          is_valid: true,
        });
      }

      if (sensorMap['temperature']) {
        records.push({
          sensor_id: sensorMap['temperature'],
          farm_id: farmId,
          reading_timestamp: ts,
          soil_temperature: +(20 + Math.random() * 5 + (isDaytime ? 5 : 0)).toFixed(1),
          air_temperature: +(22 + Math.random() * 6 + (isDaytime ? 8 : 0)).toFixed(1),
          is_valid: true,
        });
      }

      if (sensorMap['humidity']) {
        records.push({
          sensor_id: sensorMap['humidity'],
          farm_id: farmId,
          reading_timestamp: ts,
          humidity: +(60 + Math.random() * 20 - (isDaytime ? 15 : 0)).toFixed(1),
          is_valid: true,
        });
      }
    }
  }

  // Insert in batches
  try {
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await client.mutation(api.sensorData.insertBatch, { records: batch });
      inserted += batch.length;
    }

    console.log(`✓ Seeded ${inserted} sensor data records`);
  } catch (error) {
    console.error('Error inserting sensor data:', error.message);
  }
}

async function seedDemoRecommendations(farmId, userId) {
  console.log('Seeding demo recommendations...');

  if (!farmId || !userId) {
    console.error('Skipping recommendations seed — no farmId or userId');
    return;
  }

  // recommendations.create expects: { data: { ...fields } }
  const recommendations = [
    {
      farm_id: farmId,
      user_id: userId,
      type: 'irrigation',
      priority: 'high',
      title: 'Irrigation Recommended',
      title_rw: 'Kuhira Byasabwe',
      description: 'Soil moisture is below optimal levels. Recommend irrigating Zone A for 30 minutes.',
      description_rw: "Ubukonje bw'ubutaka buri munsi y'urugero. Dusaba kuhira Agace A mu minota 30.",
      recommended_action: 'Irrigate Zone A for 30 minutes',
      status: 'pending',
      expires_at: Date.now() + 24 * 60 * 60 * 1000,
      confidence_score: 0.85,
      supporting_data: {
        soil_moisture: 28,
        threshold: 35,
        weather_forecast: 'No rain expected for 3 days',
      },
    },
    {
      farm_id: farmId,
      user_id: userId,
      type: 'fertilization',
      priority: 'medium',
      title: 'Nitrogen Application Due',
      title_rw: 'Igihe cyo Gushyira Nitrogen',
      description: 'Based on growth stage and soil analysis, nitrogen application is recommended.',
      description_rw: "Dukurikije ikigero cy'imikurire n'isesengura ry'ubutaka, gushyira nitrogen birasabwa.",
      recommended_action: 'Apply 50kg urea per hectare',
      status: 'pending',
      expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
      confidence_score: 0.78,
      supporting_data: {
        growth_stage: 'vegetative',
        days_since_planting: 45,
        nitrogen_level: 'moderate',
      },
    },
  ];

  for (const rec of recommendations) {
    try {
      await client.mutation(api.recommendations.create, { data: rec });
    } catch (error) {
      console.error(`Error seeding "${rec.title}" recommendation:`, error.message);
    }
  }
  console.log(`✓ Seeded ${recommendations.length} recommendations`);
}

async function seedDemoIoTDevice() {
  console.log('Seeding demo IoT device token...');

  const crypto = await import('crypto');
  const token = 'demo_token_' + crypto.randomBytes(16).toString('hex');

  // iotDeviceTokens.create expects: device_id (string), token_hash (string), optional expires_at (number)
  try {
    // Check if token for this device already exists
    const existingToken = await client.query(api.iotDeviceTokens.verify, {
      device_id: 'demo_device_001',
      token_hash: 'check_existing',
    }).catch(() => null);

    await client.mutation(api.iotDeviceTokens.create, {
      device_id: 'demo_device_001',
      token_hash: crypto.createHash('sha256').update(token).digest('hex'),
      expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });
    console.log('✓ Seeded demo IoT device');
    console.log(`  Device ID: demo_device_001`);
    console.log(`  Token (save this!): ${token}`);
  } catch (error) {
    console.error('Error seeding IoT device:', error.message);
  }
}

async function main() {
  console.log('🌽 Smart Maize Farming System - Database Seeding\n');
  console.log('================================================\n');

  try {
    // Check database connection
    await client.query(api.systemConfig.healthCheck);
    console.log('✓ Connected to Convex\n');

    // 1. Seed reference data
    await seedDistricts();
    await seedSystemConfig();

    // 2. Seed demo user, farm, sensors (chained by IDs)
    const userId = await seedDemoUser();
    const farmId = await seedDemoFarm(userId);
    const sensorEntries = await seedDemoSensors(farmId);

    // 3. Seed sensor data (needs sensor IDs + farm ID)
    await seedDemoSensorData(sensorEntries, farmId);

    // 4. Seed recommendations (needs farm + user IDs)
    await seedDemoRecommendations(farmId, userId);

    // 5. Seed IoT device token (standalone)
    await seedDemoIoTDevice();

    console.log('\n================================================');
    console.log('✅ Database seeding completed successfully!');
    console.log('\nDemo Credentials:');
    console.log('  Email: demo@smartmaize.rw');
    console.log('  Phone: +250788000001');
    console.log('================================================\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
