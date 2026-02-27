require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const locationRoutes = require('./routes/locations');
const reportRoutes = require('./routes/reports');
const visitRoutes = require('./routes/visits');
const { setupSocketHandlers } = require('./socket/handler');
const { setIO } = require('./socket/io');

const app = express();
const server = http.createServer(app);

// En producción, restringe el origen al dominio real del panel admin
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/visits', visitRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// WebSocket
setIO(io);
setupSocketHandlers(io);

// Iniciar servidor
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`WebSocket listo en ws://localhost:${PORT}`);
});
