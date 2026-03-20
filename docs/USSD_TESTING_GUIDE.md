# USSD Testing Guide

This guide explains USSD in a beginner-friendly way for this project.

If you have never worked with USSD before, that is fine. We will treat it like a simple menu system that receives text and returns text.

Use this guide when you want to:

- understand how USSD works in this system
- test USSD locally without a real telecom provider
- check whether your backend is responding correctly
- understand why a menu option may not show expected data

Use this together with [NEW_COMPUTER_SETUP.md](/d:/Advanced%20Real%20World%20Project/Pro/docs/NEW_COMPUTER_SETUP.md) if you are still setting up the project.

## 1. What USSD means here

In this project, USSD is a menu-based interaction for feature phones.

The user types choices like:

- `1`
- `1*2`
- `5*1*1`

The backend reads that text path and returns a plain-text response.

The response always starts with one of these:

- `CON`
  This means the session should continue.
  The phone should show another screen and wait for more input.

- `END`
  This means the session is finished.
  The phone should close the menu flow.

## 2. The active USSD backend path

The real HTTP endpoints are in:

- [Backend/src/routes/ussd.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/routes/ussd.js)

The active menu logic is in:

- [Backend/src/services/ussdService.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/services/ussdService.js)

The frontend admin simulator is in:

- [Frontend/components/ConnectedAdminDashboard.tsx](/d:/Advanced%20Real%20World%20Project/Pro/Frontend/components/ConnectedAdminDashboard.tsx)
- [Frontend/services/ussd.ts](/d:/Advanced%20Real%20World%20Project/Pro/Frontend/services/ussd.ts)

Important note:

There is also an older USSD callback helper inside [Backend/src/services/notificationService.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/services/notificationService.js), but the real API routes use `ussdService.js`.

When you test the actual backend endpoints, follow `ussdService.js`.

## 3. The endpoints you can test

### Health check

- `GET /api/v1/ussd/health`

This tells you whether the USSD route is up.

### Main callback

- `POST /api/v1/ussd/callback`

This is the normal callback endpoint.

### Enhanced callback

- `POST /api/v1/ussd/callback/v2`

This version also accepts `networkCode` and does language detection.

## 4. What request data means

When testing USSD, you usually send:

- `sessionId`
  - The unique ID for one ongoing phone session.
  - Keep this the same while moving through the same menu flow.

- `serviceCode`
  - The short code, for example `*483*88#`
  - For local testing, this is usually just a label. The backend does not use it heavily.

- `phoneNumber`
  - Very important.
  - The backend uses this to find the user in the database.

- `text`
  - The path the user has chosen so far.
  - Examples:
    - `""` means first screen
    - `"1"` means the user chose menu option 1
    - `"1*2"` means the user first chose 1, then 2
    - `"5*1*1"` means settings, then language, then English

- `networkCode`
  - Used by `v2`
  - Optional for local testing, but good to include when testing the enhanced flow

## 5. The current menu structure

The active menu in [ussdService.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/src/services/ussdService.js) is:

1. View Recommendations
2. Farm Status
3. Weather Forecast
4. Report Pest
5. Settings
0. Exit

What each one currently does:

- `1. View Recommendations`
  - Uses live recommendation data.
  - Can show pending recommendations.
  - Can accept, reject, or defer a recommendation.

- `2. Farm Status`
  - Uses live farm and sensor data.
  - Looks up the user’s farms.
  - Shows latest readings and irrigation schedule information.

- `3. Weather Forecast`
  - Works, but the current response is simplified text in the active service.
  - It is not yet using the full live weather backend flow.

- `4. Report Pest`
  - Currently returns reporting instructions.
  - It is not yet a full interactive pest ticket creation flow.

- `5. Settings`
  - This one is live and important.
  - Language changes update the user record in the database.

## 6. What must exist before testing

To test successfully, make sure these are true:

1. Convex is running
2. Backend is running
3. Frontend is running if you want to use the admin simulator
4. The phone number you test with belongs to a real user in the database

If the phone number is not attached to a user, the backend may:

- end the session early
- show a fallback menu
- show no real farm or recommendation data

## 7. Fast local startup checklist

Open three terminals.

### Terminal A: Convex

```powershell
cd Backend
npx convex dev --local --local-force-upgrade
```

### Terminal B: Backend

```powershell
cd Backend
npm run dev
```

### Terminal C: Frontend

```powershell
cd Frontend
npm run dev
```

## 8. The easiest way to test: admin dashboard simulator

Open the frontend and go to the admin dashboard.

