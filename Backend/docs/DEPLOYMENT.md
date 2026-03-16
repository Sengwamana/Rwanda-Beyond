# Smart Maize Farming System - Deployment Guide

## Current Project Stage

Current stage: advanced development / pre-production hardening.

- Core backend modules are implemented.
- Frontend, backend, and Convex local services run together in development.
- Regression coverage exists for storage management, analytics, AI, irrigation, fertilization, notifications, pest detection, and sensor transmission.
- Current deployment work is focused on environment setup, service coordination, production configuration, and final validation.

## Quick Start

### 1. Install Dependencies
```bash
cd Backend
npm install
```

### 2. Configure Environment
The `.env` file is already configured with your credentials. Verify all values are correct:
- `CONVEX_URL` - Convex deployment URL used by the backend
- `CLERK_SECRET_KEY` - for authentication  
- `CLOUDINARY_*` - for image storage
- `AT_*` - for Africa's Talking SMS/USSD
- `OPENWEATHER_API_KEY` - for weather data

### 3. Set Up Database

**IMPORTANT:** The active backend uses Convex, not Supabase, for runtime data.

Start a local Convex deployment from the `Backend/` directory:

```bash
npx convex dev
```

This will:
- start a local Convex deployment
- push the schema from `Backend/convex/schema.ts`
- generate/update Convex metadata in `Backend/convex/_generated`
- write local deployment settings to `.env.local`

This creates:
- `users` - User profiles
- `farms` - Farm information
- `sensors` - IoT sensor registry
- `sensor_data` - Time-series sensor readings
- `recommendations` - AI-generated recommendations
- `pest_detections` - Pest detection submissions
- `weather_data` - Cached weather data
- `system_config` - System configuration
- `audit_logs` - Audit trail
- `iot_device_tokens` - Device authentication
- `districts` - Rwanda administrative divisions

### 4. Seed Demo Data (Optional)
After Convex is running:
```bash
npm run seed
```

This creates:
- 30 Rwanda districts
- System configuration values
- Demo user (phone: +250788000001)
- Demo farm in Rwamagana
- 4 sensors (soil moisture, soil temp, ambient temp, humidity)
- 7 days of sensor readings
- Sample recommendations
- IoT device token for testing

### 5. Start the Server

**Backend development:**
```bash
npm run dev
```

**Frontend development:**
From `Frontend/`:
```bash
npm run dev
```

**Backend production:**
```bash
npm start
```

Services will start at:
- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health
- Backend API health: http://localhost:3000/api/health
- Backend API base: http://localhost:3000/api/v1
- Local Convex deployment: http://127.0.0.1:3210
- Local Convex dashboard: http://127.0.0.1:6790

### 6. Run Tests
```bash
npm test
```

---

## Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
CONVEX_URL=https://your-production-deployment.convex.cloud
CLERK_SECRET_KEY=your_production_clerk_key
# ... other production values
```

### Recommended Hosting
- **Node.js App:** Railway, Render, Fly.io, or AWS EC2
- **Database:** Convex Cloud
- **Images:** Cloudinary (already using)

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Health Check Endpoint
Use `/health` for load balancer health checks:
```json
{"status":"healthy","timestamp":"2025-01-15T10:30:00.000Z"}
```

---

## API Testing

### Using Postman
1. Import `docs/api-collection.json` into Postman
2. Set environment variable `auth_token` with a valid Clerk JWT
3. Test endpoints

### Using cURL

**Health check:**
```bash
curl http://localhost:3000/health
```

**USSD test:**
```bash
curl -X POST http://localhost:3000/api/v1/ussd/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "sessionId=test123&serviceCode=*123#&phoneNumber=%2B250788000001&text="
```

**IoT sensor ingest (after seeding):**
```bash
curl -X POST http://localhost:3000/api/v1/sensors/data/ingest \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: demo_device_001" \
  -H "X-Device-Token: DEMO_TOKEN_FOR_TESTING" \
  -d '{"readings":[{"sensorType":"soil_moisture","value":42.5,"unit":"percent"}]}'
```

The same endpoint also accepts `Authorization: Bearer DEMO_TOKEN_FOR_TESTING` instead of `X-Device-Token`, and HMAC-authenticated devices may send `X-Timestamp` in epoch seconds or milliseconds.

---

## Troubleshooting

### "column system_config.key does not exist"
**Solution:** The active backend no longer uses Supabase schema setup for runtime data. Start Convex with `npx convex dev` and ensure `CONVEX_URL` is correct.

### "Database service unavailable" / backend health shows database disconnected
**Solution:** Ensure the local Convex deployment is running on `127.0.0.1:3210`:
```bash
npx convex dev
```

### "Failed to verify user" / 401 errors
**Solution:** Ensure Clerk JWT token is valid and included in Authorization header.

### Rate limiting (429 errors)
**Solution:** Wait 15 minutes or reduce request frequency.

### SMS not sending
**Solution:** Check Africa's Talking sandbox credentials in .env. For production, verify API key and shortcode.

---

## Support Files

| File | Description |
|------|-------------|
| `docs/api-collection.json` | Postman collection |
| `docs/API_DOCUMENTATION.md` | Full API documentation |
| `convex/schema.ts` | Active Convex schema |
| `src/database/seed.js` | Demo data seeder |
| `tests/api.test.js` | Integration tests |

---

*Smart Maize Farming System v1.0.0*
