# 🚀 DocVal API - Vercel Deployment Guide

## 📋 Overview

DocVal API is a serverless API for validating Mexican documents using GPT-4o Vision. This guide explains how to deploy to Vercel and consume the API.

## 🔧 Setup & Deployment

### 1. Install Dependencies

```bash
cd partrunner-docval-ai
npm install
```

### 2. Configure Environment Variables in Vercel

1. Go to [vercel.com](https://vercel.com) and import this repository
2. Navigate to **Settings → Environment Variables**
3. Add these variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `API_KEY` | `your-secure-key` | Auth key for your team |

### 3. Deploy

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
npm run vercel:deploy

# Deploy to production
npm run vercel:deploy:prod
```

---

## 📡 API Endpoints

Once deployed, your API will be available at:
```
https://your-project.vercel.app/api/
```

### Health Check

```http
GET /api/health
```

No authentication required. Returns API status and configuration.

**Example:**
```bash
curl https://your-project.vercel.app/api/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "service": "DocVal API",
  "version": "1.0.0",
  "checks": {
    "openaiConfigured": true,
    "apiKeyConfigured": true
  }
}
```

---

### Analyze Document (Base64)

```http
POST /api/documents/analyze-base64
```

Analyze a document image using GPT-4o Vision.

**Headers:**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**Body:**
```json
{
  "document": "base64-string-or-data-url",
  "mimeType": "image/jpeg",
  "documentType": "INE",
  "previousData": {
    "nombre": "Juan Pérez"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `document` | string | ✅ | Base64 encoded image or data URL |
| `mimeType` | string | ❌ | MIME type (auto-detected if data URL) |
| `documentType` | string | ❌ | Expected type: `INE`, `RFC`, `auto` (default) |
| `previousData` | object | ❌ | Previous data for cross-validation |

**Example:**
```bash
curl -X POST https://your-project.vercel.app/api/documents/analyze-base64 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "document": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "documentType": "INE"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "detectedType": "INE",
    "reason": "Documento válido. 🔧 2 correcciones aplicadas.",
    "confidence": 0.92,
    "extractedData": {
      "nombre": "Juan Pérez García",
      "curp": "PEGJ850101HDFRRL09",
      "claveElector": "PRGRJN85010109H800",
      "vigenciaFin": "2029"
    },
    "processingTime": 2340,
    "ocrCorrections": [
      "CURP: \"PEGJ85O1O1HDFRRL09\" → \"PEGJ850101HDFRRL09\""
    ]
  },
  "meta": {
    "analyzedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Validate Field

```http
POST /api/documents/validate-field
```

Validate and auto-correct a single field (CURP, RFC, CLABE, VIN, Placas).

**Headers:**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**Body:**
```json
{
  "field": "curp",
  "value": "PEGJ85O1O1HDFRRL09"
}
```

**Valid Fields:** `curp`, `rfc`, `clabe`, `vin`, `placas`

**Example:**
```bash
curl -X POST https://your-project.vercel.app/api/documents/validate-field \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"field": "curp", "value": "PEGJ85O1O1HDFRRL09"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "field": "curp",
    "originalValue": "PEGJ85O1O1HDFRRL09",
    "valid": true,
    "corrected": "PEGJ850101HDFRRL09",
    "confidence": 0.85,
    "corrections": [
      "Position 4: O → 0",
      "Position 6: O → 0"
    ]
  }
}
```

---

### Get Supported Types

```http
GET /api/documents/supported-types
```

Get list of supported document types and extractable fields.

**Headers:**
```http
X-API-Key: your-api-key
```

**Example:**
```bash
curl https://your-project.vercel.app/api/documents/supported-types \
  -H "X-API-Key: your-api-key"
```

---

## 💻 Code Examples

### JavaScript/TypeScript

```typescript
const DOCVAL_API = 'https://your-project.vercel.app/api';
const API_KEY = 'your-api-key';

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

