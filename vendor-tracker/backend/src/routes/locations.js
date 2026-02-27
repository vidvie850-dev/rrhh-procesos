const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Obtener historial de ubicaciones de un vendedor por fecha
router.get('/:vendorId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { date } = req.query; // formato: YYYY-MM-DD

    let query = db.collection('locations')
      .where('vendorId', '==', vendorId)
      .orderBy('timestamp', 'asc');

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59`);
      query = query
        .where('timestamp', '>=', startOfDay)
        .where('timestamp', '<=', endOfDay);
    }

    const snapshot = await query.limit(1000).get();
    const locations = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      locations.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
      });
    });

    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recibir ubicación desde background task de la app móvil
router.post('/', verifyToken, async (req, res) => {
  try {
    const { lat, lng, status } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat y lng requeridos' });

    const { saveLocation } = require('../services/location');
    const { getIO } = require('../socket/io');

    const result = await saveLocation(req.user.uid, lat, lng, status);

    if (result.saved) {
      // Emitir al panel admin en tiempo real aunque el socket del vendedor esté desconectado
      const io = getIO();
      if (io) {
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const userData = userDoc.data();
        io.to('admins').emit('vendor:location', {
          vendorId: req.user.uid,
          name: userData?.name || 'Vendedor',
          lat,
          lng,
          status: status || 'en_ruta',
          timestamp: new Date(),
        });
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener última ubicación de todos los vendedores
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'vendor')
      .get();

    const vendors = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.lastLocation) {
        vendors.push({
          id: doc.id,
          name: data.name,
          status: data.status,
          active: data.active,
          lastLocation: data.lastLocation,
        });
      }
    });

    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
