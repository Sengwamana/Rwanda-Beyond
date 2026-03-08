# Frontend-Backend Integration Guide
## Smart Maize Farming System

This document provides a comprehensive guide for the integration between the React frontend and Node.js backend of the Smart Maize Farming System.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication Flow](#authentication-flow)
3. [API Communication](#api-communication)
4. [WebSocket Integration](#websocket-integration)
5. [State Management](#state-management)
6. [Caching Strategy](#caching-strategy)
7. [Image Upload Flow](#image-upload-flow)
8. [Environment Configuration](#environment-configuration)
9. [Error Handling](#error-handling)
10. [Security Considerations](#security-considerations)
11. [Testing](#testing)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │   React   │  │ React Query  │  │   Zustand     │  │ WebSocket │ │
│  │   Views   │  │   (Cache)    │  │   (Store)     │  │  Client   │ │
│  └─────┬─────┘  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘ │
│        │               │                  │                │       │
│        └───────────────┼──────────────────┼────────────────┘       │
│                        │                  │                        │
│               ┌────────┴──────────────────┴────────┐               │
│               │         API Client (Axios)          │               │
│               │    + Clerk Auth Token Injection     │               │
│               └────────────────┬────────────────────┘               │
└────────────────────────────────┼────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     HTTP/WS Transport   │
                    └────────────┬────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────┐
│                           BACKEND                                    │
│               ┌────────────────┴────────────────┐                   │
│               │         Express Server          │                   │
│               │     + Clerk JWT Verification    │                   │
│               └────────────────┬────────────────┘                   │
│        ┌───────────────────────┼───────────────────────┐            │
│        │                       │                       │            │
│  ┌─────┴─────┐          ┌──────┴──────┐         ┌──────┴──────┐    │
│  │   REST    │          │  WebSocket  │         │  Middleware │    │
│  │  Routes   │          │   Server    │         │  (Auth,etc) │    │
│  └─────┬─────┘          └──────┬──────┘         └─────────────┘    │
│        │                       │                                    │
│  ┌─────┴───────────────────────┴─────┐                             │
│  │            Services               │                             │
│  │ (Farm, Sensor, Weather, AI, etc.) │                             │
│  └─────────────────┬─────────────────┘                             │
│                    │                                                │
│  ┌─────────────────┴─────────────────┐                             │
│  │           Data Layer              │                             │
│  │    Convex + External APIs       │                             │
│  └───────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Overview

The system uses **Clerk** for authentication with JWT tokens shared between frontend and backend.

### Frontend Authentication Setup

```typescript
// App.tsx
import { ClerkProvider } from '@clerk/clerk-react';
import { AuthProvider } from './components/AuthProvider';
import { QueryProvider } from './config/queryClient';

function App() {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey}>
      <QueryProvider>
        <AuthProvider>
          {/* Your app components */}
        </AuthProvider>
      </QueryProvider>
    </ClerkProvider>
  );
}
```

### Token Flow

1. User signs in via Clerk
2. `AuthProvider` detects sign-in and:
   - Gets JWT token from Clerk
   - Configures API client with token getter
   - Updates Zustand store with user data
   - Establishes WebSocket connection with token

```typescript
// Token injection in API client
configureAuth(
  async () => await getToken(),           // Token getter
  async () => await getToken({ skipCache: true })  // Token refresh
);
```

### Backend Token Verification

```javascript
// middleware/auth.js
const { verifyToken } = require('@clerk/backend');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  try {
    const session = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    req.userId = session.sub;
    req.sessionClaims = session;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Role-Based Access Control

```typescript
// Frontend - ProtectedRoute component
<ProtectedRoute allowedRoles={['admin', 'expert']}>
  <AdminDashboard />
</ProtectedRoute>

// Frontend - useRoleAccess hook
const { hasRole, isAdmin, isFarmer } = useRoleAccess();
if (hasRole(['admin', 'expert'])) {
  // Show admin features
}
```

---

## API Communication

### API Client Configuration

Location: `Frontend/services/apiClient.ts`

Features:
- Automatic token injection via interceptors
- Retry logic with exponential backoff
- Error categorization
- Request ID tracing
- File upload support

### Making API Requests

```typescript
import { api } from '../services/apiClient';

// GET request
const farms = await api.get<Farm[]>('/farms');

// POST request
const newFarm = await api.post<Farm>('/farms', {
  name: 'My Farm',
  location: { latitude: 1.23, longitude: 4.56 }
});

// File upload
const result = await api.upload<PestScan>('/pest-detection/analyze', formData);
```

### Using React Query Hooks

Location: `Frontend/hooks/useApiHooks.ts`

```typescript
import { useFarms, useCreateFarm, useLatestSensorReadings } from '../hooks/useApiHooks';

function FarmDashboard() {
  // Fetch farms with caching
  const { data: farms, isLoading } = useFarms();
  
  // Create mutation with cache invalidation
  const createFarm = useCreateFarm();
  
  // Real-time sensor data with auto-refresh
  const { data: readings } = useLatestSensorReadings('farm-123');
  
  const handleCreateFarm = async () => {
    await createFarm.mutateAsync({ name: 'New Farm', ... });
  };
}
```

### API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Farms | `GET /farms` | List user's farms |
| Farms | `POST /farms` | Create new farm |
| Farms | `GET /farms/:id` | Get farm details |
| Sensors | `GET /sensors/farms/:farmId/latest` | Latest readings |
| Weather | `GET /weather/farms/:farmId/current` | Current weather |
| Pest | `POST /pest-detection/analyze` | Upload pest image |
| Recommendations | `GET /recommendations/farms/:farmId` | Get recommendations |

---

## WebSocket Integration

### Overview

Real-time communication is handled via WebSocket for:
- Live sensor data updates
- Instant alerts and notifications
- Recommendation updates
- System health monitoring

### Frontend WebSocket Setup

Location: `Frontend/services/websocket.ts`

```typescript
import wsManager from '../services/websocket';

// Connect with authentication
wsManager.connect(token, userId, userRole);

// Subscribe to farm updates
wsManager.subscribeFarm('farm-123');

// Listen for events
wsManager.on('sensor:data', (data) => {
  console.log('Sensor update:', data);
});

// Cleanup
wsManager.unsubscribeFarm('farm-123');
wsManager.disconnect();
```

### React Hooks for WebSocket

Location: `Frontend/hooks/useWebSocket.ts`

```typescript
import { useSensorData, useAlerts, useWebSocketEvent } from '../hooks/useWebSocket';

function SensorMonitor({ farmId }: { farmId: string }) {
  // Auto-subscribes to farm on mount, unsubscribes on unmount
  const { readings, latestUpdate } = useSensorData(farmId);
  const { alerts, unreadCount } = useAlerts(farmId);
  
  // Custom event handler
  useWebSocketEvent('recommendation:new', (rec) => {
    showNotification(`New recommendation: ${rec.title}`);
  });
  
  return (
    <div>
      {readings.map(r => (
        <SensorCard key={r.sensorId} reading={r} />
      ))}
    </div>
  );
}
```

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `auth` | Client→Server | Authenticate connection |
| `subscribe:farm` | Client→Server | Subscribe to farm updates |
| `unsubscribe:farm` | Client→Server | Unsubscribe from farm |
| `sensor:data` | Server→Client | Sensor reading update |
| `alert:new` | Server→Client | New alert notification |
| `recommendation:new` | Server→Client | New recommendation |
| `weather:update` | Server→Client | Weather data update |
| `pest:result` | Server→Client | Pest detection result |
| `system:health` | Server→Client | System health status |

### Backend WebSocket Implementation

Location: `Backend/src/services/websocketService.js`

```javascript
const wsManager = require('./services/websocketService');

// Emit sensor data to farm subscribers
wsManager.emitSensorData('farm-123', {
  sensorId: 'sensor-1',
  value: 25.5,
  unit: '°C',
  timestamp: new Date().toISOString()
});

// Emit alert to specific users
wsManager.emitAlert('farm-123', {
  type: 'warning',
  title: 'High Temperature',
  message: 'Temperature exceeded 30°C'
});
```

---

## State Management

### Zustand Stores

Location: `Frontend/store/index.ts`

#### Auth Store
```typescript
const { user, isAuthenticated, setUser, logout } = useAuthStore();
```

#### App Store
```typescript
const { theme, language, toggleTheme, setLanguage } = useAppStore();
```

#### Farm Store
```typescript
const { farms, selectedFarm, setSelectedFarm } = useFarmStore();
```

#### Sensor Data Store (Real-time)
```typescript
const { latestReadings, connectionStatus } = useSensorDataStore();
```

#### Alert Store
```typescript
const { alerts, unreadCount, markAsRead } = useAlertStore();
```

### State Flow with WebSocket

```
WebSocket Event → Zustand Store → React Component Re-render
                       ↑
              React Query Cache
              (for HTTP data)
```

---

## Caching Strategy

### React Query Configuration

Location: `Frontend/config/queryClient.ts`

#### Stale Times

| Data Type | Stale Time | Rationale |
|-----------|------------|-----------|
| Sensors | 30s | Real-time, frequently changing |
| Alerts | 10s | Time-sensitive |
| Weather | 5 min | Updates hourly |
| Farms | 1 min | Moderately static |
| Recommendations | 2 min | AI-generated, periodic |
| Analytics | 10 min | Computed, expensive |
| Historical | 30 min | Historical, static |

#### Cache Invalidation

```typescript
import { invalidateQueries } from '../config/queryClient';

// After updating a farm
invalidateQueries.farm('farm-123');

// After receiving WebSocket alert
invalidateQueries.alerts('farm-123');

// Nuclear option
invalidateQueries.all();
```

#### Query Key Factories

```typescript
import { queryKeys } from '../config/queryClient';

// Consistent key generation
queryKeys.farms.detail('farm-123')      // ['farms', 'detail', 'farm-123']
queryKeys.sensors.latestReadings('f1')  // ['sensors', 'latest', 'f1']
queryKeys.weather.forecast('f1', 7)     // ['weather', 'forecast', 'f1', 7]
```

---

## Image Upload Flow

### Pest Detection Workflow

```
┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│  User takes  │────▶│   Validate   │────▶│   Compress    │
│    photo     │     │    image     │     │    image      │
└──────────────┘     └──────────────┘     └───────┬───────┘
                                                  │
                     ┌──────────────┐     ┌───────▼───────┐
                     │  Poll for    │◀────│   Upload to   │
                     │   result     │     │   backend     │
                     └──────┬───────┘     └───────────────┘
                            │
                     ┌──────▼───────┐     ┌───────────────┐
                     │   Display    │────▶│   Show        │
                     │   result     │     │ recommendations│
                     └──────────────┘     └───────────────┘
```

### Using the Image Service

```typescript
import { uploadPestImage, pollPestAnalysisResult } from '../services/imageService';

async function analyzePest(file: File, farmId: string) {
  // Upload with progress tracking
  const scan = await uploadPestImage(file, farmId, {
    compress: true,
    onProgress: (progress) => setUploadProgress(progress.percentage),
    location: { latitude: farm.lat, longitude: farm.lng }
  });
  
  // Poll for result
  const result = await pollPestAnalysisResult(scan.scanId, {
    onStatusUpdate: (status) => setAnalysisStatus(status)
  });
  
  return result;
}
```

---

## Environment Configuration

### Frontend (.env)

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws

# Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# Feature Flags
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_VOICE_ASSISTANT=true
VITE_ENABLE_OFFLINE_MODE=false

# Cache Configuration (seconds)
VITE_SENSOR_CACHE_TTL=30
VITE_WEATHER_CACHE_TTL=300
VITE_FARM_CACHE_TTL=60
```

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=3000

# Database
CONVEX_URL=https://your-team.your-project.convex.cloud

# Authentication
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# External Services
CLOUDINARY_CLOUD_NAME=xxx
OPENWEATHERMAP_API_KEY=xxx
AT_API_KEY=xxx

# Security
CORS_ORIGINS=http://localhost:5173
```

### Using Environment Config

```typescript
import env from '../config/env';

// Access typed configuration
if (env.enableWebSocket) {
  wsManager.connect(token, userId, role);
}

const cacheTTL = env.sensorCacheTTL * 1000;
```

---

## Error Handling

### Error Categories

| Category | Status Code | Action |
|----------|-------------|--------|
| NETWORK | - | Retry with backoff |
| AUTHENTICATION | 401 | Trigger logout |
| AUTHORIZATION | 403 | Show access denied |
| VALIDATION | 400, 422 | Show form errors |
| RATE_LIMIT | 429 | Wait and retry |
| SERVER | 5xx | Show generic error |

### Handling in Components

```typescript
import { formatError, categorizeError } from '../services/apiClient';

try {
  await api.post('/farms', data);
} catch (error) {
  const category = categorizeError(error);
  
  switch (category) {
    case 'VALIDATION':
      setFormErrors(error.response.data.errors);
      break;
    case 'AUTHENTICATION':
      // AuthProvider handles logout
      break;
    default:
      showToast({ type: 'error', message: formatError(error) });
  }
}
```

### React Query Error Handling

```typescript
const { data, error, isError } = useFarms();

if (isError) {
  return <ErrorDisplay error={error} />;
}
```

---

## Security Considerations

### Token Security
- Tokens stored in memory (not localStorage for production)
- Short expiration with automatic refresh
- HTTPS required in production

### CORS Configuration
```javascript
// Backend
app.use(cors({
  origin: process.env.CORS_ORIGINS.split(','),
  credentials: true
}));
```

### Rate Limiting
- 100 requests per 15 minutes per user
- Stricter limits on auth endpoints

### Input Validation
- Zod schemas on frontend
- Joi/express-validator on backend
- Sanitize all user inputs

---

## Testing

### Running Tests

```bash
# Frontend
cd Frontend
npm test              # Run all tests
npm run test:coverage # With coverage

# Backend
cd Backend
npm test
```

### Test Structure

```
Frontend/tests/
├── integration.test.ts    # API, WebSocket, Auth tests
├── components/            # Component tests
└── hooks/                 # Hook tests

Backend/tests/
├── api.test.js           # API endpoint tests
└── setup.js              # Test configuration
```

---

## Troubleshooting

### Common Issues

#### "401 Unauthorized" on API calls
1. Check if Clerk token is present
2. Verify CLERK_SECRET_KEY on backend
3. Check token expiration

#### WebSocket not connecting
1. Verify VITE_WS_URL matches backend
2. Check if backend WebSocket is running
3. Ensure authentication token is valid

#### Stale data after mutation
1. Ensure invalidateQueries is called
2. Check query key matches
3. Verify React Query devtools

#### Image upload failing
1. Check file size (max 10MB)
2. Verify image format (JPEG, PNG, WebP)
3. Check Cloudinary configuration

### Debug Mode

Enable debug logging:
```env
# Frontend
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug

# Backend
LOG_LEVEL=debug
```

### Health Checks

- API: `GET /health`
- WebSocket: Monitor `system:health` events
- Frontend: React Query Devtools

---

## Quick Reference

### Import Paths

```typescript
// API
import { api, formatError } from '../services/apiClient';

// WebSocket
import wsManager from '../services/websocket';
import { useSensorData, useAlerts } from '../hooks/useWebSocket';

// React Query
import { useFarms, useCreateFarm } from '../hooks/useApiHooks';
import { queryKeys, invalidateQueries } from '../config/queryClient';

// Store
import { useAuthStore, useFarmStore, useAlertStore } from '../store';

// Auth
import { useAuthContext, useRoleAccess, ProtectedRoute } from '../components/AuthProvider';

// Config
import env from '../config/env';

// Images
import { uploadPestImage, imageService } from '../services/imageService';
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01 | Initial integration |

---

*Last updated: January 2024*

