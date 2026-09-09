import "./env";
import path from "path";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors, { type CorsOptions } from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { requestIdMiddleware } from "./middleware/request-id";
import { ensureDbOnce } from "./db/ensure";
import { startOverdueJob } from "./jobs/overdue-checker";
// import { startOutboxWorker, stopOutboxWorker } from "./services/notification-worker";
// import { reconcileDrmIds } from "./services/drm-reconciliation.service";
import { errorEnvelope } from "./utils/api-error";
import { assertSecretsOrExit } from "./config/validate-secrets";

// Validate security-critical secrets before anything binds a port or signs a
// token. In production this exits(1) on a missing/weak JWT secret; in dev it
// only warns. Never prints secret values. (PATCH 6 Stage 1, deliverable B.)
assertSecretsOrExit();

// Prevent pg-pool / network errors from crashing the server
process.on("unhandledRejection", (reason: any) => {
  const code = reason?.code;
  // Suppress known transient database connectivity errors
  if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
    console.warn("[server] Suppressed unhandled DB rejection:", code, reason?.message || "");
    return;
  }
  console.error("[server] Unhandled rejection:", reason);
});

const app = express();
app.disable("etag");
app.set("trust proxy", 1);
// gzip/brotli-negotiated compression for all responses (JS/CSS/JSON). Was
// entirely absent, so every asset was sent uncompressed over the wire.
app.use(compression());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: "50mb", extended: false }));

// Serve user-uploaded files (e.g. portfolio images) saved to disk by multer routes.
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

const defaultFrontend =
  process.env.FRONTEND_URL ||
  process.env.CLIENT_ORIGIN ||
  process.env.VITE_ORIGIN ||
  process.env.VITE_APP_URL ||
  "";

const allowedOrigins = (process.env.CORS_ORIGINS ?? defaultFrontend)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(requestIdMiddleware);
app.use(loggerMiddleware);

(async () => {
  try {
    await ensureDbOnce();
  } catch (err: any) {
    const code = err?.code;
    if (code === 'ETIMEDOUT') {
      // Timeout during startup is NOT fatal — pool will retry on first request
      console.warn("[startup] ensureDbOnce timed out; server will start and retry DB on requests");
    } else {
      console.error("[startup] ensureDbOnce failed; server will still start but DB-dependent routes may fail", err);
    }
  }
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const rawMessage = err.message || "Internal Server Error";
    const code = err.code || err.name || "INTERNAL_ERROR";
    // Always log full detail server-side (incl. stack) for debugging.
    const rid = req.id ? ` rid=${req.id}` : "";
    console.error(`[ERROR]${rid} ${req.method} ${req.originalUrl} -> ${status} code=${code} msg="${rawMessage}"`);
    if (err?.stack) {
      console.error(err.stack);
    }
    // Standard error envelope: { success:false, error:{code,message}, message }.
    // Top-level `message` is mirrored for frontend backward-compat.
    // SECURITY: never leak stack traces or raw internal error text to clients.
    // For 5xx, return a fixed generic message; client-error (4xx) messages are
    // intentional and safe to surface.
    const clientMessage = status >= 500 ? "Internal server error" : rawMessage;
    const clientCode = status >= 500 ? "INTERNAL_ERROR" : code;
    res.status(status).json(errorEnvelope(clientCode, clientMessage));
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const requestedPort = Number(process.env.PORT) || 5000;

  const makeListenOptions = (port: number, host: string) => {
    const listenOptions: any = {
      port,
      // Bind IPv6 with dual-stack support so both localhost (::1)
      // and 127.0.0.1 work during local development on Windows.
      host,
      ipv6Only: false,
    };
    // reusePort is not supported on Windows; enable only where available
    if (process.platform !== "win32") {
      listenOptions.reusePort = true;
    }
    return listenOptions;
  };

  const tryListen = (port: number, host: string) =>
    new Promise<void>((resolve, reject) => {
      const onError = (err: any) => {
        server.off("listening", onListening);
        reject(err);
      };

      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(makeListenOptions(port, host));
    });

  try {
    await tryListen(requestedPort, "::");
  } catch (err: any) {
    // Some sandboxes/hosts don't support IPv6 binding (EAFNOSUPPORT) or the
    // address isn't available (EADDRNOTAVAIL). Fall back to IPv4 so the server
    // still serves on the only non-firewalled port.
    if (err?.code === "EAFNOSUPPORT" || err?.code === "EADDRNOTAVAIL") {
      log(`IPv6 bind failed (${err.code}); retrying on 0.0.0.0`);
      await tryListen(requestedPort, "0.0.0.0");
    } else {
      throw err;
    }
  }
  log(`serving on fixed port ${requestedPort}`);

  // Start background jobs
  startOverdueJob();
  // startOutboxWorker();
  // reconcileDrmIds().catch((err) => console.error("[server] DRM ID reconciliation failed:", err));

  // Graceful shutdown handling
  const shutdown = async () => {
    log("Received shutdown signal. Stopping services...");
    // await stopOutboxWorker();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
})();
