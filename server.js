/**
 * Express Server for Containerized Deployment
 * Replaces Vercel serverless architecture with traditional Express server
 * Suitable for Kubernetes/OpenShift deployment
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const createJWTHandler = require('./api/createJWT');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoints for Kubernetes probes
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ready', (req, res) => {
  // Check if required environment variables are set
  const isReady = process.env.PRIVATE_KEY && process.env.IBM_PUBLIC_KEY;
  
  if (isReady) {
    res.status(200).json({ 
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({ 
      status: 'not ready',
      message: 'Required environment variables not set',
      timestamp: new Date().toISOString()
    });
  }
});

// JWT creation endpoint - main API route
app.get('/createJWT', createJWTHandler);

// Watson Orchestrate configuration endpoint
app.get('/config', (req, res) => {
  const config = {
    orchestrationID: process.env.WXO_ORCHESTRATION_ID || '',
    hostURL: process.env.WXO_HOST_URL || '',
    agentId: process.env.WXO_AGENT_ID || '',
    agentEnvironmentId: process.env.WXO_AGENT_ENVIRONMENT_ID || ''
  };
  
  // Check if all required config values are set
  const missingConfig = Object.entries(config)
    .filter(([key, value]) => !value)
    .map(([key]) => key);
  
  if (missingConfig.length > 0) {
    console.warn('[Config] Missing configuration values:', missingConfig.join(', '));
  }
  
  res.json(config);
});

// Serve static files
app.use(express.static('static'));
app.use(express.static('.'));

// Fallback route for SPA
app.get('*', (req, res) => {
  // Check if file exists in static directory
  const staticFile = path.join(__dirname, 'static', 'index.html');
  const rootFile = path.join(__dirname, 'index.html');
  
  // Try static directory first, then root
  if (require('fs').existsSync(staticFile)) {
    res.sendFile(staticFile);
  } else if (require('fs').existsSync(rootFile)) {
    res.sendFile(rootFile);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'production'} mode`);
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] Ready check: http://localhost:${PORT}/ready`);
  console.log(`[Server] JWT endpoint: http://localhost:${PORT}/createJWT`);
  
  // Verify environment variables
  if (!process.env.PRIVATE_KEY) {
    console.warn('[Server] WARNING: PRIVATE_KEY environment variable not set!');
  }
  if (!process.env.IBM_PUBLIC_KEY) {
    console.warn('[Server] WARNING: IBM_PUBLIC_KEY environment variable not set!');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

module.exports = app;
