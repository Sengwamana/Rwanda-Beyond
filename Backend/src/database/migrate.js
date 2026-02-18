/**
 * Database Migration Runner
 * 
 * With Convex, schema migrations are handled automatically via the
 * schema.ts file in the convex/ directory. Run `npx convex dev` or
 * `npx convex deploy` to push schema changes.
 * 
 * This script verifies the Convex connection and reports schema status.
 * Run with: npm run migrate
 * 
 * @module database/migrate
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env') });

async function runMigrations() {
  try {
    console.log('🌽 Smart Maize Farming System - Convex Schema Check\n');
    
    const client = new ConvexHttpClient(process.env.CONVEX_URL);
    
    // Test connection
    await client.query(api.systemConfig.healthCheck);
    console.log('✓ Convex connection verified');
    
    console.log('\nConvex manages schema automatically via convex/schema.ts');
    console.log('To push schema changes, run: npx convex dev (development) or npx convex deploy (production)');
    console.log('\n✅ Migration check completed');
    
  } catch (error) {
    console.error('❌ Convex connection failed:', error.message);
    console.log('\nMake sure CONVEX_URL is set in your .env file');
    console.log('Run `npx convex dev` to start the Convex development server');
    process.exit(1);
  }
}

runMigrations();

export default runMigrations;
