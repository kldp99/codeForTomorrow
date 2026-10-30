import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { softAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import chatRoutes from './routes/chatRoutes';

export function createApp(): Application {
  const app = express();

  // ─── Security ───────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: '*',            // tighten this in production
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  }));

  // ─── Rate Limiting ──────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        status: 429,
      },
    },
  });
  app.use(limiter);

  // ─── Parsing ─────────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Logging ─────────────────────────────────────────────────────────────────
  if (config.env !== 'test') {
    app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────
  app.use(softAuth);

  // ─── Health Check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: config.env,
        version: '1.0.0',
      },
    });
  });

  // ─── API Routes ───────────────────────────────────────────────────────────────
  app.use('/api/v1', chatRoutes);

  // ─── 404 & Error Handlers ─────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
