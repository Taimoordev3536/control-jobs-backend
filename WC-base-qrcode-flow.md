# Work Center-Based QR Code System Flow

## 📋 Overview

This document describes the **Work Center-Based QR Code System**, where each work center has its own independent QR code configuration managed by the employer.

### Key Changes from Previous System

| Feature | Previous (Client/Employer-Based) | New (Work Center-Based) |
|---------|----------------------------------|-------------------------|
| **QR Ownership** | Client or Employer | Work Center |
| **Scope** | All jobs under owner | Specific work center only |
| **Active Types** | Both static & dynamic simultaneously | ONE type selected at a time |
| **Multi Work Center Jobs** | N/A | Merged dynamic QR |
| **Refresh Interval** | 5 minutes | 3 minutes |
| **Distribution** | Manual | Email to client |

---

## 🏗️ System Architecture

### Database Schema

```sql
-- Updated QR Codes Table
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY,
  token VARCHAR(44) NOT NULL,
  type VARCHAR(10) NOT NULL,              -- 'STATIC' or 'DYNAMIC'
  work_center_id INTEGER NOT NULL,        -- FK to work_center
  is_active BOOLEAN DEFAULT true,
  is_selected BOOLEAN DEFAULT false,      -- Employer's active choice
  expires_at TIMESTAMP NULL,              -- For dynamic QR only
  last_refreshed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (work_center_id) REFERENCES work_center(id) ON DELETE CASCADE,
  UNIQUE (work_center_id, type, is_active) WHERE is_active = true
);

CREATE INDEX idx_qr_codes_work_center ON qr_codes(work_center_id);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);
```

### Entity Relationships

```
work_center (1) ──── (N) qr_codes
     │
     │
     └──── (N) job_work_centers ──── (1) job
                                         │
                                         └──── (N) scan_logs
```

---

## 🔄 Complete Flow Diagram

### 1. Employer Configures QR for Work Center

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMPLOYER DASHBOARD                            │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ Navigate to Work Center Details
         ├─ Click "Methods" Tab
         ├─ Click "Código QR" Button
         │
         ▼
    ┌────────────────────────────────┐
    │   QR Code Configuration Dialog  │
    │                                 │
    │  Type: ○ Static  ● Dynamic     │
    │  Active: ☑ Yes  ☐ No          │
    │  [Regenerate] [Print] [Save]   │
    └────────────────────────────────┘
         │
         ├─ Employer selects type: STATIC or DYNAMIC
         ├─ Employer toggles active: YES or NO
         ├─ Clicks "Guardar" (Save)
         │
         ▼
    Frontend Request:
    ═══════════════════
    PUT /work-centers/{workCenterId}/signing-methods/qr
    Authorization: Bearer {employerToken}
    {
      "selectedType": "static" | "dynamic",
      "active": true | false
    }
         │
         ▼
    Backend Processing:
    ══════════════════
    ├─ Verify employer owns work center
    ├─ Check selectedType:
    │  
    ├─ IF selectedType = "static":
    │  ├─ Find/Create static QR code
    │  ├─ Set static.isSelected = true
    │  ├─ Set static.isActive = true
    │  ├─ Generate static token (UUID)
    │  │
    │  ├─ Find/Create dynamic QR code (auto-generate)
    │  ├─ Set dynamic.isSelected = false
    │  ├─ Set dynamic.isActive = true (fallback!)
    │  ├─ Generate dynamic token (256-bit)
    │  └─ Set dynamic.expiresAt = now + 3 min
    │
    ├─ IF selectedType = "dynamic":
    │  ├─ Deactivate static QR (if exists)
    │  ├─ Set static.isActive = false
    │  │
    │  ├─ Find/Create dynamic QR code
    │  ├─ Set dynamic.isSelected = true
    │  ├─ Set dynamic.isActive = true
    │  └─ Set dynamic.expiresAt = now + 3 min
    │
    └─ Generate QR images for both
         │
         ▼
    Response:
    ════════
    {
      "staticQr": {
        "token": "a7f2d4e8-...",
        "qrImage": "data:image/png;base64,...",
        "isSelected": true,
        "isActive": true
      },
      "dynamicQr": {
        "token": "K9mP2nX...",
        "qrImage": "data:image/png;base64,...",
        "isSelected": false,
        "isActive": true,
        "expiresAt": "2026-01-26T10:03:00Z"
      }
    }
         │
         ▼
    Frontend Display:
    ════════════════
    ├─ Show both QR codes in dialog
    ├─ Highlight selected type
    ├─ Enable print button for static
    └─ Show expiry countdown for dynamic
