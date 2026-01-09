# DocVal API v1.1

API de validación de documentos mexicanos con **pipeline híbrido OCR**:
1. 🔍 **Google Cloud Vision** - Extracción de texto de alta precisión
2. 🧠 **GPT-4o** - Interpretación semántica y estructuración
3. ✅ **Checksum Validation** - Verificación matemática (CURP, RFC, CLABE, VIN, NSS)
4. 🛡️ **Fraud Detection** - Análisis de autenticidad y detección de inconsistencias

## 🚀 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check (sin auth) |
| POST | `/api/documents/analyze` | Analizar imagen (URL, base64, file) |
| POST | `/api/documents/analyze-base64` | Analizar documento (solo base64) |
| POST | `/api/documents/validate-field` | Validar CURP/RFC/CLABE/VIN/NSS |
| GET | `/api/documents/supported-types` | Listar tipos soportados |
| GET | `/api/metrics` | Dashboard de métricas y estadísticas |

## 🔐 Autenticación

Todas las rutas (excepto `/api/health`) requieren el header:

```
X-API-Key: tu-api-key
```

## 📡 Uso

### Health Check

```bash
curl https://ai-document-extraction.vercel.app/api/health
```

### Analizar con URL (Recomendado)

```bash
curl -X POST https://ai-document-extraction.vercel.app/api/documents/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key" \
  -d '{"url": "https://ejemplo.com/ine.jpg"}'
```

### Analizar con File Upload

```bash
curl -X POST https://ai-document-extraction.vercel.app/api/documents/analyze \
  -H "X-API-Key: tu-api-key" \
  -F "file=@documento.jpg"
```

### Analizar con Base64

```bash
curl -X POST https://ai-document-extraction.vercel.app/api/documents/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key" \
  -d '{
    "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "detectedType": "INE",
    "confidence": 0.94,
    "extractedData": {
      "nombre": "Juan Pérez García",
      "curp": "PEGJ850101HDFRRL09",
      "claveElector": "PRGRJN85010109H800"
    },
    "ocrEngine": "hybrid",
    "visionConfidence": 0.97,
    "imageQuality": "buena",
    "ocrCorrections": ["Verification digit: 8 → 9 (checksum)"],
    "fraudAnalysis": {
      "isAuthentic": true,
      "riskLevel": "low",
      "riskScore": 5,
      "fraudIndicators": [],
      "recommendations": []
    },
    "processingTime": 1850
  }
}
```

## 🛡️ Detección de Fraude

Cada análisis incluye un objeto `fraudAnalysis` con:

- **riskLevel**: `low` | `medium` | `high` | `critical`
- **riskScore**: 0-100 (mayor = más riesgo)
- **fraudIndicators**: Lista de indicadores detectados
- **recommendations**: Recomendaciones de acción

**Indicadores detectados:**
- Inconsistencias CURP ↔ RFC
- Código de estado inválido en CURP
- Género inconsistente
- Fechas de nacimiento imposibles
- Documentos vencidos
- Fechas de vigencia sospechosas
- Patrones de nombres de prueba
- Campos ilegibles excesivos

### Validar Campo

```bash
curl -X POST https://ai-document-extraction.vercel.app/api/documents/validate-field \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key" \
  -d '{"field": "curp", "value": "PEGJ85O1O1HDFRRL09"}'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "field": "curp",
    "originalValue": "PEGJ85O1O1HDFRRL09",
    "valid": true,
    "corrected": "PEGJ850101HDFRRL09",
    "confidence": 0.94,
    "corrections": ["Position 4: O → 0", "Position 6: O → 0", "Verification digit: 8 → 9 (checksum)"]
  }
}
```

**Campos validables:** `curp`, `rfc`, `clabe`, `vin`, `placas`, `nss`

### Métricas y Dashboard

```bash
curl https://ai-document-extraction.vercel.app/api/metrics \
  -H "X-API-Key: tu-api-key"
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalRequests": 1542,
      "successRate": "94.50%",
      "uptime": "2h 35m"
    },
    "fraud": {
      "totalChecks": 1450,
      "flaggedDocuments": 12,
      "flagRate": "0.83%"
    },
    "capabilities": {
      "supportedDocumentTypes": 24,
      "extractableFields": 35,
      "validatableFields": ["curp", "rfc", "clabe", "vin", "placas", "nss"]
    }
  }
}
```

