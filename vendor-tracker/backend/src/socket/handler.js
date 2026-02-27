const { saveLocation } = require('../services/location');
const { auth, db } = require('../config/firebase');

function setupSocketHandlers(io) {
  // Middleware de autenticación para WebSocket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Token de autenticación requerido'));
    }
    try {
      const decoded = await auth.verifyIdToken(token);
      socket.userId = decoded.uid;

      const userDoc = await db.collection('users').doc(decoded.uid).get();
      socket.userRole = userDoc.data()?.role;
      socket.userName = userDoc.data()?.name;
      next();
    } catch (error) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.userName} (${socket.userRole})`);

    // Vendedores se unen a sala de vendedores
    if (socket.userRole === 'vendor') {
      socket.join('vendors');

      // Notificar al admin que un vendedor se conectó
      io.to('admins').emit('vendor:connected', {
        vendorId: socket.userId,
        name: socket.userName,
      });

      // Actualizar estado en Firestore
      db.collection('users').doc(socket.userId).update({
        status: 'en_ruta',
        active: true,
      });
    }

    // Admins se unen a sala de admins
    if (socket.userRole === 'admin') {
      socket.join('admins');
    }

    // Recibir ubicación del vendedor
    socket.on('location:update', async (data) => {
      const { lat, lng, status } = data;

      if (socket.userRole !== 'vendor') return;

      // Guardar en Firestore
      const result = await saveLocation(socket.userId, lat, lng, status);

      if (result.saved) {
        // Reenviar al admin en tiempo real
        io.to('admins').emit('vendor:location', {
          vendorId: socket.userId,
          name: socket.userName,
          lat,
          lng,
          status: status || 'en_ruta',
          timestamp: new Date(),
        });
      }
    });

    // Vendedor cambia su estado
    socket.on('vendor:status', async (data) => {
      const { status } = data; // en_ruta, en_visita, en_descanso

      if (socket.userRole !== 'vendor') return;

      await db.collection('users').doc(socket.userId).update({ status });

      io.to('admins').emit('vendor:statusChanged', {
        vendorId: socket.userId,
        name: socket.userName,
        status,
      });
    });

    // Registrar visita a cliente
    socket.on('visit:start', async (data) => {
      const { clientName, lat, lng, notes } = data;

      if (socket.userRole !== 'vendor') return;

      const visitRef = await db.collection('visits').add({
        vendorId: socket.userId,
        clientName,
        lat,
        lng,
        startTime: new Date(),
        endTime: null,
        notes: notes || '',
      });

      socket.currentVisitId = visitRef.id;

      io.to('admins').emit('vendor:visitStarted', {
        vendorId: socket.userId,
        name: socket.userName,
        clientName,
        lat,
        lng,
        notes: notes || '',
        visitId: visitRef.id,
        startTime: new Date(),
      });
    });

    socket.on('visit:end', async () => {
      if (!socket.currentVisitId) return;

      await db.collection('visits').doc(socket.currentVisitId).update({
        endTime: new Date(),
      });

      io.to('admins').emit('vendor:visitEnded', {
        vendorId: socket.userId,
        name: socket.userName,
        visitId: socket.currentVisitId,
      });

      socket.currentVisitId = null;
    });

    // Registrar token FCM para push notifications
    socket.on('fcm:register', async (data) => {
      const { token } = data;
      await db.collection('users').doc(socket.userId).update({ fcmToken: token });
    });

    // Desconexión
    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.userName}`);

      if (socket.userRole === 'vendor') {
        // Marcar como 'background' en vez de 'offline' — puede seguir enviando ubicación por HTTP
        db.collection('users').doc(socket.userId).update({
          status: 'background',
        });

        io.to('admins').emit('vendor:background', {
          vendorId: socket.userId,
          name: socket.userName,
        });
      }
    });
  });
}

module.exports = { setupSocketHandlers };