```

---

### 2. Static QR Distribution via Email

```
┌─────────────────────────────────────────────────────────────────┐
│              STATIC QR EMAIL DISTRIBUTION                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ Employer clicks "Send to Client" button
         ├─ Email dialog opens
         │
         ▼
    ┌────────────────────────────────┐
    │   Send QR Code via Email       │
    │                                 │
    │  Client Email: [            ]  │
    │  ☑ Include instructions        │
    │  [Preview] [Send]              │
    └────────────────────────────────┘
         │
         ▼
    Frontend Request:
    ═══════════════════
    POST /work-centers/{workCenterId}/send-static-qr
    {
      "clientEmail": "client@example.com",
      "includeInstructions": true
    }
         │
         ▼
    Backend Processing:
    ══════════════════
    ├─ Get static QR code for work center
    ├─ Generate QR image (high quality for print)
    ├─ Create email template with:
    │  ├─ Work center name and address
    │  ├─ QR code image (embedded)
    │  ├─ Instructions for placement
    │  └─ Validity information
    ├─ Send email via SMTP
    └─ Log email sent
         │
         ▼
    Email Sent ✓
    Client receives printable QR code
```

---

### 3. Job with Multiple Work Centers - Merged QR

```
┌─────────────────────────────────────────────────────────────────┐
│              JOB CREATION WITH MULTIPLE WORK CENTERS             │
└─────────────────────────────────────────────────────────────────┘

Job Created: "Construction Project Alpha"
Work Centers:
  ├─ WC1 (Warehouse) → Static QR Selected
  ├─ WC2 (Office)    → Static QR Selected
  └─ WC3 (Site A)    → Dynamic QR Selected

         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT DASHBOARD                              │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ Client logs in
         ├─ Views job details
         │
         ▼
    Navbar displays:
    ═══════════════
    ┌──────────────────────────────────────┐
    │  🔲 Merged QR    Expires in: 2:45    │
    │  [    QR CODE IMAGE DISPLAY    ]     │
    │  Valid for: WC1, WC2, WC3            │
    └──────────────────────────────────────┘
         │
         ▼
    Frontend Request (Auto-fetch):
    ═════════════════════════════
    GET /jobs/{jobId}/merged-qr
    Authorization: Bearer {clientToken}
         │
         ▼
    Backend Processing:
    ══════════════════
    ├─ Get job with work centers
    ├─ For each work center, get active QR:
    │  
    │  WC1: Static selected
    │  ├─ Include static token
    │  └─ Include dynamic token (fallback)
    │  
    │  WC2: Static selected
    │  ├─ Include static token
    │  └─ Include dynamic token (fallback)
    │  
    │  WC3: Dynamic selected only
    │  └─ Include dynamic token
    │
    ├─ Create merged token structure:
    │  {
    │    workCenters: [
    │      { id: 1, name: "Warehouse", 
    │        tokens: ["static-token-1", "dynamic-token-1"] },
    │      { id: 2, name: "Office",
    │        tokens: ["static-token-2", "dynamic-token-2"] },
    │      { id: 3, name: "Site A",
    │        tokens: ["dynamic-token-3"] }
    │    ],
    │    jobId: 123,
    │    generatedAt: "2026-01-26T10:00:00Z"
    │  }
    │
    ├─ Encode as base64/JWT
    ├─ Generate QR image from merged token
    └─ Calculate earliest expiry (min of all dynamic)
         │
         ▼
    Response:
    ════════
    {
      "qrImage": "data:image/png;base64,...",
      "mergedToken": "eyJhbG...",
      "workCenters": [
        { "id": 1, "name": "Warehouse", "type": "static" },
        { "id": 2, "name": "Office", "type": "static" },
        { "id": 3, "name": "Site A", "type": "dynamic" }
      ],
      "expiresAt": "2026-01-26T10:03:00Z",
      "refreshInterval": 180000
    }
         │
         ▼
    Frontend Auto-Refresh:
    ═════════════════════
    ├─ Display QR code in navbar
    ├─ Show countdown timer
    ├─ Auto-refresh every 3 minutes
    └─ Visual indicator when refreshing
