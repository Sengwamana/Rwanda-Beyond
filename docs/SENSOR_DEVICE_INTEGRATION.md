# Sensor Device Integration Guide

This guide explains how to connect a real sensor device to the RwandaBeyond system in a beginner-friendly way.

If you are new to IoT integration, do not worry. We will go step by step.

This document covers:

- what the important words mean
- what you need before you begin
- the exact order to connect a device
- how to generate a device token
- how to register a sensor in the backend
- how to send the first reading
- how to verify that data reached the database
- common mistakes and how to fix them

Use this guide together with [NEW_COMPUTER_SETUP.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/NEW_COMPUTER_SETUP.md) if you are setting up the full project on a new machine.

## 1. What this guide is for

This system already supports sensors in the backend and frontend.

That means the software can:

- register sensors
- authenticate devices securely
- receive live readings
- store readings in the database
- show readings in the dashboard
- calculate latest values and aggregates
- trigger AI-related notification flows after new readings arrive

This guide helps you connect a real device so it can start sending data into that system.

## 2. Important words explained simply

Before we start, these words matter a lot:

- `farmId`
  - This is the database ID of the farm that owns the sensor.
  - The sensor must belong to a farm.

- `deviceId`
  - This is the unique ID used by the physical device when it talks to the backend.
  - Think of it like the device username.

- `token`
  - This is the secret credential used by the device to prove it is allowed to send data.
  - Think of it like the device password.

- `sensor`
  - This is the database record that links a device to a farm and describes what kind of sensor it is.

- `reading`
  - This is one packet of measured values, for example soil moisture, temperature, and humidity.

- `batch`
  - This means sending many readings at once.
  - It is useful when the device was offline and wants to upload saved readings later.

## 3. The big picture

The full sensor flow is:

1. Start the local services.
2. Get or create the farm you want to attach the device to.
3. Generate a device token.
4. Register the sensor using the same `deviceId`.
5. Put the `deviceId` and token into the device firmware.
6. Send the first reading to the ingest endpoint.
7. Confirm the reading appears in the dashboard or API.

The most common beginner mistake is this:

- generating one `deviceId`
- registering a different `deviceId`
- then sending data with another `deviceId`

These must match.

## 4. What you need before you begin

Make sure these are already working:

- Convex is running
- backend is running
- frontend is optional, but helpful for visual verification
- you can sign in as an admin user
- at least one farm already exists in the system

Useful local URLs:

- Backend health: `http://localhost:3000/health`
- API health: `http://localhost:3000/api/health`
- API base: `http://localhost:3000/api/v1`
- Frontend: `http://localhost:5173`

If you have not started the project yet, follow [NEW_COMPUTER_SETUP.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/NEW_COMPUTER_SETUP.md) first.

## 5. Supported sensor types

When you register a sensor, `sensorType` must be one of:

- `soil_moisture`
- `temperature`
- `humidity`
- `npk`
- `rainfall`
- `light`

Even though registration uses one main sensor type, a reading packet can still include multiple measured fields in the same request.

## 6. Start the system first

Open the project and make sure these are running:

Terminal A:

```powershell
cd Backend
npx convex dev --local --local-force-upgrade
```

Terminal B:

```powershell
cd Backend
npm run dev
```

Terminal C:

```powershell
cd Frontend
npm run dev
```

Quick health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
```

You want to see a healthy backend and a connected database.

## 7. Step 1: Find the farm you want to attach the device to

Every sensor belongs to a farm.

So before you register a device, you need the `farmId`.

You can get it from:

- the dashboard
- the database
- or the farms API

Example:

```powershell
curl http://localhost:3000/api/v1/farms
```

Pick the farm you want and copy its ID.

You will use that same `farmId` during sensor registration.

## 8. Step 2: Generate a device token

This is the first real provisioning step.

The admin backend route creates:

- a new `deviceId`
- a new token
- an expiry time

Routes:

- `POST /api/v1/admin/devices/token`
- `POST /api/v1/admin/devices/generate`

They do the same job. The `/token` route is the one most frontend flows use.

Important:

- the token is returned only once
- save it immediately
- you cannot ask the backend to show the same token again later

Example request:

```bash
curl -X POST http://localhost:3000/api/v1/admin/devices/token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_USER_JWT>" \
  -d '{
    "farmId": "<FARM_ID>",
    "deviceName": "Field Sensor 01",
    "expiresInDays": 365
  }'
