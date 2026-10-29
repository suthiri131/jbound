import express from "express";
import cors from "cors";
import helmet from "helmet"; //security middleware
import morgan from "morgan"; // HTTP request logging middleware
import { config } from "./config.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import routesRouter from "./routes/routes.js";
import expensesRouter from "./routes/expensesRoutes.js";
import tripRoutes from "./routes/trips.js";
import archiveRoutes from "./routes/archives.js";
import authRoutes from "./routes/auth.js";
import utilityRoutes from "./routes/utility.js";
import placeRoutes from "./routes/places.js";
import postsRouter from './routes/posts.js';
import checkpointRouter from './routes/checkpoint.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser tools (curl/Postman/Cypress API calls) with no Origin header,
      // listed origins, and Vercel preview deployments.
      if (
        !origin ||
        config.clientOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin)
      )
        return cb(null, true);
      const err = new Error(`Origin ${origin} not allowed by CORS`);
      err.status = 403;
      cb(err);
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
if (config.env !== "test")
  app.use(morgan(config.env === "production" ? "combined" : "dev"));

app.get("/", (_req, res) =>
  res.json({ name: "JBound API", docs: "/api/health" }),
);
app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    env: config.env,
    ltaConfigured: Boolean(config.lta.accountKey),
    time: new Date().toISOString(),
  }),
);

app.use('/api/posts', postsRouter);
app.use('/api/checkpoints', checkpointRouter);
app.use("/api/auth", authRoutes);
app.use("/api", utilityRoutes);
app.use("/api/routes", routesRouter);
app.use("/api/trips", tripRoutes);
app.use("/api/archives", archiveRoutes);
app.use("/api/trips/:tripId/expenses", expensesRouter);
app.use("/api/places", placeRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Vercel's Express entry requires a default export; keep the named export for local startup and tests.
export default app;
