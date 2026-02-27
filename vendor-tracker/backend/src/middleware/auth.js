const { auth } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const { db } = require('../config/firebase');
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar permisos' });
  }
};

module.exports = { verifyToken, requireAdmin };