```

Example response:

```json
{
  "success": true,
  "data": {
    "deviceId": "device_abc123def4567890",
    "token": "very-long-secret-token",
    "expiresAt": "2027-03-20T08:12:44.000Z",
    "warning": "Store this token securely. It cannot be retrieved again."
  }
}
```

Write down:

- `deviceId`
- `token`

You need both for the next steps.

## 9. Step 3: Register the sensor in the backend

Generating a token is not enough by itself.

You must also create the sensor record in the database.

Route:

- `POST /api/v1/sensors`

This route needs normal signed-in user auth, not device auth.

In simple words:

- admin, expert, or the farm owner can register the sensor
- the device itself does not call this route
- this is a setup step, not a live data step

Minimum required fields:

- `deviceId`
- `farmId`
- `sensorType`

Example request:

```bash
curl -X POST http://localhost:3000/api/v1/sensors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <USER_JWT>" \
  -d '{
    "deviceId": "device_abc123def4567890",
    "farmId": "<FARM_ID>",
    "sensorType": "soil_moisture",
    "name": "Field Sensor 01",
    "locationDescription": "North corner of the maize field",
    "firmwareVersion": "1.0.0"
  }'
```

Important rule:

- the `deviceId` here must be exactly the same `deviceId` you got from token generation

If it is different, device authentication will fail later.

## 10. Step 4: Put credentials into the device firmware

Your device firmware should store:

- the backend URL
- the `deviceId`
- the token

Example values:

```text
API base: http://localhost:3000/api/v1
deviceId: device_abc123def4567890
token: very-long-secret-token
```

If you are testing from another machine on the same network, do not use `localhost`.

Use the backend machine IP instead, for example:

```text
http://192.168.1.20:3000/api/v1
```

## 11. Step 5: Send the first reading

The live ingest routes are:

- `POST /api/v1/sensors/data/ingest`
- `POST /api/v1/sensors/data/batch`

Use `/data/ingest` for normal live sending.

Use `/data/batch` if the device saved readings locally while offline and wants to upload several at once later.

### Required headers

The backend expects:

- `x-device-id`
- one of:
  - `x-device-token`
  - or `Authorization: Bearer <token>`

Token example:

```bash
curl -X POST http://localhost:3000/api/v1/sensors/data/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-id: device_abc123def4567890" \
  -H "x-device-token: very-long-secret-token" \
  -d '{
    "readings": [
      {
        "readingTimestamp": 1773963000000,
        "soilMoisture": 63.5,
        "airTemperature": 24.1,
        "humidity": 70.2
      }
    ]
  }'
```

Bearer example:

```bash
curl -X POST http://localhost:3000/api/v1/sensors/data/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-id: device_abc123def4567890" \
  -H "Authorization: Bearer very-long-secret-token" \
  -d '{
    "readings": [
      {
        "readingTimestamp": 1773963000000,
        "soilMoisture": 63.5,
        "airTemperature": 24.1,
        "humidity": 70.2
      }
    ]
  }'
