const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying';

module.exports = (req, res, next) => {
  // Token now lives in an HttpOnly cookie — JavaScript cannot read it
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};
