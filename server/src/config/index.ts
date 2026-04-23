import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'packflow-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '300', 10),
  },

  rateLimit: {
    global: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_GLOBAL || '500', 10),
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_AUTH || '20', 10),
    },
    api: {
      windowMs: 1 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_API || '100', 10),
    },
    heavy: {
      windowMs: 1 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_HEAVY || '10', 10),
    },
  },

  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
    ],
  },

  defaultAdmin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@packflow.vn',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123456',
  },

  defaultReceivableDueDays: parseInt(
    process.env.DEFAULT_RECEIVABLE_DUE_DAYS || '30',
    10,
  ),

  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFiles: parseInt(process.env.UPLOAD_MAX_FILES || '10', 10),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    // Dedicated vision model — falls back to main model if not set
    visionModel: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048', 10),
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
  },

  zalo: {
    getThreadsUrl: process.env.ZALO_FUNC_GET_THREADS_URL || '',
    getThreadsToken: process.env.ZALO_FUNC_GET_THREADS_TOKEN || '',
    getMessagesUrl: process.env.ZALO_FUNC_GET_MESSAGES_URL || '',
    getMessagesToken: process.env.ZALO_FUNC_GET_MESSAGES_TOKEN || '',
    accountToken: process.env.ZALO_FUNC_ACCOUNT_TOKEN || '',
  },
};