```

## 12. What a reading can look like

The system accepts more than one format to help real devices integrate more easily.

### Recommended format

This is the cleanest format and the best one to use for new devices:

```json
{
  "readings": [
    {
      "readingTimestamp": 1773963000000,
      "soilMoisture": 63.5,
      "soilTemperature": 22.4,
      "airTemperature": 24.1,
      "humidity": 70.2,
      "nitrogen": 180,
      "phosphorus": 38,
      "potassium": 195,
      "phLevel": 6.4,
      "lightIntensity": 540,
      "rainfallMm": 0
    }
  ]
}
```

### Legacy snake_case format

This also works:

```json
{
  "readings": [
    {
      "reading_timestamp": 1773963000000,
      "soil_moisture": 63.5,
      "soil_temperature": 22.4,
      "air_temperature": 24.1,
      "humidity": 70.2,
      "ph_level": 6.4,
      "light_intensity": 540,
      "rainfall_mm": 0
    }
  ]
}
```

### Simple sensorType + value format

This is useful for small devices that send one measurement at a time:

```json
{
  "readings": [
    {
      "readingTimestamp": 1773963000000,
      "sensorType": "soil_moisture",
      "value": 63.5
    }
  ]
}
```

### NPK object format

This also works for nutrient sensors:

```json
{
  "readings": [
    {
      "readingTimestamp": 1773963000000,
      "sensorType": "npk",
      "value": {
        "nitrogen": 180,
        "phosphorus": 38,
        "potassium": 195
      }
    }
  ]
}
```

## 13. Important validation rules

The backend validates readings before saving them.

That is good because it protects the system from broken data.

### Batch size

- `readings` must be an array
- it must not be empty
- it can contain at most `500` readings by default

### At least one real measurement is required

Each reading must contain at least one environmental value, for example:

- `soilMoisture`
- `airTemperature`
- `humidity`
- `nitrogen`
- `phosphorus`
- `potassium`
- `phLevel`
- `lightIntensity`
- `rainfallMm`

### Range checks

Current default allowed ranges:

- soil moisture: `0` to `100`
- temperature: `-10` to `60`
- humidity: `0` to `100`
- nitrogen: `0` to `500`
- phosphorus: `0` to `500`
- potassium: `0` to `500`

### Rate-of-change checks

The backend also flags suspicious jumps, for example:

- soil moisture changing by more than `20` points per hour
- temperature changing by more than `10` degrees per hour

This does not always mean the data is rejected, but it helps the system detect strange behavior.

## 14. Single reading vs batch upload

Use `/data/ingest` when:

- the device is online
- you want to send readings as they happen

Use `/data/batch` when:

- the device was offline
- the device saved readings locally
- you now want to upload many readings together

Example batch request:

```bash
curl -X POST http://localhost:3000/api/v1/sensors/data/batch \
  -H "Content-Type: application/json" \
  -H "x-device-id: device_abc123def4567890" \
  -H "x-device-token: very-long-secret-token" \
  -d '{
    "readings": [
      {
        "readingTimestamp": 1773963000000,
        "soilMoisture": 63.5,
        "airTemperature": 24.1
      },
      {
        "readingTimestamp": 1773966600000,
        "soilMoisture": 62.9,
        "airTemperature": 24.8
      }
    ]
  }'
