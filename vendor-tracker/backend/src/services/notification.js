const { messaging, db } = require('../config/firebase');

// Enviar notificación push a un usuario específico
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Obtener token FCM del usuario
    const userDoc = await db.collection('users').doc(userId).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return { sent: false, reason: 'Sin token FCM registrado' };
    }

    const message = {
      token: fcmToken,
      notification: { title, body },
      data,
    };

    const response = await messaging.send(message);
    return { sent: true, messageId: response };
  } catch (error) {
    console.error('Error enviando notificación:', error.message);
    return { sent: false, reason: error.message };
  }
}

// Enviar notificación a todos los admins
async function notifyAdmins(title, body, data = {}) {
  const adminsSnap = await db.collection('users')
    .where('role', '==', 'admin')
    .get();

  const results = [];
  for (const doc of adminsSnap.docs) {
    const result = await sendPushNotification(doc.id, title, body, data);
    results.push({ userId: doc.id, ...result });
  }
  return results;
}

// Registrar token FCM de un dispositivo
async function registerFCMToken(userId, token) {
  await db.collection('users').doc(userId).update({ fcmToken: token });
  return { registered: true };
}

module.exports = { sendPushNotification, notifyAdmins, registerFCMToken };
