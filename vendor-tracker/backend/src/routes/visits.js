const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/visits?date=YYYY-MM-DD&vendorId=xxx
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { date, vendorId } = req.query;

    // Consulta simple sin orderBy para evitar requerir índice compuesto
    let query = db.collection('visits');

    if (vendorId) {
      query = query.where('vendorId', '==', vendorId);
    }

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00`);
      const endOfDay = new Date(`${date}T23:59:59`);
      query = query
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<=', endOfDay);
    }

    const snapshot = await query.limit(200).get();
    const visits = [];

    // Obtener nombres de vendedores
    const vendorCache = {};
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const vid = data.vendorId;

      if (vid && !vendorCache[vid]) {
        try {
          const userDoc = await db.collection('users').doc(vid).get();
          vendorCache[vid] = userDoc.data()?.name || 'Vendedor';
        } catch (_) {
          vendorCache[vid] = 'Vendedor';
        }
      }

      // Solo incluir visitas con coordenadas válidas
      if (data.lat && data.lng) {
        visits.push({
          id: doc.id,
          vendorId: vid,
          vendorName: vendorCache[vid] || 'Vendedor',
          clientName: data.clientName || 'Cliente',
          lat: data.lat,
          lng: data.lng,
          notes: data.notes || '',
          startTime: data.startTime?.toDate?.() || data.startTime,
          endTime: data.endTime?.toDate?.() || data.endTime || null,
          completed: !!data.endTime,
        });
      }
    }

    // Ordenar por startTime descendente en JavaScript
    visits.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    res.json(visits);
  } catch (error) {
    console.error('Error en /api/visits:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
