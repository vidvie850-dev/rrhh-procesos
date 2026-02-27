const express = require('express');
const router = express.Router();
const { db, auth } = require('../config/firebase');

// Registrar nuevo usuario (admin crea vendedores)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'vendor' } = req.body;

    // Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Guardar en Firestore
    await db.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      active: true,
      status: 'offline',
      lastLocation: null,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      uid: userRecord.uid,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Obtener perfil del usuario autenticado
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ uid: decoded.uid, ...userDoc.data() });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