```

## 15. Optional advanced authentication: HMAC

Most beginners should start with token authentication.

The backend also supports HMAC-based signing with these headers:

- `x-device-id`
- `x-hmac-signature`
- `x-timestamp`

This uses the shared backend secret `IOT_DEVICE_SECRET`.

This is more advanced because the device must:

1. serialize the request body
2. build this string:

```text
<timestamp>.<payload>
```

3. sign it with HMAC SHA-256 using `IOT_DEVICE_SECRET`

If you are just trying to get your first sensor working, use token auth first.

## 16. What success looks like

When the backend accepts readings, you should get a success response.

Example:

```json
{
  "success": true,
  "message": "Sensor data ingested successfully",
  "data": {
    "total": 1,
    "received": 1,
    "processed": 1,
    "valid": 1,
    "invalid": 0,
    "failed": 0,
    "duplicates": 0
  }
}
```

If the device sends fresh valid readings, the system may also trigger downstream AI-related notifications for that farm.

## 17. How to verify the data reached the system

After sending data, check these places.

### API checks

Get sensors for a farm:

```bash
curl http://localhost:3000/api/v1/sensors/farm/<FARM_ID>
```

Get latest readings:

```bash
curl http://localhost:3000/api/v1/sensors/data/farm/<FARM_ID>/latest
```

Get aggregates:

```bash
curl http://localhost:3000/api/v1/sensors/data/farm/<FARM_ID>/aggregates
```

### Dashboard checks

Open the dashboard and confirm:

- the farm shows sensor health
- the latest sensor snapshot updates
- charts or recent readings reflect the new values

## 18. Beginner checklist

If this is your first device, verify these one by one:

1. Convex is running.
2. Backend is running.
3. You generated a device token successfully.
4. You saved the `deviceId` and token.
5. You registered a sensor using the same `deviceId`.
6. The sensor belongs to the correct `farmId`.
7. The sensor status is active.
8. Your device sends `x-device-id`.
9. Your device sends either `x-device-token` or `Authorization: Bearer <token>`.
10. Your request body contains `readings`.
11. Each reading contains at least one real measurement.
12. The values are inside allowed ranges.

## 19. Common mistakes and fixes

### Mistake 1: `Unknown device`

Cause:

- the sensor record was not created
- or the `deviceId` in the request does not match the registered one

Fix:

- check the `deviceId`
- make sure you already called `POST /api/v1/sensors`

### Mistake 2: `Invalid or expired device token`

Cause:

- wrong token
- token expired
- token copied incorrectly

Fix:

- generate a new token
- update the device firmware with the new token

### Mistake 3: `Device is inactive`

Cause:

- the sensor exists, but its status is not active

Fix:

- reactivate or update the sensor record

### Mistake 4: validation errors on readings

Cause:

- missing `readings`
- wrong field names
- values outside supported ranges

Fix:

- start with the recommended payload format from this document
- add one or two fields first
- only expand after the first request works

### Mistake 5: nothing appears in the dashboard

Cause:

- the backend accepted nothing
- the device is attached to a different farm
- the request used the wrong `deviceId`

Fix:

- check the ingest response
- check the farm linked to the sensor
- query `/latest` directly for the farm

## 20. Simple ESP32 example

This is only a basic example to show the idea.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

const char* apiUrl = "http://192.168.1.20:3000/api/v1/sensors/data/ingest";
const char* deviceId = "device_abc123def4567890";
const char* deviceToken = "very-long-secret-token";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-id", deviceId);
    http.addHeader("x-device-token", deviceToken);

    String body =
      "{\"readings\":[{\"readingTimestamp\":1773963000000,"
      "\"soilMoisture\":63.5,"
      "\"airTemperature\":24.1,"
      "\"humidity\":70.2}]}";

    int httpCode = http.POST(body);
    String response = http.getString();

    Serial.println(httpCode);
    Serial.println(response);

    http.end();
  }

  delay(60000);
}
```

Important:

- replace the IP with the real backend machine IP
- do not use `localhost` from the ESP32
- store secrets carefully in production

## 21. Best practice for first bring-up

If you are connecting a real device for the first time, use this order:

1. Test the API with `curl`.
2. Make sure the backend accepts the reading.
3. Confirm it appears in `/latest`.
4. Only then move the same working values into device firmware.

This saves a lot of time because it separates:

- backend problems
- from firmware problems
- from Wi-Fi/network problems

## 22. Helpful backend files

If you want to understand the real implementation, these are the main files:

- [Backend/src/routes/sensors.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/routes/sensors.js)
- [Backend/src/services/sensorService.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/services/sensorService.js)
- [Backend/src/middleware/deviceAuth.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/middleware/deviceAuth.js)
- [Backend/src/middleware/validation.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/middleware/validation.js)
- [Backend/src/config/index.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/config/index.js)

## 23. Final advice

If you are a beginner, keep the first test small:

- one farm
- one device
- one sensor record
- one token
- one reading

Once that works, expand slowly.

The safest first payload is:

```json
{
  "readings": [
    {
      "readingTimestamp": 1773963000000,
      "soilMoisture": 63.5,
      "airTemperature": 24.1,
      "humidity": 70.2
    }
  ]
}
```

That is the easiest good starting point for most real device integrations.
