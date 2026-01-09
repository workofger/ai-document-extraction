# Google Document AI Setup Guide (v2)

Esta guía explica cómo configurar Google Document AI con Service Account para procesamiento nativo de PDFs.

## Requisitos Previos

- Cuenta de Google Cloud con billing habilitado
- Proyecto de Google Cloud existente
- Document AI API habilitada

## Paso 1: Crear Service Account

1. Ve a [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

2. Click en **"+ CREATE SERVICE ACCOUNT"**

3. Llena los campos:
   - **Service account name**: `docval-document-ai`
   - **Service account ID**: (se genera automáticamente)
   - **Description**: `Service account for DocVal API PDF processing`

4. Click **"CREATE AND CONTINUE"**

## Paso 2: Asignar Roles

En la sección "Grant this service account access to project":

1. Click en **"+ ADD ANOTHER ROLE"**

2. Busca y selecciona: **"Document AI API User"**

3. (Opcional) Agrega también: **"Document AI Viewer"**

4. Click **"CONTINUE"** y luego **"DONE"**

## Paso 3: Crear Key JSON

1. En la lista de Service Accounts, click en el que acabas de crear

2. Ve a la pestaña **"KEYS"**

3. Click en **"ADD KEY"** > **"Create new key"**

4. Selecciona **"JSON"** y click **"CREATE"**

5. El archivo JSON se descargará automáticamente. **Guárdalo de forma segura.**

## Paso 4: Crear Document AI Processor

1. Ve a [Document AI](https://console.cloud.google.com/ai/document-ai)

2. Click en **"+ CREATE PROCESSOR"**

3. Selecciona **"Document OCR"** (para extracción de texto general)

4. Configura:
   - **Processor name**: `partrunner-documents`
   - **Region**: `us` (o `eu` si prefieres)

5. Click **"CREATE"**

6. Copia el **Processor ID** (algo como `5766948fdfdc0f38`)

## Paso 5: Configurar Variables de Entorno

### Opción A: Base64 del JSON Key

```bash
# Convierte el JSON a base64
cat path/to/service-account-key.json | base64

# Agrega a Vercel
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY
# Pega el string base64
```

### Opción B: Variables individuales (alternativa)

```bash
npx vercel env add GOOGLE_PROJECT_ID
# Valor: tu-project-id (ej: 110792412605)

npx vercel env add GOOGLE_LOCATION
# Valor: us (o eu)

npx vercel env add GOOGLE_PROCESSOR_ID
# Valor: tu-processor-id (ej: 5766948fdfdc0f38)
```

## Paso 6: Código de Implementación (v2)

```typescript
// api/lib/documentAI.ts

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

interface DocumentAIConfig {
  projectId: string;
  location: string;
  processorId: string;
}

let client: DocumentProcessorServiceClient | null = null;

function getClient(): DocumentProcessorServiceClient {
  if (!client) {
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      // Decode base64 service account key
      const credentials = JSON.parse(
        Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
      );
      
      client = new DocumentProcessorServiceClient({ credentials });
    } else {
      // Use default credentials (for local development with gcloud auth)
      client = new DocumentProcessorServiceClient();
    }
  }
  
  return client;
}

export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  config: DocumentAIConfig
): Promise<string> {
  const client = getClient();
  
  const name = `projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}`;
  
  const request = {
    name,
    rawDocument: {
      content: pdfBuffer.toString('base64'),
      mimeType: 'application/pdf',
    },
  };
  
  const [result] = await client.processDocument(request);
  const { document } = result;
  
  if (!document?.text) {
    throw new Error('No text extracted from PDF');
  }
  
  return document.text;
}
```

## Paso 7: Instalar Dependencia

```bash
npm install @google-cloud/documentai
```

## Paso 8: Actualizar analyze.ts

```typescript
import { extractTextFromPDF } from '../lib/documentAI.js';

// En la función de manejo de PDFs:
if (PDF_TYPES.includes(mimeType)) {
  const text = await extractTextFromPDF(pdfBuffer, {
    projectId: process.env.GOOGLE_PROJECT_ID!,
    location: process.env.GOOGLE_LOCATION!,
    processorId: process.env.GOOGLE_PROCESSOR_ID!,
  });
  
  // Usar analyzeDocumentFromText para procesar el texto
  result = await analyzeDocumentFromText(text, documentType);
}
```

## Variables de Entorno Requeridas (v2)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON key en base64 | `eyJ0eXBlIjoic2Vydm...` |
| `GOOGLE_PROJECT_ID` | ID del proyecto GCP | `110792412605` |
| `GOOGLE_LOCATION` | Región del processor | `us` o `eu` |
| `GOOGLE_PROCESSOR_ID` | ID del processor | `5766948fdfdc0f38` |

## Costos Estimados

| Tier | Páginas/mes | Costo |
|------|-------------|-------|
| Free | 1,000 | $0 |
| Standard | 1,001 - 5M | $1.50 por 1,000 páginas |

## Troubleshooting

### Error 401: Unauthorized
- Verifica que el service account tenga el rol "Document AI API User"
- Verifica que el JSON key sea correcto y esté en base64

### Error 403: Permission Denied
- El processor puede estar en otra región
- El service account no tiene acceso al processor

### Error 404: Processor not found
- Verifica el GOOGLE_PROCESSOR_ID
- Verifica la GOOGLE_LOCATION (debe coincidir con la región del processor)

## Migración de v1 (ConvertAPI) a v2 (Document AI)

1. Instala `@google-cloud/documentai`
2. Configura las variables de entorno
3. Actualiza el código de manejo de PDFs
4. Elimina `CONVERTAPI_SECRET` de las variables de entorno
5. Despliega

---

**Nota**: Esta guía es para la versión 2 de la API. La versión actual (v1) usa ConvertAPI para conversión de PDF a imagen.