```

---

### 4. Worker Check-in Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   WORKER MOBILE APP / DASHBOARD                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ Worker arrives at work location
         ├─ Opens worker dashboard
         ├─ Selects job to check in
         │
         ▼
    Sequential Verification:
    ═══════════════════════
    Step 1: GPS Location ✓
    Step 2: IP Detection ✓
    Step 3: QR Code Scan
         │
         ▼
    QR Scanner Opens:
    ════════════════
    ├─ Access camera
    ├─ Display scanner view
    ├─ Worker scans QR code (static or merged)
    └─ jsQR library detects QR
         │
         ▼
    Scanned QR Token:
    ════════════════
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    or
    "a7f2d4e8-9c3b-4f5a-8d2e-1a3b5c7d9e0f"
         │
         ▼
    Frontend Request:
    ═══════════════════
    POST /jobs/scan
    Authorization: Bearer {workerToken}
    {
      "jobId": 123,
      "scanType": "check-in",
      "signingMethod": "qrcode",
      "qrToken": "eyJhbGci...",
      "location": "Construction Site A",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "ipAddress": "192.168.1.45",
      "userTimezone": "America/New_York",
      "notes": "Arrived on time"
    }
         │
         ▼
    Backend Validation:
    ══════════════════
    ├─ Extract worker from JWT token
    ├─ Verify job exists
    ├─ Verify worker assigned to job
    │
    ├─ QR Token Validation:
    │  │
    │  ├─ Check if merged token:
    │  │  ├─ Decode JWT/base64
    │  │  ├─ Extract work center tokens
    │  │  └─ Validate each token
    │  │
    │  ├─ OR single token:
    │  │  ├─ Get all work centers for job
    │  │  ├─ For each work center:
    │  │  │  ├─ Check static QR (if selected)
    │  │  │  │  └─ Match token → VALID
    │  │  │  │
    │  │  │  └─ Check dynamic QR (if active)
    │  │  │     ├─ Match token
    │  │  │     ├─ Verify not expired (< 3 min)
    │  │  │     └─ VALID
    │  │  │
    │  │  └─ If any match found → SUCCESS
    │  │
    │  └─ Return validation result:
    │     {
    │       valid: true,
    │       workCenterId: 1,
    │       qrType: "static" | "dynamic"
    │     }
    │
    ├─ IF INVALID QR:
    │  └─ Throw error: "Invalid or expired QR code"
    │
    ├─ Create scan_logs entry:
    │  {
    │    jobId: 123,
    │    workerId: 45,
    │    scanType: "check-in",
    │    signingMethod: "qrcode",
    │    qrToken: "eyJhbGci...",
    │    workCenterId: 1,        // ← Captured from validation
    │    scanTime: "2026-01-26T10:00:00Z",
    │    location: {...},
    │    latitude: 40.7128,
    │    longitude: -74.0060,
    │    ipAddress: "192.168.1.45"
    │  }
    │
    └─ Create/Update work_sessions:
       {
         jobId: 123,
         workerId: 45,
         workCenterId: 1,          // ← Tracked
         checkInTime: "2026-01-26T10:00:00Z",
         checkInMethod: "qrcode",
         isActive: true,
         isOnBreak: false
       }
         │
         ▼
    Response:
    ════════
    {
      "status": "Scan recorded successfully",
      "scanData": {
        "id": 789,
        "jobId": 123,
        "workerId": 45,
        "workCenterId": 1,
        "workCenterName": "Warehouse",
        "scanType": "check-in",
        "scanTime": "2026-01-26T10:00:00Z",
        "qrType": "static"
      },
      "workSession": {
        "id": 456,
        "isActive": true,
        "checkInTime": "2026-01-26T10:00:00Z"
      }
    }
         │
         ▼
    Frontend Display:
    ════════════════
    ✓ Check-in successful!
    Location: Warehouse (WC1)
    Method: QR Code (Static)
    Time: 10:00 AM
         │
         ▼
    Real-time Alert:
    ═══════════════
    → Employer Dashboard: "Worker checked in at Warehouse"
    → Client Dashboard: "Worker arrived at Construction Project Alpha"
```

---

## 🔁 Dynamic QR Auto-Refresh (Background Process)

