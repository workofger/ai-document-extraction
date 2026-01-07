# 🚀 Guía Completa: Desplegar DocVal API en Vercel

## 📋 Contexto del Proyecto

**DocVal API** es una API serverless para validar documentos mexicanos (INE, RFC, Licencia, etc.) usando GPT-4o Vision de OpenAI. Extrae automáticamente datos como CURP, RFC, nombres, etc. y los corrige por errores de OCR.

### Estructura del Proyecto (YA CONFIGURADA)

```
partrunner-docval-ai/
├── api-vercel/                    # ← API Serverless para Vercel
│   ├── _lib/
│   │   ├── auth.ts               # Autenticación X-API-Key
│   │   ├── cors.ts               # Middleware CORS
│   │   └── documentService.ts    # Servicio GPT-4o Vision
│   ├── documents/
│   │   ├── analyze-base64.ts     # POST: Analizar documento
│   │   ├── validate-field.ts     # POST: Validar campo
│   │   └── supported-types.ts    # GET: Tipos soportados
│   ├── health.ts                 # GET: Health check
│   └── tsconfig.json             # ← Config TypeScript para API
├── src/                          # Frontend React (Vite)
├── vercel.json                   # ← Config de Vercel (rewrites + functions)
├── tsconfig.json                 # ← Config TypeScript para Frontend
└── package.json                  # ← Dependencias (ya incluye @vercel/node)
```

---

## ✅ Archivos Ya Configurados

