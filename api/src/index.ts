import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { config } from 'dotenv';
import { documentRouter } from './routes/document.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiKeyAuth } from './middleware/auth.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===========================================
// SECURITY MIDDLEWARE
// ===========================================

// Helmet for security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30'), // 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ===========================================
// FILE UPLOAD CONFIGURATION
// ===========================================

const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSize,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'application/pdf'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PNG, JPG, WEBP, GIF, PDF`));
    }
  },
});

// ===========================================
// ROUTES
// ===========================================

// Health check (no auth required)
app.use('/api/health', healthRouter);

// Document validation (auth required)
app.use('/api/documents', apiKeyAuth, documentRouter);

// ===========================================
// ERROR HANDLING
// ===========================================

app.use(notFoundHandler);
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔍 DocVal API - Document Validation Service                 ║
║                                                               ║
║   Server running on: http://localhost:${PORT}                   ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                               ║
║   Endpoints:                                                  ║
║   • GET  /api/health           - Health check                 ║
║   • POST /api/documents/analyze - Analyze document            ║
║   • POST /api/documents/validate-field - Validate single field║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;

