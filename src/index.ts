import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { CONFIG } from './config';
import { RoomManager } from './engine/RoomManager';
import { GameLoop } from './engine/GameLoop';
import { registerSocketHandlers } from './network/SocketHandlers';
import { logger } from './utils/Logger';

// ─── Express + HTTP ───
const app = express();
const server = http.createServer(app);

// ─── Socket.IO ───
const io = new Server(server, {
  cors: {
    origin: CONFIG.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
  // Performance: limit payload size to prevent abuse
  maxHttpBufferSize: 1e6, // 1MB max per message
  pingInterval: 25000,
  pingTimeout: 20000,
});

// ─── Initialize engine ───
const roomManager = new RoomManager(io);
const gameLoop = new GameLoop(io, roomManager);

// ─── Register socket handlers ───
registerSocketHandlers(io, roomManager, gameLoop);

// ─── Health check ───
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start server ───
server.listen(CONFIG.PORT, () => {
  logger.info(`🎨 Drawing game server running on port ${CONFIG.PORT}`);
  logger.info(`   Health check: http://localhost:${CONFIG.PORT}/health`);
});

// ─── Graceful shutdown ───
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop accepting new connections
  io.close(() => {
    logger.info('All socket connections closed');
  });

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { io, server };
