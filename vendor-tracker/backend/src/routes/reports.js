const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { generateExcel, generatePDF } = require('../services/export');

// Obtener resumen de actividad por fecha
router.get('/summary', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const startOfDay = new Date(`${targetDate}T00:00:00`);
    const endOfDay = new Date(`${targetDate}T23:59:59`);

    // Obtener vendedores
    const vendorsSnap = await db.collection('users')
      .where('role', '==', 'vendor')
      .get();

    const summary = [];

    for (const vendorDoc of vendorsSnap.docs) {
      const vendor = vendorDoc.data();

      // Contar ubicaciones del día (indica actividad)
      const locsSnap = await db.collection('locations')
        .where('vendorId', '==', vendorDoc.id)
        .where('timestamp', '>=', startOfDay)
        .where('timestamp', '<=', endOfDay)
        .get();

      // Contar visitas del día
      const visitsSnap = await db.collection('visits')
        .where('vendorId', '==', vendorDoc.id)
        .where('startTime', '>=', startOfDay)
        .where('startTime', '<=', endOfDay)
        .get();

      // Calcular distancia recorrida
      const locations = [];
      locsSnap.forEach(doc => locations.push(doc.data()));
      const distanceKm = calculateDistance(locations);

      summary.push({
        vendorId: vendorDoc.id,
        name: vendor.name,
        active: vendor.active,
        totalLocations: locsSnap.size,
        totalVisits: visitsSnap.size,
        distanceKm: Math.round(distanceKm * 100) / 100,
      });
    }

    res.json({ date: targetDate, summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar reporte a Excel
router.get('/export/excel', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Reutilizar lógica del summary
    const summaryRes = await getSummaryData(targetDate);

    const buffer = await generateExcel(summaryRes, targetDate);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-${targetDate}.xlsx`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar reporte a PDF
router.get('/export/pdf', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const summaryRes = await getSummaryData(targetDate);

    const buffer = await generatePDF(summaryRes, targetDate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte-${targetDate}.pdf`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para obtener datos del resumen
async function getSummaryData(targetDate) {
  const startOfDay = new Date(`${targetDate}T00:00:00`);
  const endOfDay = new Date(`${targetDate}T23:59:59`);

  const vendorsSnap = await db.collection('users')
    .where('role', '==', 'vendor')
    .get();

  const summary = [];
  for (const vendorDoc of vendorsSnap.docs) {
    const vendor = vendorDoc.data();

    const locsSnap = await db.collection('locations')
      .where('vendorId', '==', vendorDoc.id)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay)
      .get();

    const visitsSnap = await db.collection('visits')
      .where('vendorId', '==', vendorDoc.id)
      .where('startTime', '>=', startOfDay)
      .where('startTime', '<=', endOfDay)
      .get();

    const locations = [];
    locsSnap.forEach(doc => locations.push(doc.data()));

    summary.push({
      vendorId: vendorDoc.id,
      name: vendor.name,
      active: vendor.active,
      totalLocations: locsSnap.size,
      totalVisits: visitsSnap.size,
      distanceKm: Math.round(calculateDistance(locations) * 100) / 100,
    });
  }

  return summary;
}

// Calcular distancia total en km usando fórmula de Haversine
function calculateDistance(locations) {
  let total = 0;
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];
    total += haversine(prev.lat, prev.lng, curr.lat, curr.lng);
  }
  return total;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = router;