// Analyze document
async function analyzeDocument(file: File, documentType = 'auto') {
  const base64 = await fileToBase64(file);
  
  const response = await fetch(`${DOCVAL_API}/documents/analyze-base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      document: base64,
      documentType,
    }),
  });

  return response.json();
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const result = await analyzeDocument(file, 'INE');
  
  if (result.success && result.data.isValid) {
    console.log('✅ Valid!', result.data.extractedData);
  } else {
    console.log('❌ Invalid:', result.data.reason);
  }
});
```

### Python

```python
import requests
import base64

DOCVAL_API = 'https://your-project.vercel.app/api'
API_KEY = 'your-api-key'

def analyze_document(file_path: str, document_type: str = 'auto'):
    # Read and encode file
    with open(file_path, 'rb') as f:
        content = f.read()
    
    # Detect MIME type
    mime_type = 'image/jpeg' if file_path.endswith('.jpg') else 'image/png'
    base64_data = base64.b64encode(content).decode('utf-8')
    data_url = f'data:{mime_type};base64,{base64_data}'
    
    # Call API
    response = requests.post(
        f'{DOCVAL_API}/documents/analyze-base64',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
        },
        json={
            'document': data_url,
            'documentType': document_type,
        }
    )
    
    return response.json()

# Usage
result = analyze_document('/path/to/ine.jpg', 'INE')
if result['success'] and result['data']['isValid']:
    print('✅ Valid!')
    print(f"Nombre: {result['data']['extractedData'].get('nombre')}")
    print(f"CURP: {result['data']['extractedData'].get('curp')}")
else:
    print(f"❌ Invalid: {result['data']['reason']}")
```

### PHP

```php
<?php
$DOCVAL_API = 'https://your-project.vercel.app/api';
$API_KEY = 'your-api-key';

function analyzeDocument($filePath, $documentType = 'auto') {
    global $DOCVAL_API, $API_KEY;
    
    // Read and encode file
    $content = file_get_contents($filePath);
    $mimeType = mime_content_type($filePath);
    $base64 = base64_encode($content);
    $dataUrl = "data:{$mimeType};base64,{$base64}";
    
    // Prepare request
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "{$DOCVAL_API}/documents/analyze-base64",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            "X-API-Key: {$API_KEY}",
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'document' => $dataUrl,
            'documentType' => $documentType,
        ]),
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Usage
$result = analyzeDocument('/path/to/ine.jpg', 'INE');
if ($result['success'] && $result['data']['isValid']) {
    echo "✅ Valid!\n";
    echo "Nombre: " . $result['data']['extractedData']['nombre'] . "\n";
    echo "CURP: " . $result['data']['extractedData']['curp'] . "\n";
} else {
    echo "❌ Invalid: " . $result['data']['reason'] . "\n";
}
```

---

## ⚠️ Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MISSING_API_KEY` | 401 | X-API-Key header missing |
| `INVALID_API_KEY` | 403 | Invalid API key |
| `MISSING_DOCUMENT` | 400 | No document provided |
| `INVALID_DOCUMENT_FORMAT` | 400 | Document must be base64 |
| `MISSING_FIELD` | 400 | Field parameter missing |
| `INVALID_FIELD` | 400 | Invalid field type |
| `CONFIG_ERROR` | 503 | Server misconfiguration |
| `RATE_LIMIT` | 429 | Too many requests |
| `ANALYSIS_ERROR` | 500 | GPT-4o analysis failed |

---

## 📊 Limits

| Limit | Free Plan | Pro Plan |
|-------|-----------|----------|
| Timeout | 10s | 60s |
| Memory | 1024MB | 3008MB |
| Body Size | 4.5MB | 4.5MB |

**Note:** For images larger than 4.5MB, resize before uploading or use presigned URLs.

---

## 🔒 Security Best Practices

1. **Never expose API_KEY in frontend code** - Use a backend proxy
2. **Rotate API keys** periodically
3. **Use HTTPS** always
4. **Implement rate limiting** in your application
5. **Log and monitor** API usage

---

## 📞 Support

For issues or questions, contact the development team.

---

Built with ❤️ by PartRunner

