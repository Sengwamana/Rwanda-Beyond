# Smart Maize Farming System API Documentation

## Overview

The Smart Maize Farming System provides an IoT-based decision support API for smallholder maize farmers in Rwanda. It features AI-driven irrigation optimization, Fall Armyworm detection, real-time sensor data collection, and accessible communication through SMS/USSD channels.

**Base URL:** `http://localhost:3000/api/v1`  
**Version:** 1.0.0

---

## Authentication

The API uses **Clerk JWT authentication**. Include the bearer token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Public Endpoints (No Auth Required)
- `GET /health` - Basic health check
- `GET /api/health` - API health check
- `GET /api` - API documentation
- `POST /api/v1/ussd/callback` - USSD callback (Africa's Talking)
- `POST /api/v1/sensors/data/ingest` - IoT sensor data (device token auth)

### Role-Based Access
| Role | Permissions |
|------|-------------|
| `farmer` | Manage own farms, view recommendations, submit pest images |
| `expert` | All farmer permissions + review pest detections |
| `admin` | Full system access including config and metrics |

---

## Response Format

All responses follow this structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Farm name is required",
    "details": { ... }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Error Codes

| HTTP Code | Error Code | Description |
|-----------|------------|-------------|
| 400 | VALIDATION_ERROR | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | External service unavailable |

---

## API Endpoints

### Health & Documentation

#### GET /health
Basic server health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### GET /api
Returns complete API documentation including all available endpoints.

---

### Users

#### GET /api/v1/users/me
Get current authenticated user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clerk_id": "user_abc123",
    "full_name": "Jean Pierre",
    "phone_number": "+250788123456",
    "preferred_language": "rw",
    "role": "farmer",
    "farms_count": 2,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

#### PUT /api/v1/users/me
Update current user profile.

**Request Body:**
```json
{
  "full_name": "Jean Pierre Habimana",
  "preferred_language": "en",
  "notification_preferences": {
    "sms": true,
    "push": false
  }
}
```

#### GET /api/v1/users/stats
Get user statistics including farm counts, sensor counts, and recommendation metrics.

---

### Farms

#### GET /api/v1/farms
List all farms owned by the authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page |

#### POST /api/v1/farms
Create a new farm.

**Request Body:**
```json
{
  "name": "Gishari Maize Farm",
  "district": "Rwamagana",
  "sector": "Gishari",
  "cell": "Rubona",
  "village": "Nyarubuye",
  "size_hectares": 1.5,
  "location": {
    "lat": -1.9403,
    "lng": 30.4389
  },
  "crop_type": "maize",
  "planting_date": "2025-01-01"
}
```

**Response:** (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Gishari Maize Farm",
    "district": "Rwamagana",
    "sector": "Gishari",
    "cell": "Rubona",
    "village": "Nyarubuye",
    "size_hectares": 1.5,
    "location": { "lat": -1.9403, "lng": 30.4389 },
    "crop_type": "maize",
    "planting_date": "2025-01-01",
    "current_growth_stage": "seedling",
    "is_active": true,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/v1/farms/:farmId
Get detailed farm information.

#### PUT /api/v1/farms/:farmId
Update farm details.

#### DELETE /api/v1/farms/:farmId
Soft delete a farm (sets is_active to false).

#### GET /api/v1/farms/:farmId/summary
Get farm summary with latest sensor readings, active recommendations, and weather.

#### GET /api/v1/farms/districts
Get list of all Rwanda districts.

---

### Sensors

#### GET /api/v1/sensors/farm/:farmId
List all sensors registered to a farm.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sensor_type": "soil_moisture",
      "device_id": "SM-001",
      "location_on_farm": "Field A - Center",
      "status": "active",
      "battery_level": 85,
      "last_reading_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### GET /api/v1/sensors/data/farm/:farmId
Get sensor data for a farm with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 50 | Items per page |
| sensor_type | string | all | Filter by sensor type |
| start_date | date | 7 days ago | Start of date range |
| end_date | date | now | End of date range |

#### GET /api/v1/sensors/data/farm/:farmId/latest
Get latest readings from all farm sensors.

#### GET /api/v1/sensors/data/farm/:farmId/aggregates
Get daily aggregated sensor data (min, max, avg).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 7 | Number of days |

#### POST /api/v1/sensors/data/ingest
**[IoT Endpoint - Device Token Auth]**

Ingest sensor readings from IoT devices.

**Headers:**
```http
X-Device-ID: device_001
X-Device-Token: your_device_token
X-Timestamp: 1705312200
```

**Request Body:**
```json
{
  "readings": [
    {
      "sensorType": "soil_moisture",
      "value": 42.5,
      "unit": "percent"
    },
    {
      "sensorType": "soil_temperature",
      "value": 24.3,
      "unit": "celsius"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "received": 2,
    "processed": 2,
    "failed": 0
  }
}
```

---

### Recommendations

#### GET /api/v1/recommendations/farm/:farmId
List all recommendations for a farm.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| limit | integer | 20 | Items per page |
| type | string | all | Filter: irrigation, pest, general |
| status | string | all | Filter: pending, accepted, declined, expired |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "irrigation",
      "priority": "high",
      "title": "Irrigation Recommended",
      "title_rw": "Kuhira birasabwa",
      "description": "Soil moisture is low at 28%. Recommend irrigation within 24 hours.",
      "description_rw": "Ubutaka burafite umwuka muke. Birasabwa kuhira mu masaha 24.",
      "trigger_data": {
        "soil_moisture": 28,
        "threshold": 35,
        "weather_forecast": "no_rain_48h"
      },
      "status": "pending",
      "expires_at": "2025-01-16T10:30:00.000Z",
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

#### GET /api/v1/recommendations/farm/:farmId/active
Get only pending (active) recommendations.

#### POST /api/v1/recommendations/:recommendationId/respond
Respond to a recommendation.

**Request Body:**
```json
{
  "action": "accept",
  "reason": "Will irrigate tomorrow morning"
}
```

| Action | Description |
|--------|-------------|
| accept | Farmer accepts the recommendation |
| decline | Farmer declines with reason |
| defer | Postpone for later |

---

### Pest Detection

#### POST /api/v1/pest-detection/upload/:farmId
Upload images for pest detection analysis.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| images | file[] | Yes | Up to 5 images (max 10MB each) |
| notes | string | No | Farmer observations |
| severity | string | No | Perceived severity: low, medium, high |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "analyzing",
    "images": [
      {
        "url": "https://cloudinary.com/...",
        "thumbnail_url": "https://cloudinary.com/..."
      }
    ],
    "ai_analysis": null,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/v1/pest-detection/farm/:farmId
List all pest detection submissions for a farm.

#### GET /api/v1/pest-detection/:detectionId
Get detailed pest detection result.

**Response (after AI analysis):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending_review",
    "ai_analysis": {
      "detected_pest": "Fall Armyworm",
      "confidence": 0.89,
      "severity_estimate": "medium",
      "affected_area_estimate": "15-20%",
      "recommendations": [
        "Apply recommended pesticide within 48 hours",
        "Check surrounding plants for spread"
      ]
    },
    "expert_review": null,
    "images": [ ... ],
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### POST /api/v1/pest-detection/:detectionId/review
**[Expert Role Required]**

Submit expert review for a pest detection.

**Request Body:**
```json
{
  "confirmedPest": "Fall Armyworm",
  "confirmedSeverity": "high",
  "status": "confirmed",
  "expertNotes": "Confirmed FAW infestation in vegetative stage. Immediate action required.",
  "treatmentRecommendations": [
    "Apply Emamectin Benzoate at recommended dosage",
    "Spray early morning or late evening",
    "Re-inspect after 7 days"
  ]
}
```

---

### Weather

#### GET /api/v1/weather/farm/:farmId/current
Get current weather conditions for farm location.

**Response:**
```json
{
  "success": true,
  "data": {
    "temperature": 24.5,
    "humidity": 72,
    "description": "Partly cloudy",
    "wind_speed": 12,
    "wind_direction": "NE",
    "pressure": 1015,
    "uv_index": 6,
    "feels_like": 25.2,
    "visibility": 10000,
    "retrieved_at": "2025-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/v1/weather/farm/:farmId/forecast
Get weather forecast for farm location.

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| days | integer | 5 | 7 | Forecast days |

#### GET /api/v1/weather/farm/:farmId/farming-conditions
Get AI-analyzed farming conditions based on weather.

**Response:**
```json
{
  "success": true,
  "data": {
    "current_conditions": "favorable",
    "spraying_suitable": true,
    "irrigation_needed": false,
    "frost_risk": false,
    "heat_stress_risk": false,
    "rainfall_expected_24h": 0,
    "recommendations": [
      "Good conditions for field activities",
      "Monitor soil moisture levels"
    ]
  }
}
```

#### GET /api/v1/weather/farm/:farmId/irrigation-window
Get optimal irrigation timing recommendation.

---

### Analytics

#### GET /api/v1/analytics/farm/:farmId/dashboard
Get comprehensive farmer dashboard data.

**Response:**
```json
{
  "success": true,
  "data": {
    "farm_health_score": 85,
    "active_alerts": 1,
    "pending_recommendations": 2,
    "sensor_status": {
      "total": 4,
      "active": 4,
      "offline": 0
    },
    "latest_readings": { ... },
    "weather_summary": { ... },
    "recent_activity": [ ... ]
  }
}
```

#### GET /api/v1/analytics/farm/:farmId/sensor-trends
Get sensor data trends for visualization.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 7 | Number of days |
| interval | string | hour | Aggregation: hour, day |

#### GET /api/v1/analytics/system/overview
**[Admin Role Required]**

Get system-wide analytics overview.

---

### AI Services (Google Gemini Powered)

The AI endpoints provide intelligent agricultural assistance powered by Google Gemini.

#### GET /api/v1/ai/health
**[Public]**

Check AI service health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "provider": "gemini",
    "model": "gemini-1.5-flash",
    "lastChecked": "2025-01-15T10:30:00.000Z"
  }
}
```

#### GET /api/v1/ai/capabilities
**[Public]**

Get AI service capabilities and supported features.

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "Google Gemini",
    "model": "gemini-1.5-flash",
    "features": [
      {
        "name": "Agricultural Advice",
        "endpoint": "/api/v1/ai/advice",
        "description": "Get expert agricultural guidance for maize farming"
      }
    ],
    "supportedLanguages": ["English", "Kinyarwanda (partial)"],
    "supportedCrops": ["Maize"],
    "regions": ["Rwanda - All Districts"]
  }
}
```

#### POST /api/v1/ai/advice
**[Authenticated]**

Get AI-powered agricultural advice.

**Request Body:**
```json
{
  "question": "What is the best time to plant maize in Kigali?",
  "context": {
    "cropType": "maize",
    "location": "Kigali",
    "growthStage": "planning"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "answer": "The optimal planting time for maize in Kigali is...",
    "suggestions": ["Consider soil preparation", "Check weather forecast"],
    "relatedTopics": ["Seed Selection", "Fertilization"],
    "confidence": 0.92,
    "aiProvider": "gemini"
  }
}
```

#### POST /api/v1/ai/analyze-image
**[Authenticated]**

Analyze farm/crop image for general health assessment.

**Request Body:**
```json
{
  "imageUrl": "https://res.cloudinary.com/...",
  "context": {
    "cropType": "maize",
    "expectedGrowthStage": "vegetative"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallHealth": "good",
    "observations": ["Healthy leaf color", "Good plant spacing"],
    "issues": [],
    "recommendations": ["Continue current care routine"],
    "growthStageEstimate": "V6 (6-leaf stage)",
    "confidence": 0.88,
    "aiProvider": "gemini"
  }
}
```

#### POST /api/v1/ai/chat
**[Authenticated]**

Interactive chat with agricultural AI assistant.

**Request Body:**
```json
{
  "message": "My maize leaves are turning yellow",
  "conversationHistory": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hello! How can I help you today?"}
  ],
  "farmId": "uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reply": "Yellow leaves can indicate nitrogen deficiency...",
    "suggestions": ["Check soil nutrients", "Consider fertilization"],
    "confidence": 0.85
  }
}
```

#### POST /api/v1/ai/translate
**[Public - Rate Limited]**

Translate agricultural terms between English and Kinyarwanda.

**Request Body:**
```json
{
  "text": "maize farming",
  "targetLanguage": "rw"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": "maize farming",
    "translated": "ubuhinzi bw'ibigori",
    "targetLanguage": "rw"
  }
}
```

---

### USSD

#### POST /api/v1/ussd/callback
**[Africa's Talking Callback]**

Handle USSD session callbacks.

**Request:** `application/x-www-form-urlencoded`

| Field | Description |
|-------|-------------|
| sessionId | Unique session identifier |
| serviceCode | USSD service code |
| phoneNumber | User phone number |
| text | User input (empty for initial request) |

**Response:** Plain text USSD menu

```
CON Welcome to Smart Maize Farming / Murakaza neza
Select option / Hitamo:
1. Soil Status / Imiterere y'ubutaka
2. Weather / Ikirere
3. Recommendations / Inama
4. Report Pest / Kumenyesha indwara
5. Change Language / Guhindura ururimi
```

#### GET /api/v1/ussd/health
USSD service health check.

---

### Admin

#### GET /api/v1/admin/config
**[Admin Role Required]**

Get all system configuration values.

#### PUT /api/v1/admin/config/:key
Update a configuration value.

**Request Body:**
```json
{
  "value": "0.80",
  "description": "Updated confidence threshold"
}
```

#### GET /api/v1/admin/health
Get detailed system health including database, external services, and memory usage.

#### GET /api/v1/admin/metrics
Get system metrics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | 24h | Time period: 1h, 24h, 7d, 30d |

#### GET /api/v1/admin/audit-logs
Get system audit logs with filtering.

#### POST /api/v1/admin/devices/generate
Generate a new IoT device authentication token.

**Request Body:**
```json
{
  "farmId": "uuid",
  "deviceName": "Soil Sensor Node A",
  "expiresInDays": 365
}
```

---

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Standard API | 100 requests / 15 minutes |
| IoT Ingest | 1000 requests / minute |
| Auth endpoints | 10 requests / 15 minutes |

When rate limited, response includes:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests, please try again later",
    "retryAfter": 60
  }
}
```

---

## Webhooks (Future)

The system will support webhooks for:
- New recommendation generated
- Pest detection completed
- Sensor alert triggered
- Farm status change

---

## SDK & Examples

### cURL Examples

**Get current user:**
```bash
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Create farm:**
```bash
curl -X POST http://localhost:3000/api/v1/farms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Farm",
    "district": "Rwamagana",
    "sector": "Gishari",
    "size_hectares": 1.0,
    "location": {"lat": -1.94, "lng": 30.44}
  }'
```

**IoT sensor data ingest:**
```bash
curl -X POST http://localhost:3000/api/v1/sensors/data/ingest \
  -H "X-Device-ID: device_001" \
  -H "X-Device-Token: YOUR_DEVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"sensorType": "soil_moisture", "value": 45.2, "unit": "percent"}
    ]
  }'
```

---

## Support

For API support or issues:
- Documentation: `/api`
- Health Check: `/health`
- Status: Check Supabase dashboard

---

*Last Updated: January 2025*
