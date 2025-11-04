import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import path from "path"; //
const app = express();

// Trust proxy in production for secure cookies
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
(async () => {
  const server = await registerRoutes(app);

  // --- ADD THIS NEW ROUTE ---
  // This is the public API for your storefront directory
  app.get('/api/public/tournaments', async (req, res) => {
    try {
      // NOTE: You will need to import your 'db' instance here
      const publicTournaments = await db.query.tournaments.findMany({
        where: (tournaments, { eq }) => eq(tournaments.visibility, 'public'),
        with: {
          organization: { columns: { name: true } }
        },
        orderBy: (tournaments, { desc }) => [desc(tournaments.startDate)] // Example
      });
      res.json(publicTournaments);
    } catch (error) {
      log(`Error fetching public tournaments: ${error.message}`);
      res.status(500).json({ message: "Error fetching tournaments" });
    }
  });
  // --- END OF NEW ROUTE ---

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // ... your error handler (no changes)
    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
 // --- REPLACE THE BLOCK ABOVE WITH THIS ---

  if (app.get("env") === "development") {
    // Your existing Vite setup for dev mode is perfect. No change.
    await setupVite(app, server);
  } else {
    // --- THIS IS THE NEW PRODUCTION LOGIC ---
    log("Running in production. Serving static files.");

    // 1. Define paths to your two built apps
    // These paths must match your 'package.json' build script outputs
    const appDistPath = path.resolve(__dirname, '../apps/app/dist');
    const storefrontDistPath = path.resolve(__dirname, '../apps/storefront/dist');

    // 2. Serve static assets (JS, CSS) from BOTH build folders
    app.use(express.static(appDistPath));
    app.use(express.static(storefrontDistPath));

    // 3. The "Brain" - This must be the LAST 'app.get()'
    // 
    app.get('/*', (req, res) => {
      const hostname = req.hostname;

      if (hostname === 'app.dugoutdesk.ca') {
        // --- Send the APP ---
        log(`Serving app for app.dugoutdesk.ca`);
        res.sendFile(path.join(appDistPath, 'index.html'));
      } 
      else if (hostname === 'www.dugoutdesk.ca' || hostname === 'dugoutdesk.ca') {
        // --- Send the STOREFRONT ---
        log(`Serving storefront for ${hostname}`);
        res.sendFile(path.join(storefrontDistPath, 'index.html'));
      }
      else {
        // Fallback for any other unknown domain (like the raw .replit.dev URL in production)
        log(`Serving storefront as fallback for ${hostname}`);
        res.sendFile(path.join(storefrontDistPath, 'index.html'));
      }
    });
    // --- END OF NEW PRODUCTION LOGIC ---
s }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      log(`Port ${port} is already in use, attempting to kill existing processes...`);
      // Try to restart after a short delay
      setTimeout(() => {
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        }, () => {
          log(`serving on port ${port}`);
        });
      }, 1000);
    } else {
      throw error;
    }
  });
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
