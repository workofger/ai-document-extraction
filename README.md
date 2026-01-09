# DocVal API

API de validación de documentos mexicanos usando GPT-4o Vision.

## 🚀 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check (sin auth) |
| POST | `/api/documents/analyze-base64` | Analizar documento |
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

### Analizar Documento

```bash
curl -X POST https://ai-document-extraction.vercel.app/api/documents/analyze-base64 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key" \
  -d '{
    "document": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "documentType": "INE"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "detectedType": "INE",
    "confidence": 0.92,
    "extractedData": {
      "nombre": "Juan Pérez García",
      "curp": "PEGJ850101HDFRRL09",
      "claveElector": "PRGRJN85010109H800"
    },
    "processingTime": 2340
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

| Variable | Descripción |
|----------|-------------|
| `OPENAI_API_KEY` | API Key de OpenAI |
| `API_KEY` | Clave para autenticar consumidores |

## 📁 Estructura

```
docval-api/
├── api/
│   ├── lib/
│   │   ├── auth.ts           # Autenticación X-API-Key
│   │   ├── cors.ts           # Middleware CORS
│   │   └── documentService.ts # Servicio GPT-4o Vision
│   ├── documents/
│   │   ├── analyze-base64.ts  # POST: Analizar documento
│   │   ├── validate-field.ts  # POST: Validar campo
│   │   └── supported-types.ts # GET: Tipos soportados
│   ├── health.ts              # GET: Health check
│   └── tsconfig.json
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

---

**Desarrollado por PartRunner**
