const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Obtener todos los vendedores (solo admin)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'vendor')
      .get();

    const vendors = [];
    snapshot.forEach(doc => {
      vendors.push({ id: doc.id, ...doc.data() });
    });

    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un vendedor por ID
router.get('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar vendedor
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { name, active } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;

    await db.collection('users').doc(req.params.id).update(updateData);
    res.json({ message: 'Vendedor actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar vendedor
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { auth } = require('../config/firebase');
    await auth.deleteUser(req.params.id);
    await db.collection('users').doc(req.params.id).delete();
    res.json({ message: 'Vendedor eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