### 1. vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "name": "docval-api",
  "rewrites": [
    {
      "source": "/api/health",
      "destination": "/api-vercel/health"
    },
    {
      "source": "/api/documents/:path*",
      "destination": "/api-vercel/documents/:path*"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        { "key": "Access-Control-Allow-Headers", "value": "X-API-Key, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" }
      ]
    }
  ],
  "functions": {
    "api-vercel/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

**Nota**: No incluye `buildCommand`, `outputDirectory` ni `framework` porque Vercel detecta automáticamente el frontend Vite y las serverless functions por separado.

### 2. package.json (Dependencias)

```json
{
  "dependencies": {
    "openai": "^4.77.0"
  },
  "devDependencies": {
    "@vercel/node": "^3.2.0",
    "@types/node": "^22.10.2",
    "typescript": "~5.7.2",
    "vercel": "^37.0.0"
  }
}
```

### 3. api-vercel/tsconfig.json (TypeScript para Serverless)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "@vercel/node"]
  },
  "include": ["./**/*.ts"]
}
```

### 4. Imports en los Endpoints

Los imports usan rutas relativas correctas:

- `api-vercel/health.ts` → importa desde `./_lib/cors`
- `api-vercel/documents/*.ts` → importan desde `../_lib/cors`, `../_lib/auth`, `../_lib/documentService`

---

## 🎯 Endpoints Disponibles

| Método | Ruta Pública | Archivo Real | Descripción |
|--------|--------------|--------------|-------------|
| GET | `/api/health` | `api-vercel/health.ts` | Health check (sin auth) |
| POST | `/api/documents/analyze-base64` | `api-vercel/documents/analyze-base64.ts` | Analizar documento |
| POST | `/api/documents/validate-field` | `api-vercel/documents/validate-field.ts` | Validar CURP/RFC/etc |
| GET | `/api/documents/supported-types` | `api-vercel/documents/supported-types.ts` | Listar tipos |

---

## 🔐 Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API Key de OpenAI para GPT-4o Vision | `sk-proj-...` |
| `API_KEY` | Clave para autenticar consumidores de la API | `mi-clave-secreta-123` |

---

## 📝 Pasos para Desplegar

### Paso 1: Instalar dependencias localmente

```bash
cd partrunner-docval-ai
npm install
```

### Paso 2: Instalar Vercel CLI (si no lo tienes)

```bash
npm install -g vercel
```

### Paso 3: Login en Vercel

```bash
vercel login
```

### Paso 4: Vincular el proyecto

```bash
vercel link
```

Esto te pedirá:
- ¿Configurar el directorio actual? → **Sí**
- ¿Cuál es el scope? → **Selecciona tu cuenta/equipo**
- ¿Vincular a un proyecto existente? → **No** (crea uno nuevo)
- ¿Nombre del proyecto? → **docval-api** (o el que prefieras)

### Paso 5: Configurar variables de entorno

**Opción A: Por CLI**
```bash
vercel env add OPENAI_API_KEY
# Te pedirá el valor, pega tu API key de OpenAI
# Selecciona: Production, Preview, Development

vercel env add API_KEY
# Genera una clave segura: openssl rand -base64 32
# Selecciona: Production, Preview, Development
```

**Opción B: Por Dashboard**
1. Ve a [vercel.com](https://vercel.com)
2. Selecciona tu proyecto
3. Settings → Environment Variables
4. Agrega `OPENAI_API_KEY` y `API_KEY`

### Paso 6: Desplegar a preview

```bash
vercel
```

Esto desplegará a una URL de preview como: `https://docval-api-xxx.vercel.app`

### Paso 7: Probar que funciona

```bash
# Health check (sin autenticación)
curl https://docval-api-xxx.vercel.app/api/health

# Debería responder:
# {"success":true,"status":"healthy","service":"DocVal API"...}
```

### Paso 8: Desplegar a producción

```bash
vercel --prod
```

---

## 🧪 Probar la API

### Health Check (sin auth)

```bash
curl https://tu-proyecto.vercel.app/api/health
```

### Analizar Documento (con auth)

```bash
curl -X POST https://tu-proyecto.vercel.app/api/documents/analyze-base64 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-clave-secreta" \
  -d '{
    "document": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "documentType": "INE"
  }'
```

### Validar Campo (con auth)

```bash
curl -X POST https://tu-proyecto.vercel.app/api/documents/validate-field \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-clave-secreta" \
  -d '{"field": "curp", "value": "PEGJ85O1O1HDFRRL09"}'
```

---

## 🐛 Solución de Problemas

### Error: "Cannot find module '@vercel/node'"

```bash
npm install @vercel/node --save-dev
```

### Error: "OPENAI_API_KEY not configured"

Asegúrate de haber configurado la variable de entorno:
```bash
vercel env ls  # Ver variables configuradas
vercel env add OPENAI_API_KEY  # Agregar si falta
```

### Error: "Invalid API key"

El header `X-API-Key` no coincide con la variable `API_KEY` configurada.

### Error 504 Timeout

GPT-4o Vision puede tardar 10-30 segundos. El `maxDuration: 60` está configurado, pero necesitas **Vercel Pro** para timeouts mayores a 10 segundos.

### CORS Error en Frontend

El middleware CORS ya está configurado. Si persiste, verifica que tu dominio esté en la lista de `ALLOWED_ORIGINS` en `api-vercel/_lib/cors.ts`.

---

## ✅ Checklist Final

- [ ] `npm install` ejecutado
- [ ] `vercel login` completado
- [ ] `vercel link` vinculado al proyecto
- [ ] `OPENAI_API_KEY` configurada en Vercel
- [ ] `API_KEY` configurada en Vercel
- [ ] `vercel` desplegado a preview
- [ ] Health check responde correctamente
- [ ] `vercel --prod` desplegado a producción
- [ ] URL y API_KEY compartidas con el equipo

---

## 💻 Ejemplo de Uso para tu Equipo

```javascript
const DOCVAL_API = 'https://tu-proyecto.vercel.app/api';
const API_KEY = 'clave-compartida-con-equipo';

// Analizar un documento
async function analyzeDocument(base64Image, documentType = 'auto') {
  const response = await fetch(`${DOCVAL_API}/documents/analyze-base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      document: base64Image,
      documentType: documentType
    })
  });
  
  return response.json();
}

// Ejemplo
const result = await analyzeDocument(miImagenBase64, 'INE');
if (result.success && result.data.isValid) {
  console.log('CURP:', result.data.extractedData.curp);
  console.log('Nombre:', result.data.extractedData.nombre);
}
```

---

**¡Listo para desplegar!** 🚀
