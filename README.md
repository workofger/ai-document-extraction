# DocVal API

API de validación de documentos mexicanos con **pipeline híbrido OCR**:
1. 🔍 **Google Cloud Vision** - Extracción de texto de alta precisión
2. 🧠 **GPT-4o** - Interpretación semántica y estructuración
3. ✅ **Checksum Validation** - Verificación matemática (CURP, RFC, CLABE)

## 🚀 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check (sin auth) |
| POST | `/api/documents/analyze` | Analizar imagen (URL, base64, file) |
| POST | `/api/documents/analyze-base64` | Analizar documento (solo base64) |
| POST | `/api/documents/validate-field` | Validar CURP/RFC/CLABE/VIN |
| GET | `/api/documents/supported-types` | Listar tipos soportados |

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
    "processingTime": 1850
  }
}
```

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
    "corrections": ["Position 4: O → 0", "Position 6: O → 0"]
  }
}
```

## 📋 Tipos de Documento Soportados

- **INE** - Credencial para votar
- **Licencia** - Licencia de conducir
- **RFC** - Constancia de situación fiscal
- **Tarjeta de Circulación** - Tarjeta vehicular
- **Póliza de Seguro** - Póliza de seguro vehicular
- **CLABE** - Datos bancarios

## 🔧 Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | API Key de OpenAI (GPT-4o) | ✅ Sí |
| `API_KEY` | Clave para autenticar consumidores | ✅ Sí |
| `GOOGLE_CLOUD_API_KEY` | API Key de Google Cloud Vision | ⚡ Recomendada |

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
│   │   ├── documentService.ts    # Pipeline híbrido
│   │   └── googleVisionService.ts # Google Cloud Vision OCR
│   ├── documents/
│   │   ├── analyze.ts            # POST: Analizar (URL/file/base64)
│   │   ├── analyze-base64.ts     # POST: Analizar (solo base64)
│   │   ├── validate-field.ts     # POST: Validar campo
│   │   └── supported-types.ts    # GET: Tipos soportados
│   ├── health.ts                 # GET: Health check
│   └── tsconfig.json
├── index.html                    # Documentación
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