```
┌─────────────────────────────────────────────────────────────────┐
│               CRON JOB - EVERY 3 MINUTES                         │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
    QR Code Refresh Service:
    ═══════════════════════
    @Cron('*/3 * * * *')  // Every 3 minutes
    async refreshDynamicQRCodes()
         │
         ▼
    Processing:
    ══════════
    ├─ Query database:
    │  SELECT * FROM qr_codes
    │  WHERE type = 'DYNAMIC'
    │    AND is_active = true;
    │
    ├─ For each dynamic QR code:
    │  │
    │  ├─ Check if should be refreshed:
    │  │  │
    │  │  ├─ IF dynamic.isSelected = true
    │  │  │  └─ REFRESH (dynamic is primary)
    │  │  │
    │  │  ├─ ELSE check static sibling:
    │  │  │  ├─ Find static for same work center
    │  │  │  ├─ IF static.isSelected = true
    │  │  │  │  └─ REFRESH (dynamic is fallback)
    │  │  │  └─ ELSE skip (neither selected)
    │  │  │
    │  │  └─ IF should refresh:
    │  │     ├─ Generate new token (256-bit random)
    │  │     ├─ Update token in database
    │  │     ├─ Set expiresAt = now + 3 minutes
    │  │     ├─ Set lastRefreshedAt = now
    │  │     └─ Save changes
    │  │
    │  └─ Log refresh activity
    │
    └─ Complete
         │
         ▼
    Result:
    ══════
    ✓ Refreshed 15 dynamic QR codes
    ✓ Next refresh in 3 minutes
```

---

## 📊 Token Validation Logic Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 validateQRToken(scannedToken, jobId)             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
    ┌─── Is Merged Token? ───┐
    │  (Check format/structure) │
    └───────────┬───────────────┘
                │
        ┌───────┴───────┐
        │               │
       YES             NO (Single Token)
        │               │
        ▼               ▼
    ┌──────────────┐   ┌──────────────────────┐
    │ Decode Merged│   │ Get Job Work Centers │
    │    Token     │   └──────────┬───────────┘
    └──────┬───────┘              │
           │                      │
           ▼                      ▼
    ┌──────────────────┐   ┌──────────────────────┐
    │ Extract WC Tokens│   │ For Each Work Center │
    └──────┬───────────┘   └──────┬───────────────┘
           │                      │
           ├──────────────────────┘
           │
           ▼
    ┌─────────────────────────────────┐
    │  For Each Work Center in Job    │
    └────────────┬────────────────────┘
                 │
                 ▼
         ┌───────────────────┐
         │ Get QR Codes for  │
         │   Work Center     │
         └────────┬──────────┘
                  │
                  ▼
         ┌────────────────────────┐
         │ Check Selected Static? │
         └────────┬───────────────┘
                  │
          ┌───────┴────────┐
          │                │
         YES              NO
          │                │
          ▼                │
    ┌──────────────┐       │
    │ Token Match? │       │
    └──────┬───────┘       │
           │               │
       ┌───┴────┐          │
       │        │          │
      YES      NO          │
       │        │          │
       ▼        └──────────┤
    ┌──────┐               │
    │VALID │               │
    │STATIC│               │
    └──────┘               │
                           ▼
                  ┌─────────────────────┐
                  │ Check Active Dynamic│
                  └────────┬────────────┘
                           │
                   ┌───────┴────────┐
                   │                │
                  YES              NO
                   │                │
                   ▼                │
              ┌──────────────┐     │
              │ Token Match? │     │
              └──────┬───────┘     │
                     │             │
                 ┌───┴────┐        │
                 │        │        │
                YES      NO        │
                 │        │        │
                 ▼        │        │
            ┌─────────┐   │        │
            │Expired? │   │        │
            └────┬────┘   │        │
                 │        │        │
             ┌───┴───┐    │        │
             │       │    │        │
            YES     NO    │        │
             │       │    │        │
             │       ▼    │        │
             │   ┌──────┐ │        │
             │   │VALID │ │        │
             │   │DYNMC│ │        │
             │   └──────┘ │        │
             │            │        │
             └────────────┴────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Next WC or   │
                  │   INVALID    │
                  └──────────────┘
```

---

## 🔐 Security & Validation Rules

### 1. QR Code Generation Rules

```typescript
// Static QR Selected by Employer
{
  staticQR: {
    isSelected: true,
    isActive: true,
    token: uuidv4(),           // Permanent UUID
    expiresAt: null            // Never expires
  },
  dynamicQR: {
    isSelected: false,         // Not primary choice
    isActive: true,            // BUT still active as fallback!
    token: randomBase64(32),   // Changes every 3 min
    expiresAt: now + 3min
  }
}