## 📋 Tipos de Documento Soportados (24+)

### 📇 Identificación Personal
- **INE/IFE** - Credencial de elector
- **Licencia de Conducir** - Licencia mexicana
- **Pasaporte** - Pasaporte mexicano
- **Cédula Profesional** - Cédula de la SEP
- **Cartilla Militar** - Servicio Militar Nacional

### 📋 Seguridad Social
- **IMSS** - Credencial y NSS
- **ISSSTE** - Credencial ISSSTE

### 💼 Documentos Fiscales
- **Constancia RFC** - Constancia de situación fiscal
- **Carátula Bancaria** - Estado de cuenta

### 🚗 Documentos Vehiculares
- **Tarjeta de Circulación** - Registro vehicular
- **Póliza de Seguro** - Seguro vehicular
- **Verificación Vehicular** - Constancia de verificación

### 📸 Fotografías de Vehículos
- **Foto Frontal** - Vista frontal del vehículo
- **Foto Lateral** - Vista lateral
- **Foto Trasera** - Vista trasera con placas
- **Foto VIN** - Número de serie
- **Foto Motor** - Compartimento del motor
- **Foto Odómetro** - Tablero y kilometraje
- **Foto Placas** - Placas vehiculares
- **Foto Daños** - Documentación de daños

### 🏠 Otros
- **Comprobante de Domicilio** - CFE, agua, gas, teléfono
- **Acta Constitutiva** - Empresas
- **Poder Notarial** - Poderes legales
- **Carta de Antecedentes** - No antecedentes penales

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API Key (GPT-4o) | ✅ Yes |
| `API_KEY` | Key for API consumers | ✅ Yes |
| `GOOGLE_CLOUD_API_KEY` | Google Cloud Vision API Key | ⚡ Recommended |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | 🔒 For docs auth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | 🔒 For docs auth |

> **Nota**: Sin `GOOGLE_CLOUD_API_KEY`, la API funciona solo con GPT-4o Vision. Con ella habilitada, se activa el pipeline híbrido que mejora significativamente la precisión.

## ⚠️ Manejo de Datos Ilegibles

La API **nunca inventa datos**. Si un campo no es legible:

- Caracteres individuales ilegibles: se marcan con `*` (ej: `PEGJ85*1*1HDFRRL09`)
- Campos completamente ilegibles: se marcan con `***`
- Documentos con 3+ campos ilegibles o mala calidad: se rechazan con `isValid: false`

**Campos en respuesta:**
- `imageQuality`: `buena` | `regular` | `mala` | `ilegible`
- `illegibleFields`: Array de campos que no pudieron leerse
- `ocrCorrections`: Correcciones OCR aplicadas

## 📁 Estructura

```
docval-api/
├── api/
│   ├── lib/
│   │   ├── auth.ts               # Autenticación X-API-Key
│   │   ├── cors.ts               # Middleware CORS
│   │   ├── documentService.ts    # Pipeline híbrido + validaciones
│   │   ├── fraudDetection.ts     # Detección de fraude
│   │   └── googleVisionService.ts # Google Cloud Vision OCR
│   ├── documents/
│   │   ├── analyze.ts            # POST: Analizar (URL/file/base64)
│   │   ├── analyze-base64.ts     # POST: Analizar (solo base64)
│   │   ├── validate-field.ts     # POST: Validar campo
│   │   └── supported-types.ts    # GET: Tipos soportados
│   ├── health.ts                 # GET: Health check
│   ├── metrics.ts                # GET: Dashboard de métricas
│   └── tsconfig.json
├── index.html                    # Documentación interactiva
├── package.json
├── tsconfig.json
└── vercel.json
```

## 🚀 Deploy

El proyecto se despliega automáticamente en Vercel al hacer push a `main`.

```bash
# Deploy manual
npx vercel --prod
```

## 🔑 Configurar Google Cloud Vision

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Habilita la API "Cloud Vision API"
3. Crea una API Key en "Credentials"
4. Añade `GOOGLE_CLOUD_API_KEY` en las variables de entorno de Vercel

---

**Desarrollado por PartRunner**
