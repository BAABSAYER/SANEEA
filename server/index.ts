import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cors from "cors";
import { config } from "dotenv";

// Load environment variables from .env file
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up CORS
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true // Allow cookies to be sent with requests
}));

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
        logLine = logLine.slice(0, 79) + "...";
      }

      log(logLine);
    }
  });

  // Log all incoming requests for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User-Agent: ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`);

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: process.env.PORT || "5000"
  });
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error('Server error:', err);
      res.status(status).json({ message });
    });


    
    // Use Vite development server for development mode
    if (process.env.NODE_ENV === "development") {
      log("Starting Vite development server");
      await setupVite(app, server);
    } else {
      log("Starting production static file server");
      serveStatic(app);
    }

    // Use environment port or default to 5000 for Replit
    const port = parseInt(process.env.PORT || "5000");
    
    // Handle server startup errors
    server.on('error', (err) => {
      console.error('Server startup error:', err);
      process.exit(1);
    });
    
    server.listen(port, "0.0.0.0", () => {
      console.log(`[SERVER] Starting on port ${port} at ${new Date().toISOString()}`);
      console.log(`[SERVER] Available at: http://localhost:${port}`);
      console.log(`[SERVER] Health check: http://localhost:${port}/api/health`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