// Dynamic QR Selected by Employer
{
  staticQR: {
    isSelected: false,
    isActive: false,           // Completely disabled
    token: null,
    expiresAt: null
  },
  dynamicQR: {
    isSelected: true,          // Primary choice
    isActive: true,
    token: randomBase64(32),
    expiresAt: now + 3min
  }
}
```

### 2. Validation Priority

```
1. Check if token is merged → Validate all included tokens
2. Check selected static QR → Immediate match = VALID
3. Check active dynamic QR → Match + not expired = VALID
4. No match found → INVALID
```

### 3. Security Features

✅ **JWT Authentication** - All endpoints protected  
✅ **Worker Assignment** - Only assigned workers can check in  
✅ **Employer Authorization** - Only work center owner can configure  
✅ **Time-based Expiry** - Dynamic QR expires after 3 minutes  
✅ **Token Uniqueness** - Each work center has unique tokens  
✅ **Audit Trail** - All scans logged with work center ID  
✅ **Transaction Safety** - Database transactions prevent race conditions  

---

## 📡 API Endpoints

### Work Center QR Management

#### Update QR Configuration
```http
PUT /work-centers/{workCenterId}/signing-methods/qr
Authorization: Bearer {employerToken}
Content-Type: application/json

Request:
{
  "selectedType": "static" | "dynamic",
  "active": true
}

Response:
{
  "staticQr": {
    "id": "uuid",
    "token": "a7f2d4e8-...",
    "qrImage": "data:image/png;base64,...",
    "type": "STATIC",
    "isSelected": true,
    "isActive": true,
    "expiresAt": null
  },
  "dynamicQr": {
    "id": "uuid",
    "token": "K9mP2nX...",
    "qrImage": "data:image/png;base64,...",
    "type": "DYNAMIC",
    "isSelected": false,
    "isActive": true,
    "expiresAt": "2026-01-26T10:03:00Z",
    "lastRefreshedAt": "2026-01-26T10:00:00Z"
  }
}
```

#### Get Work Center QR Codes
```http
GET /work-centers/{workCenterId}/qr-codes
Authorization: Bearer {employerToken}

Response:
{
  "workCenter": {
    "id": 1,
    "name": "Downtown Warehouse",
    "address": "123 Main St"
  },
  "qrCodes": {
    "static": { ... },
    "dynamic": { ... }
  }
}
```

#### Send Static QR via Email
```http
POST /work-centers/{workCenterId}/send-static-qr
Authorization: Bearer {employerToken}
Content-Type: application/json

Request:
{
  "clientEmail": "client@example.com",
  "includeInstructions": true
}

Response:
{
  "success": true,
  "message": "Static QR code sent to client@example.com",
  "sentAt": "2026-01-26T10:00:00Z"
}
```

---

### Job QR (Client Dashboard)

#### Get Merged Dynamic QR for Job
```http
GET /jobs/{jobId}/merged-qr
Authorization: Bearer {clientToken}

Response:
{
  "qrImage": "data:image/png;base64,...",
  "mergedToken": "eyJhbGci...",
  "workCenters": [
    {
      "id": 1,
      "name": "Warehouse",
      "qrType": "static",
      "address": "123 Main St"
    },
    {
      "id": 2,
      "name": "Office",
      "qrType": "static",
      "address": "456 Oak Ave"
    },
    {
      "id": 3,
      "name": "Site A",
      "qrType": "dynamic",
      "address": "789 Construction Blvd"
    }
  ],
  "expiresAt": "2026-01-26T10:03:00Z",
  "refreshInterval": 180000,
  "generatedAt": "2026-01-26T10:00:00Z"
}
```

---

### Worker Check-in

#### Record Scan (QR Check-in)
```http
POST /jobs/scan
Authorization: Bearer {workerToken}
Content-Type: application/json

Request:
{
  "jobId": 123,
  "scanType": "check-in",
  "signingMethod": "qrcode",
  "qrToken": "a7f2d4e8-9c3b-4f5a-8d2e-1a3b5c7d9e0f",
  "location": "Downtown Warehouse",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "ipAddress": "192.168.1.45",
  "userTimezone": "America/New_York",
  "notes": "Arrived on time"
}

