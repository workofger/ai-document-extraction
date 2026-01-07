# DocVal API - Document Validation Service

API REST para validación de documentos mexicanos con IA.

## 🚀 Inicio Rápido

### Instalación

```bash
cd api
npm install
```

### Configuración

Crea un archivo `.env`:

```env
OPENAI_API_KEY=sk-your-api-key
API_KEY=your-secret-api-key
PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://admin.partrunner.com
```

### Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm run build && npm start
```

## 📡 Endpoints

### Health Check

```bash
GET /api/health
```

No requiere autenticación.

---

### Analizar Documento (Multipart)

```bash
POST /api/documents/analyze
Content-Type: multipart/form-data
X-API-Key: your-api-key
```

**Parámetros:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `document` | File | ✅ | Archivo imagen o PDF |
| `documentType` | string | ❌ | Tipo esperado (default: "auto") |
| `previousData` | JSON string | ❌ | Datos previos para validación cruzada |

**Ejemplo con cURL:**

```bash
curl -X POST http://localhost:3001/api/documents/analyze \
  -H "X-API-Key: your-api-key" \
  -F "document=@/path/to/ine.jpg" \
  -F "documentType=INE"
```

**Ejemplo con JavaScript:**

```javascript
const formData = new FormData();
formData.append('document', fileInput.files[0]);
formData.append('documentType', 'INE');

const response = await fetch('http://localhost:3001/api/documents/analyze', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key'
  },
  body: formData
});

const result = await response.json();
```

**Respuesta exitosa:**

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
    "timestamp": "2024-01-15T10:30:00.000Z",
    "processingTime": 2340,
    "ocrCorrections": [
      "CURP: \"PEGJ85O1O1HDFRRL09\" → \"PEGJ850101HDFRRL09\""
    ]
  },
  "meta": {
    "fileName": "ine.jpg",
    "fileSize": 245678,
    "mimeType": "image/jpeg",
    "analyzedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### Analizar Documento (Base64)

```bash
POST /api/documents/analyze-base64
Content-Type: application/json
X-API-Key: your-api-key
```

**Body:**

```json
{
  "document": "base64-encoded-image-or-data-url",
  "mimeType": "image/jpeg",
  "documentType": "INE",
  "previousData": {
    "nombre": "Juan Pérez García"
  }
}
```

**Ejemplo con JavaScript:**

```javascript
// Convertir archivo a base64
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
});

const base64 = await toBase64(file);

const response = await fetch('http://localhost:3001/api/documents/analyze-base64', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    document: base64,
    documentType: 'auto'
  })
});
```

---

### Validar Campo Individual

```bash
POST /api/documents/validate-field
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

**Campos soportados:** `curp`, `rfc`, `clabe`, `vin`, `placas`

**Respuesta:**

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

### Obtener Tipos Soportados

```bash
GET /api/documents/supported-types
X-API-Key: your-api-key
```

---

## 🔐 Autenticación

Todas las rutas `/api/documents/*` requieren el header `X-API-Key`.

```bash
X-API-Key: your-secret-api-key
```

---

## ⚠️ Códigos de Error

| Código | HTTP | Descripción |
|--------|------|-------------|
| `MISSING_API_KEY` | 401 | Falta header X-API-Key |
| `INVALID_API_KEY` | 403 | API key inválida |
| `MISSING_FILE` | 400 | No se envió archivo |
| `VALIDATION_ERROR` | 400 | Error en parámetros |
| `RATE_LIMIT_EXCEEDED` | 429 | Demasiadas solicitudes |
| `AI_SERVICE_ERROR` | 502 | Error en OpenAI |
| `ANALYSIS_ERROR` | 500 | Error en análisis |

---

## 🔧 Integración con Admin System

### PHP Example

```php
<?php
$curl = curl_init();

$file = new CURLFile('/path/to/document.jpg', 'image/jpeg', 'document.jpg');

curl_setopt_array($curl, [
    CURLOPT_URL => 'https://api.partrunner.com/api/documents/analyze',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-API-Key: your-api-key'
    ],
    CURLOPT_POSTFIELDS => [
        'document' => $file,
        'documentType' => 'INE'
    ]
]);

$response = curl_exec($curl);
$result = json_decode($response, true);

if ($result['success']) {
    $extractedData = $result['data']['extractedData'];
    // Usar los datos extraídos
}
```

### Python Example

```python
import requests

url = 'https://api.partrunner.com/api/documents/analyze'
headers = {'X-API-Key': 'your-api-key'}

with open('/path/to/document.jpg', 'rb') as f:
    files = {'document': f}
    data = {'documentType': 'INE'}
    response = requests.post(url, headers=headers, files=files, data=data)

result = response.json()
if result['success']:
    extracted = result['data']['extractedData']
    print(f"Nombre: {extracted.get('nombre')}")
    print(f"CURP: {extracted.get('curp')}")
```

### Node.js Example

```javascript
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function analyzeDocument(filePath) {
  const form = new FormData();
  form.append('document', fs.createReadStream(filePath));
  form.append('documentType', 'auto');

  const response = await fetch('https://api.partrunner.com/api/documents/analyze', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.DOCVAL_API_KEY,
      ...form.getHeaders()
    },
    body: form
  });

  return response.json();
}
```

---

## 📊 Rate Limits

- **30 requests/minuto** por API key
- **100MB** tamaño máximo de archivo
- **60 segundos** timeout por request

---

## 🏷️ Tipos de Documento

| ID | Nombre | Campos Extraídos |
|----|--------|------------------|
| `ine` | INE/IFE | nombre, curp, claveElector, vigenciaFin |
| `licencia` | Licencia de Conducir | nombre, numeroLicencia, tipoLicencia, vigenciaFin |
| `rfc` | Constancia Fiscal | nombre, rfc, razonSocial, codigoPostal |
| `circulacion` | Tarjeta de Circulación | placas, vin, modelo, marca, anio |
| `poliza` | Póliza de Seguro | aseguradora, poliza, vigenciaFin, placas |
| `banco` | Carátula Bancaria | banco, clabe, nombre |
| `auto` | Detección Automática | Todos los campos posibles |

