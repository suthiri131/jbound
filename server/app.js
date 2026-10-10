import express from 'express';
import cors from 'cors';
import helmet from 'helmet';      //security middleware
import morgan from 'morgan';      // HTTP request logging middleware
import { config } from './config.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import placeRoutes from './routes/places.js';
import postRoutes from './routes/posts.js';
import tripRoutes from './routes/trips.js';
import checkpointRoutes from './routes/checkpoints.js';
import archiveRoutes from './routes/archives.js';
import utilityRoutes from './routes/utility.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser tools (curl/Postman/Cypress API calls) with no Origin header,
      // listed origins, and Vercel preview deployments.
      if (!origin || config.clientOrigins.includes(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
      const err = new Error(`Origin ${origin} not allowed by CORS`);
      err.status = 403;
      cb(err);
    },
  }),
);
app.use(express.json({ limit: '1mb' }));
if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

app.get('/', (_req, res) => res.json({ name: 'JBound API', docs: '/api/health' }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, env: config.env, ltaConfigured: Boolean(config.lta.accountKey), time: new Date().toISOString() }),
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/places', placeRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/checkpoints', checkpointRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api', utilityRoutes); // /api/currency/*, /api/routing, /api/uploads

app.use(notFoundHandler);
app.use(errorHandler);
