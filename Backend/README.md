# 🌽 Smart Maize Farming System - Backend API

IoT-Based Smart Maize Farming System for Rwanda providing AI-driven decision support for irrigation optimization and Fall Armyworm detection for smallholder farmers.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [IoT Device Integration](#iot-device-integration)
- [SMS/USSD Integration](#smsussd-integration)
- [Deployment](#deployment)

## Overview

This backend system serves as the core infrastructure for the Smart Maize Farming System, designed specifically for smallholder maize farmers in Rwanda. It provides:

- **Real-time Sensor Data Collection**: Ingest and process data from IoT sensors (soil moisture, temperature, humidity)
- **AI-Driven Recommendations**: Intelligent irrigation scheduling and pest detection
- **Multi-Channel Communication**: SMS alerts, USSD menus, and web interface support
- **Expert Support System**: Connect farmers with agricultural experts

## Features

### 🌱 Farm Management
- Farm registration with GPS coordinates
- Field/zone mapping
- Crop growth stage tracking
- District-based organization

### 📡 Sensor Integration
- Real-time sensor data ingestion
- Data validation and quality flags
- Automatic anomaly detection
- Daily aggregates and trends

### 🤖 AI/ML Integration
- Irrigation optimization analysis
- Fall Armyworm (FAW) detection via image analysis
- Nutrient deficiency detection
- Weather-based recommendations

### 🔔 Notifications
- SMS alerts via Africa's Talking
- USSD menu access for feature phones
- Priority-based message queuing
- Kinyarwanda language support

### 📊 Analytics
- Farmer dashboard with key metrics
- Expert/Admin system overview
- District-level analytics
- Outbreak mapping

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Database | Convex |
| Authentication | Clerk |
| File Storage | Cloudinary |
| SMS/USSD | Africa's Talking |
| Weather Data | OpenWeatherMap API |
| Caching | Redis (optional) |

## Project Structure

```
Backend/
├── src/
│   ├── config/
│   │   └── index.js           # Centralized configuration
│   ├── database/
│   │   ├── convex.js          # Convex client setup
│   │   ├── schema.sql         # Database schema
│   │   └── migrate.js         # Migration runner
│   ├── middleware/
│   │   ├── auth.js            # Clerk authentication
│   │   ├── deviceAuth.js      # IoT device authentication
│   │   ├── validation.js      # Request validation
│   │   ├── errorHandler.js    # Error handling
│   │   └── rateLimiter.js     # Rate limiting
│   ├── services/
│   │   ├── userService.js     # User management
│   │   ├── farmService.js     # Farm operations
│   │   ├── sensorService.js   # Sensor data processing
│   │   ├── weatherService.js  # Weather API integration
│   │   ├── recommendationService.js  # Recommendation engine
│   │   ├── notificationService.js    # SMS/USSD handling
│   │   ├── ussdService.js     # USSD menu handling
│   │   ├── fertilizerService.js     # Fertilization recommendations
│   │   ├── schedulerService.js      # Scheduled tasks (cron)
│   │   ├── imageService.js    # Cloudinary integration
│   │   └── aiService.js       # AI/ML model integration
│   ├── routes/
│   │   ├── users.js           # User endpoints
│   │   ├── farms.js           # Farm endpoints
│   │   ├── sensors.js         # Sensor endpoints
│   │   ├── recommendations.js # Recommendation endpoints
│   │   ├── pest-detection.js  # Pest detection endpoints
│   │   ├── weather.js         # Weather endpoints
│   │   ├── analytics.js       # Analytics endpoints
│   │   ├── admin.js           # Admin endpoints
│   │   └── ussd.js            # USSD callbacks
│   ├── utils/
│   │   ├── logger.js          # Winston logging
│   │   ├── errors.js          # Custom error classes
│   │   └── response.js        # Response helpers
│   └── index.js               # Application entry point
├── logs/                       # Log files
├── .env.example               # Environment template
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Convex deployment
- Clerk account
- Cloudinary account
- Africa's Talking account
- OpenWeatherMap API key

### Installation

1. **Clone the repository**
   ```bash
   cd Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Initialize database**
   ```bash
   # Set CONVEX_URL and deploy Convex functions/schema
   npx convex dev
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Start production server**
   ```bash
   npm start
   ```

## Environment Variables

```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Convex Configuration
CONVEX_URL=https://your-team.your-project.convex.cloud

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
ADMIN_BOOTSTRAP_EMAILS=admin@your-domain.com

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Africa's Talking
AT_USERNAME=your-username
AT_API_KEY=your-api-key
AT_SENDER_ID=SMARTMAIZE
AT_USSD_CODE=*123#

# OpenWeatherMap
OPENWEATHER_API_KEY=your-api-key

# AI/ML Service (Optional)
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_API_KEY=your-ai-key

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All authenticated endpoints require a Bearer token:
```
Authorization: Bearer <clerk_jwt_token>
```

### Core Endpoints

#### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/me` | Get current user profile | User |
| PUT | `/users/me` | Update profile | User |
| GET | `/users` | List all users | Admin |
| PUT | `/users/:id/role` | Update user role | Admin |

#### Farms
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/farms` | List user's farms | User |
| POST | `/farms` | Create new farm | User |
| GET | `/farms/:id` | Get farm details | Owner |
| PUT | `/farms/:id` | Update farm | Owner |
| GET | `/farms/:id/summary` | Get complete farm data | Owner |

#### Sensors
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/sensors/farm/:farmId` | List farm sensors | Owner |
| POST | `/sensors/data/ingest` | Ingest sensor data | Device |
| GET | `/sensors/data/farm/:farmId` | Get sensor readings | Owner |
| GET | `/sensors/data/farm/:farmId/latest` | Get latest readings | Owner |

#### Recommendations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/recommendations/farm/:farmId` | List recommendations | Owner |
| GET | `/recommendations/farm/:farmId/active` | Active recommendations | Owner |
| POST | `/recommendations/:id/respond` | Respond (accept/reject) | Owner |

#### Pest Detection
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/pest-detection/upload/:farmId` | Upload pest image | Owner |
| GET | `/pest-detection/farm/:farmId` | List detections | Owner |
| POST | `/pest-detection/:id/review` | Expert review | Expert |

#### Weather
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/weather/farm/:farmId/current` | Current weather | Owner |
| GET | `/weather/farm/:farmId/forecast` | 5-day forecast | Owner |
| GET | `/weather/farm/:farmId/farming-conditions` | Farming assessment | Owner |

#### Analytics
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/analytics/farm/:farmId/dashboard` | Farmer dashboard | Owner |
| GET | `/analytics/system/overview` | System overview | Expert |

#### Admin
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List all users | Admin |
| PUT | `/admin/users/:id/role` | Update user role | Admin |
| GET | `/admin/sensors/health` | Sensor health status | Admin |
| GET | `/admin/recommendations/stats` | Recommendation stats | Admin |
| GET | `/admin/messages/queue` | Message queue status | Admin |
| POST | `/admin/system/maintenance` | Trigger maintenance | Admin |

#### USSD
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/ussd/callback` | Africa's Talking callback | Public |

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [ ... ]
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Database Schema

### Core Tables
- `users` - User accounts with roles (farmer, expert, admin)
- `farms` - Farm records with location and size
- `sensors` - IoT sensor registration
- `sensor_data` - Time-series sensor readings
- `weather_data` - Weather records per farm
- `pest_detections` - Pest detection records with images
- `irrigation_schedules` - Irrigation planning
- `fertilization_schedules` - Fertilization planning
- `recommendations` - AI-generated recommendations
- `messages` - SMS/notification history

### Security
- Row Level Security (RLS) policies enforce data access
- Users can only access their own farms and data
- Experts can view but not modify farmer data
- Admins have full access

## Authentication

### User Authentication (Clerk)
```javascript
// Frontend: Get token
const token = await clerk.session.getToken();

// Request with token
fetch('/api/v1/farms', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Role-Based Access
| Role | Permissions |
|------|-------------|
| farmer | Own farms, sensors, recommendations |
| expert | View all farms, review detections, create recommendations |
| admin | Full system access, user management |

## IoT Device Integration

### Device Authentication
IoT devices authenticate using device tokens with HMAC signatures:

```javascript
// Headers required for IoT endpoints
{
  "X-Device-ID": "device_abc123",
  "X-Device-Token": "generated_token",
  "X-Timestamp": "1699459200",
  "X-Signature": "hmac_sha256_signature"
}
```

### Data Ingestion Format
```json
POST /api/v1/sensors/data/ingest
{
  "readings": [
    {
      "sensorType": "soil_moisture",
      "value": 45.2,
      "unit": "percent",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Supported Sensor Types
- `soil_moisture` - Soil moisture percentage
- `soil_temperature` - Soil temperature (°C)
- `air_temperature` - Air temperature (°C)
- `humidity` - Air humidity percentage
- `rainfall` - Rainfall (mm)
- `light` - Light intensity (lux)

## SMS/USSD Integration

### SMS Alerts
The system sends SMS alerts for:
- Critical irrigation needs
- Pest detection alerts
- Weather warnings
- Recommendation notifications

### USSD Menu (*123#)
```
1. Inama (Recommendations)
   ├── 1. Kuhira (Irrigation)
   ├── 2. Ifumbire (Fertilization)
   ├── 3. Ibyonnyi (Pest Control)
   └── 0. Subira Inyuma (Back)
   
2. Imirima (Farm Status)
   └── View sensor data, soil moisture, temperature
   
3. Ikirere (Weather)
   └── Current conditions and 3-day forecast
   
4. Igenamiterere (Settings)
   ├── 1. Hindura Ururimi (Change Language)
   └── 0. Subira Inyuma (Back)
   
0. Sohoka (Exit)
```

**Supported Languages:**
- English (en)
- Kinyarwanda (rw) - Default
- French (fr)

### Africa's Talking Callback
Configure your USSD callback URL:
```
https://your-domain.com/api/v1/ussd/callback
```

## Deployment

### Scheduled Tasks
The system runs automated background tasks using node-cron:

| Task | Schedule | Description |
|------|----------|-------------|
| Weather Updates | Every 30 min | Fetch latest weather for all farms |
| Daily Recommendations | 6:00 AM | Generate irrigation/fertilization recommendations |
| Sensor Health Check | Every 15 min | Monitor sensor connectivity |
| Notification Processing | Every 5 min | Send queued SMS messages |
| Recommendation Expiry | Midnight | Expire old pending recommendations |
| Irrigation Analysis | Every 2 hours | AI-driven irrigation analysis |
| Data Cleanup | 2:00 AM weekly | Archive old sensor data |
| Daily Summaries | 6:00 PM | Send daily farm summary SMS |

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure production database
- [ ] Set up SSL/TLS
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up monitoring/logging
- [ ] Configure backup strategy

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

### Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed API health
curl http://localhost:3000/api/health
```

## Support

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Error Codes
| Code | Description |
|------|-------------|
| `AUTH_REQUIRED` | Authentication token missing |
| `INVALID_TOKEN` | Invalid or expired token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMITED` | Too many requests |
| `DEVICE_AUTH_FAILED` | IoT device authentication failed |

### Fertilization Recommendations
The system provides NPK-based fertilization recommendations:

| Fertilizer | N-P-K | Use Case |
|------------|-------|----------|
| DAP | 18-46-0 | Planting, phosphorus boost |
| UREA | 46-0-0 | Nitrogen boost, vegetative |
| NPK | 17-17-17 | Balanced nutrition |
| MOP | 0-0-60 | Potassium, grain filling |
| TSP | 0-46-0 | Phosphorus deficiency |
| CAN | 27-0-0 | Side dressing nitrogen |

### Maize Growth Stages
| Stage | Days | Key Requirements |
|-------|------|------------------|
| Germination | 0-14 | Adequate moisture, warm soil |
| Vegetative | 15-45 | High nitrogen, regular watering |
| Tasseling | 46-65 | Peak water demand, balanced NPK |
| Grain Fill | 66-90 | Potassium, consistent moisture |
| Maturity | 91+ | Reduced irrigation, dry down |

For technical support or questions about the Smart Maize Farming System:
- Email: support@smartmaize.rw
- Documentation: https://docs.smartmaize.rw
- Issues: GitHub Issues

---

**Built for Rwanda's smallholder farmers** 🇷🇼

*Empowering agricultural decision-making through technology*

