const { db } = require('../config/firebase');

// Guardar ubicación en Firestore y actualizar lastLocation del vendedor
async function saveLocation(vendorId, lat, lng, status) {
  const now = new Date();

  // Guardar en colección de ubicaciones
  const locationRef = await db.collection('locations').add({
    vendorId,
    lat,
    lng,
    status: status || 'en_ruta',
    timestamp: now,
  });

  // Actualizar última ubicación del vendedor
  await db.collection('users').doc(vendorId).update({
    lastLocation: { lat, lng, timestamp: now },
    status: status || 'en_ruta',
  });

  return { saved: true, id: locationRef.id };
}

// Obtener historial de ruta de un vendedor para un día
async function getRouteHistory(vendorId, date) {
  const startOfDay = new Date(`${date}T00:00:00`);
  const endOfDay = new Date(`${date}T23:59:59`);

  const snapshot = await db.collection('locations')
    .where('vendorId', '==', vendorId)
    .where('timestamp', '>=', startOfDay)
    .where('timestamp', '<=', endOfDay)
    .orderBy('timestamp', 'asc')
    .get();

  const locations = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    locations.push({
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || data.timestamp,
    });
  });

  return locations;
}

module.exports = { saveLocation, getRouteHistory };
