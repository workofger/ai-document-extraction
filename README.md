# Partrunner DocVal AI

<div align="center">
  <img src="public/favicon.svg" alt="DocVal AI Logo" width="80" height="80" />
  
  **Validación Automática de Documentos Logísticos con Inteligencia Artificial**
  
  [![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
  [![Gemini AI](https://img.shields.io/badge/Gemini-2.0-purple.svg)](https://ai.google.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-cyan.svg)](https://tailwindcss.com/)
</div>

---

## 🚀 Características

- **Validación con IA**: Utiliza Gemini 2.0 Flash para analizar y validar documentos
- **Múltiples roles**: Encargado, Conductor, Vehículo, Persona Moral, Persona Física
- **Extracción de datos**: Extrae automáticamente información clave de documentos
- **Persistencia local**: Guarda el progreso en localStorage
- **UI moderna**: Diseño responsivo con Tailwind CSS
- **Notificaciones**: Feedback en tiempo real con toast notifications

## 📋 Documentos Soportados

| Tipo | Datos Extraídos |
|------|-----------------|
| INE | Nombre, CURP, Clave de Elector, Vigencia |
| Licencia de Conducir | Nombre, Número, Tipo, Vigencia |
| Tarjeta de Circulación | Placas, Modelo, VIN |
| Constancia Fiscal | RFC, Nombre/Razón Social, CP |
| Póliza de Seguro | Aseguradora, Póliza, Vigencia |
| Datos Bancarios | Banco, CLABE, Nombre |

## 🛠️ Instalación

### Prerrequisitos

- Node.js 18+
- npm o yarn
- API Key de Gemini ([Obtener aquí](https://aistudio.google.com/app/apikey))

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/partrunner/docval-ai.git
   cd docval-ai
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   
   Edita `.env.local` y agrega tu API Key:
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   ```

4. **Iniciar en desarrollo**
   ```bash
   npm run dev
   ```

5. **Abrir en el navegador**
   ```
   http://localhost:3000/doc_demo
   ```

## 🏗️ Build para Producción

```bash
# Generar build optimizado
npm run build

# Vista previa del build
npm run preview
```

Los archivos se generan en `dist/` listos para desplegar.

## 📁 Estructura del Proyecto

```
partrunner-docval-ai/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── documents/        # Componentes de documentos
│   │   ├── layout/           # Header, Footer
│   │   └── ui/               # Componentes base reutilizables
│   ├── contexts/
│   │   └── DocumentContext.tsx
│   ├── hooks/
│   │   ├── useAnalysis.ts
│   │   └── useFileUpload.ts
│   ├── services/
│   │   └── geminiService.ts  # Integración con Gemini AI
│   ├── types/
│   │   └── index.ts
│   ├── constants/
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.local                # Variables de entorno (no commitear)
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🚢 Despliegue

### En servidor propio (SFTP/SFT)

1. Genera el build:
   ```bash
   npm run build
   ```

2. Sube el contenido de `dist/` a tu servidor en:
   ```
   /var/www/products.partrunner.com/doc_demo/
   ```

3. Configura tu servidor web (nginx ejemplo):
   ```nginx
   location /doc_demo {
       alias /var/www/products.partrunner.com/doc_demo;
       try_files $uri $uri/ /doc_demo/index.html;
   }
   ```

### Con Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/doc_demo
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## ⚙️ Configuración

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `GEMINI_API_KEY` | API Key de Google Gemini | ✅ |
| `VITE_APP_BASE_URL` | URL base de la app | ❌ |

## 🔒 Seguridad

> ⚠️ **Importante**: La API Key de Gemini se expone en el frontend. Para producción, considera:
> 
> 1. Crear un backend/proxy que maneje las llamadas a Gemini
> 2. Usar Vercel/Netlify Functions o similar
> 3. Implementar rate limiting y autenticación

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📄 Licencia

MIT © [Partrunner](https://partrunner.com)

---

<div align="center">
  <strong>Desarrollado con ❤️ por Partrunner</strong>
  <br />
  <a href="https://products.partrunner.com">products.partrunner.com</a>
</div>
