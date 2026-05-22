const express = require('express');
const router = express.Router();
const db = require('../database');
const auth = require('../middleware/auth');

router.use(auth);

// ── GET all jobs ─────────────────────────────────────────
router.get('/', (req, res) => {
  const jobs = db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);
  res.json(jobs);
});

// ── POST single job ──────────────────────────────────────
router.post('/', (req, res) => {
  const { company, position, status, date_applied, notes, job_url, location, salary_range, source } = req.body;

  if (!company || !position) {
    return res.status(400).json({ error: 'Company and position are required' });
  }

  const result = db
    .prepare(`
      INSERT INTO jobs (user_id, company, position, status, date_applied, notes, job_url, location, salary_range, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      req.user.id,
      company,
      position,
      status       || 'Applied',
      date_applied || null,
      notes        || null,
      job_url      || null,
      location     || null,
      salary_range || null,
      source       || 'Manual'
    );

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(job);
});

// ── POST bulk import ─────────────────────────────────────
router.post('/import', (req, res) => {
  const { jobs } = req.body;

  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'No jobs provided' });
  }

  const insert = db.prepare(`
    INSERT INTO jobs (user_id, company, position, status, date_applied, job_url, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  db.exec('BEGIN');
  try {
    for (const job of jobs) {
      if (!job.company || !job.position) continue;
      insert.run(
        req.user.id,
        job.company,
        job.position,
        job.status       || 'Applied',
        job.date_applied || null,
        job.job_url      || null,
        job.source       || 'LinkedIn'
      );
      imported++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Import failed: ' + err.message });
  }

  res.json({ imported });
});

// ── PUT update job ───────────────────────────────────────
router.put('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const { company, position, status, date_applied, notes, job_url, location, salary_range, source } = req.body;

  db.prepare(`
    UPDATE jobs
    SET company = ?, position = ?, status = ?, date_applied = ?,
        notes = ?, job_url = ?, location = ?, salary_range = ?,
        source = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    company       ?? existing.company,
    position      ?? existing.position,
    status        ?? existing.status,
    date_applied  !== undefined ? date_applied  : existing.date_applied,
    notes         !== undefined ? notes         : existing.notes,
    job_url       !== undefined ? job_url       : existing.job_url,
    location      !== undefined ? location      : existing.location,
    salary_range  !== undefined ? salary_range  : existing.salary_range,
    source        ?? existing.source,
    req.params.id,
    req.user.id
  );

  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

// ── DELETE job ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ message: 'Deleted' });
});

module.exports = router;