Response:
{
  "status": "Scan recorded successfully",
  "scanData": {
    "id": 789,
    "jobId": 123,
    "workerId": 45,
    "workCenterId": 1,
    "workCenterName": "Downtown Warehouse",
    "scanType": "check-in",
    "scanTime": "2026-01-26T10:00:00Z",
    "signingMethod": "qrcode",
    "qrType": "static"
  },
  "workSession": {
    "id": 456,
    "checkInTime": "2026-01-26T10:00:00Z",
    "isActive": true,
    "isOnBreak": false
  }
}
```

---

## 🗂️ File Structure

### Backend

```
src/modules/job/
├── entities/
│   ├── qr-code.entity.ts           (Updated - work center FK)
│   ├── scan-log.entity.ts          (Updated - work center ID)
│   └── work-session.entity.ts      (Updated - work center ID)
├── dto/
│   ├── update-work-center-qr.dto.ts   (New)
│   ├── send-static-qr-email.dto.ts    (New)
│   └── scan.dto.ts                    (Updated)
├── services/
│   ├── job.service.ts                 (Major updates)
│   ├── qr-code-refresh.service.ts     (Updated - 3 min)
│   └── qr-email.service.ts            (New)
└── controllers/
    ├── job.controller.ts              (Updated endpoints)
    └── work-center-qr.controller.ts   (New)

migrations/
└── 20260126_work_center_qr_codes.ts   (New)
```

### Frontend

```
components/
├── work-center-tabs/
│   └── methods/
│       └── dialogs/
│           └── qr-code-dialog.tsx     (Updated API calls)
├── client-dashboard/
│   ├── merged-qr-navbar.tsx           (New)
│   └── qr-auto-refresh.tsx            (New)
└── qr-email/
    └── send-static-qr.tsx             (New)
```

---

## 📈 Benefits of Work Center-Based QR System

### 1. **Granular Control**
- Each location has independent QR configuration
- Flexibility per work center security needs

### 2. **Enhanced Security**
- Dynamic QR per location
- 3-minute expiry reduces risk
- Location-specific validation

### 3. **Better Tracking**
- Know exactly which work center worker checked into
- Location-based analytics
- Accurate time tracking per location

### 4. **Client Convenience**
- Single merged QR for all locations
- Auto-refresh on client dashboard
- No need to manage multiple QRs

### 5. **Hybrid Approach**
- Static QR for permanent locations
- Dynamic QR for high-security areas
- Fallback mechanisms for reliability

---

## 🔧 Implementation Checklist

### Phase 1: Database ✓
- [ ] Create migration file
- [ ] Update qr_code entity
- [ ] Update scan_log entity
- [ ] Update work_session entity
- [ ] Run migration

### Phase 2: Backend Core ✓
- [ ] Implement generateQrCodesForWorkCenter()
- [ ] Implement getMergedDynamicQrForJob()
- [ ] Update validateQRToken()
- [ ] Update recordScan()
- [ ] Update qr-code-refresh.service.ts

### Phase 3: Backend API ✓
- [ ] Create work-center-qr.controller.ts
- [ ] Implement PUT /work-centers/:id/signing-methods/qr
- [ ] Implement GET /work-centers/:id/qr-codes
- [ ] Implement POST /work-centers/:id/send-static-qr
- [ ] Implement GET /jobs/:id/merged-qr

### Phase 4: Frontend ✓
- [ ] Update qr-code-dialog.tsx API integration
- [ ] Create merged-qr-navbar.tsx component
- [ ] Create qr-auto-refresh logic
- [ ] Create send-static-qr.tsx component
- [ ] Update check-in-process.tsx validation

### Phase 5: Testing ✓
- [ ] Unit tests for QR generation
- [ ] Integration tests for validation
- [ ] E2E tests for check-in flow
- [ ] Email sending tests
- [ ] Performance tests for merged QR

---

## 📝 Notes

- **Migration Strategy**: Existing QR codes need manual assignment to work centers
- **Backward Compatibility**: Old endpoints can remain for transition period
- **Performance**: Cache merged QR codes for 3-minute intervals
- **Email**: Requires SMTP configuration
- **Mobile**: Ensure QR scanner works on all devices

---

## 🚀 Future Enhancements

1. **QR Analytics Dashboard** - Track scan rates per work center
2. **Geofencing Integration** - Combine QR + GPS validation
3. **Offline QR Validation** - Cache valid tokens for offline mode
4. **Custom QR Designs** - Branded QR codes with logos
5. **Multi-language Support** - QR instructions in multiple languages
6. **SMS Distribution** - Send static QR via SMS
7. **QR Expiry Notifications** - Alert before dynamic QR expires

---

**Last Updated:** January 26, 2026  
**Version:** 2.0  
**Status:** Implementation Ready 🎯
