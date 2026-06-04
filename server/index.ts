import "./env";
import express, { type Request, Response, NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { loggerMiddleware } from "./logger.middleware";
import { ensureDbOnce } from "./db/ensure";
import { startOverdueJob } from "./jobs/overdue-checker";
import { errorEnvelope } from "./utils/api-error";

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

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: "50mb", extended: false }));


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
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

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
    console.error(`[ERROR] ${req.method} ${req.originalUrl} -> ${status} code=${code} msg="${rawMessage}"`);
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

  const makeListenOptions = (port: number) => {
    const listenOptions: any = {
      port,
      // Bind IPv6 with dual-stack support so both localhost (::1)
      // and 127.0.0.1 work during local development on Windows.
      host: "::",
      ipv6Only: false,
    };
    // reusePort is not supported on Windows; enable only where available
    if (process.platform !== "win32") {
      listenOptions.reusePort = true;
    }
    return listenOptions;
  };

  const tryListen = (port: number) =>
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
      server.listen(makeListenOptions(port));
    });

  await tryListen(requestedPort);
  log(`serving on fixed port ${requestedPort}`);

  // Start background jobs
  startOverdueJob();
})();
