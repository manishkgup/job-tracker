const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying';

// Cookie options — httpOnly means JavaScript on the page can NEVER read this cookie
const COOKIE_OPTS = {
  httpOnly: true,                                      // ← the key security setting
  sameSite: 'strict',                                  // blocks cross-site request forgery
  secure:   process.env.NODE_ENV === 'production',     // HTTPS-only in production
  maxAge:   7 * 24 * 60 * 60 * 1000,                  // 7 days in milliseconds
};

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    const result = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(username, email, passwordHash);

    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });

    // Set token as HttpOnly cookie — do NOT send it in the JSON body
    res.cookie('token', token, COOKIE_OPTS).json({ username });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  // Set token as HttpOnly cookie — do NOT send it in the JSON body
  res.cookie('token', token, COOKIE_OPTS).json({ username: user.username });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token').json({ ok: true });
});

module.exports = router;
