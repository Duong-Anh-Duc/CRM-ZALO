import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { globalLimiter, authLimiter, apiLimiter } from './middleware/rate-limit.middleware';
import { requestContextMiddleware } from './middleware/request-context.middleware';
import logger from './utils/logger';
import { connectRedis } from './lib/redis';
import { startOverdueChecker } from './jobs/overdue-checker';

const app = express();

// Security
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "blob:", "https://static.cloudflareinsights.com"],
      scriptSrcElem: ["'self'", "'unsafe-inline'", "blob:", "https://static.cloudflareinsights.com"],
      workerSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "data:", "https:"],
      frameSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(hpp());
app.use(cors({ origin: config.cors.origin, credentials: true }));

// Compression
app.use(compression());

// Logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg: string) => logger.info(msg.trim()) },
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request context (must wrap all routes so AsyncLocalStorage propagates)
app.use(requestContextMiddleware);

// Global rate limit
app.use('/api', globalLimiter);

// Stricter rate limit for auth routes
app.use('/api/auth/login', authLimiter);

// API rate limit for write operations
app.use('/api', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// Serve frontend static files (production)
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Start server
async function bootstrap() {
  await connectRedis();

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} (${config.env})`);
    startOverdueChecker();
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
