import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { alertasFeriasHandler } from "../alertasHandler";
import { lembretesCalendarioHandler } from "../lembretesCalendarioHandler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Trust proxy (necessário no Cloud Run / ambientes com load balancer)
  app.set('trust proxy', 1);

  // ─── Security headers (helmet) ────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:", "https:"],
          connectSrc: ["'self'", "https:", "wss:"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      // Impede que o site seja embutido em iframes de outros domínios
      frameguard: { action: "deny" },
      // Remove o header X-Powered-By para não expor tecnologia
      hidePoweredBy: true,
      // Força HTTPS
      hsts: { maxAge: 31536000, includeSubDomains: true },
      // Impede sniffing de MIME type
      noSniff: true,
      // Impede XSS via IE
      xssFilter: true,
      // Não envia Referer para outros domínios
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // Permissions Policy: desabilita APIs sensíveis não utilizadas
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
    })
  );

  // Permissions-Policy header adicional (não coberto pelo helmet)
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()"
    );
    next();
  });

  // ─── Rate limiting ────────────────────────────────────────────────────────
  // Limite geral: 300 req/min por IP
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, ip: false },
    message: { error: "Muitas requisições. Tente novamente em breve." },
  });
  // Limite estrito para login: 30 tentativas/15 min por IP real
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, ip: false },
    skip: () => false,
    message: { error: "Muitas tentativas de login. Aguarde 15 minutos." },
    // Retorna JSON mesmo quando o limite é atingido
    handler: (_req, res) => {
      res.status(429).json({ error: "Muitas tentativas de login. Aguarde 15 minutos." });
    },
  });
  app.use("/api/trpc", generalLimiter);
  app.use("/api/oauth", authLimiter);
  // Rate limit estrito para login via tRPC (systemUsers.login e auth)
  app.use("/api/trpc/systemUsers.login", authLimiter);
  app.use("/api/trpc/auth", authLimiter);

  // Body parser: limite reduzido para evitar DoS via payload gigante
  // 2mb para JSON (suficiente para qualquer payload normal), 5mb para form data
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Scheduled: alertas de férias por empresa (a cada 15 dias)
  app.post("/api/scheduled/alertas-ferias", alertasFeriasHandler);
  // Scheduled: lembretes de eventos do calendário
  app.post("/api/scheduled/lembrete-calendario", lembretesCalendarioHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
