const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../database');
const auth     = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'resumes');

// Ensure the folder exists at startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ── Multer config ─────────────────────────────────────────
// File is named resume_<userId>.docx so each user gets exactly one slot.
// req.user is already set by auth middleware before multer runs.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req,  _file, cb) => cb(null, `resume_${req.user.id}.docx`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB cap
  fileFilter: (_req, file, cb) => {
    const isDocx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.originalname.toLowerCase().endsWith('.docx');

    if (isDocx) cb(null, true);
    else        cb(new Error('Only .docx files are accepted'));
  },
});

// All routes require a valid JWT
router.use(auth);

// ── GET /api/resume ───────────────────────────────────────
// Returns metadata about the stored resume (or { exists: false })
router.get('/', (req, res) => {
  const row = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.user.id);
  if (!row) return res.json({ exists: false });
  res.json({ exists: true, original_name: row.original_name, uploaded_at: row.uploaded_at });
});

// ── POST /api/resume ──────────────────────────────────────
// Uploads a new resume. Multer overwrites any previous file automatically
// because the filename is always resume_<userId>.docx.
router.post('/', (req, res) => {
  upload.single('resume')(req, res, err => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large. Maximum size is 10 MB.' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file received.' });
    }

    // Upsert metadata (insert or update if already exists)
    const existing = db.prepare('SELECT user_id FROM resumes WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE resumes SET original_name = ?, uploaded_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .run(req.file.originalname, req.user.id);
    } else {
      db.prepare('INSERT INTO resumes (user_id, original_name) VALUES (?, ?)')
        .run(req.user.id, req.file.originalname);
    }

    const row = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.user.id);
    res.json({ exists: true, original_name: row.original_name, uploaded_at: row.uploaded_at });
  });
});

// ── GET /api/resume/download ──────────────────────────────
// Streams the .docx file back to the browser with the original filename.
router.get('/download', (req, res) => {
  const row = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'No resume on file.' });

  const filePath = path.join(UPLOADS_DIR, `resume_${req.user.id}.docx`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk.' });
  }

  res.download(filePath, row.original_name);
});

// ── DELETE /api/resume ────────────────────────────────────
router.delete('/', (req, res) => {
  const row = db.prepare('SELECT * FROM resumes WHERE user_id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'No resume on file.' });

  const filePath = path.join(UPLOADS_DIR, `resume_${req.user.id}.docx`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM resumes WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Resume deleted.' });
});

module.exports = router;
