# QR Code Job Scanning System

This implementation adds QR code generation and scanning functionality to the job management system, allowing workers to check in/out of jobs by scanning QR codes.

## Features

### 🔧 Backend Implementation

#### New Entities
- **ScanLog**: Records all scanning events with timestamps, location, and scan type
- Relations added to Job and Worker entities for scan logs

#### New Endpoints

1. **Generate QR Code**
   - `POST /jobs/generate-qr`
   - Creates a QR code containing job information
   - Returns base64 encoded QR code image

2. **Record Scan**
   - `POST /jobs/scan`
   - Records worker scan events (check-in, check-out, break-start, break-end)
   - Validates worker assignment to job

3. **Scan History**
   - `GET /jobs/:jobId/scan-history` - Get all scans for a job
   - `GET /jobs/worker/:workerId/scan-history` - Get all scans for a worker

4. **Attendance Summary**
   - `GET /jobs/:jobId/attendance-summary` - Get today's attendance for a job

## 📦 Installation

### Dependencies Added
```bash
npm install qrcode @types/qrcode
```

### Database Changes
- New `scan_logs` table with foreign keys to `job` and `workers` tables
- Indexes on job_id, worker_id, and scan_time for performance

## 🚀 Usage Examples

### Generate QR Code for Job
```typescript
POST /jobs/generate-qr
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "jobId": 1
}

Response:
{
  "qrCode": "data:image/png;base64,iVBOR...", // Base64 QR code image
  "jobData": {
    "jobId": 1,
    "jobName": "Construction Project A",
    "clientName": "ABC Corp",
    "workCenter": "Downtown Site",
    "startDate": "2024-01-15",
    "endDate": "2024-01-20",
    "timestamp": "2024-01-15T08:00:00.000Z"
  }
}
```

### Record Worker Check-in
```typescript
POST /jobs/scan
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "jobId": 1,
  "scanType": "check-in",
  "location": "40.7128,-74.0060", // GPS coordinates (optional)
  "notes": "Arrived on time" // Optional notes
}

Response:
{
  "status": "Scan recorded successfully",
  "scanData": {
    "id": 123,
    "jobId": 1,
    "workerId": 5, // Automatically extracted from JWT token
    "scanType": "check-in",
    "scanTime": "2024-01-15T08:00:00.000Z",
    "location": "40.7128,-74.0060",
    "notes": "Arrived on time"
  }
}
```

### Scan Types Supported
- `check-in` - Worker arrives at job site
- `check-out` - Worker leaves job site  
- `break-start` - Worker starts break
- `break-end` - Worker ends break

## 🏗️ Database Schema

### ScanLog Entity
```sql
CREATE TABLE scan_logs (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  scanType VARCHAR(50) DEFAULT 'check-in',
  location TEXT,
  notes TEXT,
  scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IDX_SCAN_LOGS_JOB_ID ON scan_logs(job_id);
CREATE INDEX IDX_SCAN_LOGS_WORKER_ID ON scan_logs(worker_id);
CREATE INDEX IDX_SCAN_LOGS_SCAN_TIME ON scan_logs(scan_time);
```

## 🔐 Security Features

- All endpoints require JWT authentication
- Worker ID is automatically extracted from JWT token - no manual worker ID needed
- Worker assignment validation - workers can only scan for jobs they're assigned to
- Job existence validation before generating QR codes or recording scans

## 📱 Frontend Integration

The QR codes generated can be:
1. **Displayed on web dashboard** - Employers can show QR codes for jobs
2. **Printed on job sheets** - Physical QR codes for job sites
3. **Scanned with mobile apps** - Workers use camera to scan and send scan data

### Frontend QR Scanner Integration
```typescript
// Example frontend code to handle scan
const handleQrScan = async (scannedData: string) => {
  try {
    const jobData = JSON.parse(scannedData);
    
    // Send scan event to backend - workerId is automatically extracted from JWT token
    const response = await fetch('/jobs/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        jobId: jobData.jobId,
        scanType: 'check-in', // or user selected type
        location: await getCurrentLocation(), // Optional GPS
        notes: userNotes // Optional
      })
    });
    
    const result = await response.json();
    console.log('Scan recorded:', result);
  } catch (error) {
    console.error('Scan failed:', error);
  }
};
```

## 📊 Reports and Analytics

The scan logs enable powerful reporting:

1. **Daily Attendance Reports** - Who checked in/out when
2. **Time Tracking** - Calculate work hours from check-in/out times
3. **Location Verification** - Verify workers are at correct job sites
4. **Break Time Analysis** - Track break durations
5. **Compliance Reports** - Ensure workers follow check-in/out procedures

## 🔄 Data Flow

```
1. Employer generates QR code for job
   ↓
2. QR code displayed/printed for job site
   ↓  
3. Worker scans QR code with mobile device
   ↓
4. Mobile app sends scan data to backend
   ↓
5. Backend validates and records scan
   ↓
6. Real-time attendance tracking updated
```

## 🚨 Error Handling

The system handles various error scenarios:
- **Job not found** - Invalid job ID in QR code
- **Worker not found** - Invalid worker ID
- **Worker not assigned** - Worker trying to scan job they're not assigned to
- **Invalid scan type** - Unsupported scan type provided
- **QR code generation fails** - Backend errors in QR generation

## 🔧 Configuration

QR Code generation options can be customized:
```typescript
const qrOptions = {
  errorCorrectionLevel: 'M', // L, M, Q, H
  margin: 1,
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
  width: 256, // QR code size in pixels
};
```

## 📈 Performance Considerations

- Database indexes on frequently queried columns (job_id, worker_id, scan_time)
- Foreign key constraints ensure data integrity
- Pagination recommended for large scan history queries
- Consider archiving old scan logs for performance

## 🔮 Future Enhancements

- **Geofencing** - Validate worker location against job site boundaries
- **Photo capture** - Allow workers to take photos when scanning
- **Offline scanning** - Queue scans when network unavailable
- **Biometric verification** - Add fingerprint/face recognition
- **Advanced reporting** - More detailed analytics and dashboards
- **Multi-language QR codes** - Support for different languages
- **Custom scan types** - Allow employers to define custom scan events