Use the `USSD Monitor` section.

That simulator already lets you:

- choose `v1` or `v2`
- set `sessionId`
- set `serviceCode`
- set `phoneNumber`
- set `text`
- set `networkCode` for `v2`
- see the exact plain-text backend response

This is the easiest way to test because you do not need to type long `curl` commands every time.

## 9. Testing with curl

If you want direct API testing, use `curl.exe` in PowerShell.

### 9.1 Health check

```powershell
curl.exe http://localhost:3000/api/v1/ussd/health
```

Expected result:

```json
{"status":"ok","service":"ussd","timestamp":"..."}
```

### 9.2 Start a new session

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-1\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"\"}"
```

Expected result:

- response starts with `CON`
- response contains the welcome menu

### 9.3 Exit immediately

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-2\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"0\"}"
```

Expected result:

- response starts with `END`

### 9.4 Open recommendations

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-3\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"1\"}"
```

This only shows meaningful data if the user has pending recommendations.

### 9.5 Open farm status

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-4\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"2\"}"
```

This only shows meaningful data if the user has at least one farm.

### 9.6 Change language through settings

This is a very good real test because it updates the database.

Step 1:

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-5\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"5\"}"
```

Step 2:

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-5\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"5*1\"}"
```

Step 3:

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-5\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"5*1*1\"}"
```

Expected result:

- response should mention language changed to English
- user `preferred_language` should be updated in the database

### 9.7 Test v2

```powershell
curl.exe -X POST http://localhost:3000/api/v1/ussd/callback/v2 ^
  -H "Content-Type: application/json" ^
  -d "{\"sessionId\":\"ussd-demo-6\",\"serviceCode\":\"*483*88#\",\"phoneNumber\":\"+250788000001\",\"text\":\"\",\"networkCode\":\"63801\"}"
```

## 10. A simple full test flow you can follow

If you want one simple end-to-end check, use this exact order:

1. Check health
2. Start session with `text: ""`
3. Open farm status with `text: "2"`
4. Open settings with `text: "5"`
5. Choose language with `text: "5*1"`
6. Set English with `text: "5*1*1"`

Why this is a good test:

- health confirms route is running
- first screen confirms menu rendering
- farm status confirms user and farm lookup
- settings confirms navigation
- language update confirms real database write

## 11. Common beginner mistakes

### Mistake 1: changing `sessionId` during one flow

Wrong:

- first request uses `sessionId: "a"`
- second request uses `sessionId: "b"`

Why it breaks:

- the backend stores session state in memory using `sessionId`
- if you change it, the backend thinks it is a different session

Fix:

- keep the same `sessionId` until that session ends

### Mistake 2: testing with a phone number that does not belong to a user

Why it breaks:

- USSD uses the phone number to find the user

Fix:

- use a phone number already attached to a real user record

### Mistake 3: expecting recommendation data when the user has no pending recommendations

Fix:

- create or assign a pending recommendation first

### Mistake 4: expecting farm status when the user has no farm

Fix:

- test with a farmer account that already owns a farm

### Mistake 5: restarting the backend mid-session

Why it breaks:

- the USSD session map is currently in memory
- restart clears it

Fix:

- start a new session after restart

## 12. What is dynamic and what is still simplified

Current live pieces:

- user lookup by phone
- recommendation list and actions
- farm status lookup
- sensor reading lookup
- language update in settings
- audit logging for language change

Currently simplified pieces:

- weather response in the active USSD service
- pest reporting menu content

That means USSD is working, but not every branch is equally advanced yet.

## 13. Useful backend tests already in the repo

You can look at these if you want examples that already pass:

- [Backend/tests/api.test.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/tests/api.test.js)
- [Backend/tests/ussdStorageManagement.test.js](/d:/Advanced%20Real%20World%20Project/Pro/Backend/tests/ussdStorageManagement.test.js)

These tests cover:

- health endpoint
- initial callback
- menu navigation
- `v2` callback
- language update audit logging

## 14. Best next steps

If you want to go further, the next good improvements are:

1. make USSD weather use the real weather service instead of simplified text
2. turn `Report Pest` into a real interactive pest-report workflow
3. move session storage from in-memory `Map` to Redis or persistent session storage for production

## 15. Quick summary

If you remember only five things, remember these:

1. USSD sends `text` like `1*2*3`
2. The backend replies with `CON` or `END`
3. Keep the same `sessionId` during one session
4. Use a real user phone number from the database
5. The admin `USSD Monitor` is the easiest testing tool
