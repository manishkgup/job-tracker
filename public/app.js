// ── Auth guard ──────────────────────────────────────────
if (!localStorage.getItem('token')) {
  window.location.href = '/';
}

let allJobs = [];
let parsedImportJobs = [];   // holds CSV rows waiting to be imported

// ── API helper ───────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch('/api' + path, opts);

  if (res.status === 401) { logout(); return null; }

  return res.json();
}

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('username-display').textContent =
    localStorage.getItem('username') || 'User';
  await Promise.all([loadJobs(), loadResume()]);

  // Drag-and-drop on the import drop zone
  const zone = document.getElementById('drop-zone');
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });
});

// ── Load & render ─────────────────────────────────────────
async function loadJobs() {
  const jobs = await api('GET', '/jobs');
  if (!jobs) return;
  allJobs = jobs;
  filterJobs();
  updateStats(allJobs);
}

function updateStats(jobs) {
  document.getElementById('stat-total').textContent     = jobs.length;
  document.getElementById('stat-applied').textContent   = jobs.filter(j => j.status === 'Applied').length;
  document.getElementById('stat-interview').textContent =
    jobs.filter(j => ['Phone Screen', 'Interview', 'Technical'].includes(j.status)).length;
  document.getElementById('stat-offer').textContent     = jobs.filter(j => j.status === 'Offer').length;
  document.getElementById('stat-rejected').textContent  = jobs.filter(j => j.status === 'Rejected').length;
}

const STATUS_CLASS = {
  'Applied':      'status-Applied',
  'Phone Screen': 'status-Phone',
  'Interview':    'status-Interview',
  'Technical':    'status-Technical',
  'Offer':        'status-Offer',
  'Rejected':     'status-Rejected',
  'Withdrawn':    'status-Withdrawn',
};

const SOURCE_CLASS = {
  'LinkedIn':        'source-LinkedIn',
  'Indeed':          'source-Indeed',
  'Glassdoor':       'source-Glassdoor',
  'Company Website': 'source-CompanyWebsite',
  'Manual':          'source-Manual',
  'Other':           'source-Other',
};

function renderJobs(jobs) {
  const tbody = document.getElementById('jobs-tbody');

  if (jobs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="empty-state">No applications match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map(job => {
    const src = job.source || 'Manual';
    return `
      <tr>
        <td><span class="company-name">${esc(job.company)}</span></td>
        <td>${esc(job.position)}</td>
        <td><span class="status-badge ${STATUS_CLASS[job.status] || ''}">${esc(job.status)}</span></td>
        <td><span class="source-badge ${SOURCE_CLASS[src] || 'source-Other'}">${esc(src)}</span></td>
        <td>${job.location     ? esc(job.location)     : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td>${job.date_applied ? esc(job.date_applied) : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td>${job.salary_range ? esc(job.salary_range) : '<span style="color:var(--gray-400)">—</span>'}</td>
        <td class="actions-cell">
          ${job.job_url
            ? `<a href="${esc(job.job_url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline">Link</a>`
            : ''}
          <button class="btn btn-sm btn-outline" onclick="editJob(${job.id})">Edit</button>
          <button class="btn btn-sm btn-danger"  onclick="deleteJob(${job.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Filter ────────────────────────────────────────────────
function filterJobs() {
  const query  = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('status-filter').value;
  const source = document.getElementById('source-filter').value;

  const filtered = allJobs.filter(j => {
    const matchSearch = !query  || j.company.toLowerCase().includes(query) ||
                                   j.position.toLowerCase().includes(query);
    const matchStatus = !status || j.status === status;
    const matchSource = !source || (j.source || 'Manual') === source;
    return matchSearch && matchStatus && matchSource;
  });

  renderJobs(filtered);
}

function filterByStatus(status) {
  document.getElementById('status-filter').value = status;
  filterJobs();
}

// ── Add/Edit Modal ────────────────────────────────────────
function openModal(job = null) {
  document.getElementById('job-form').reset();
  document.getElementById('modal-title').textContent = job ? 'Edit Application' : 'Add Application';
  document.getElementById('save-btn').textContent    = job ? 'Update' : 'Save';
  document.getElementById('save-btn').disabled       = false;
  document.getElementById('job-id').value            = job ? job.id : '';

  if (job) {
    document.getElementById('company').value      = job.company      || '';
    document.getElementById('position').value     = job.position     || '';
    document.getElementById('status').value       = job.status       || 'Applied';
    document.getElementById('date_applied').value = job.date_applied || '';
    document.getElementById('location').value     = job.location     || '';
    document.getElementById('salary_range').value = job.salary_range || '';
    document.getElementById('job_url').value      = job.job_url      || '';
    document.getElementById('notes').value        = job.notes        || '';
    document.getElementById('source').value       = job.source       || 'Manual';
  }

  document.getElementById('job-modal').classList.remove('hidden');
  document.getElementById('company').focus();
}

function closeModal() {
  document.getElementById('job-modal').classList.add('hidden');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeImportModal(); }
});

// ── Save (add or update) ──────────────────────────────────
async function saveJob(e) {
  e.preventDefault();

  const id   = document.getElementById('job-id').value;
  const body = {
    company:      document.getElementById('company').value.trim(),
    position:     document.getElementById('position').value.trim(),
    status:       document.getElementById('status').value,
    date_applied: document.getElementById('date_applied').value  || null,
    location:     document.getElementById('location').value.trim()     || null,
    salary_range: document.getElementById('salary_range').value.trim() || null,
    job_url:      document.getElementById('job_url').value.trim()      || null,
    notes:        document.getElementById('notes').value.trim()        || null,
    source:       document.getElementById('source').value,
  };

  const btn = document.getElementById('save-btn');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  await api(id ? 'PUT' : 'POST', id ? `/jobs/${id}` : '/jobs', body);

  closeModal();
  await loadJobs();
}

// ── Edit / Delete ─────────────────────────────────────────
function editJob(id) {
  const job = allJobs.find(j => j.id === id);
  if (job) openModal(job);
}

async function deleteJob(id) {
  if (!confirm('Delete this application? This cannot be undone.')) return;
  await api('DELETE', `/jobs/${id}`);
  await loadJobs();
}

// ── Auth ──────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.location.href = '/';
}

// ═══════════════════════════════════════════════════════════
// RESUME MANAGEMENT
// ═══════════════════════════════════════════════════════════

let currentResume  = null;   // metadata from last GET /api/resume
let pendingResume  = null;   // file waiting for replace-confirmation

async function loadResume() {
  const data = await api('GET', '/resume');
  if (data) renderResume(data);
}

function renderResume(data) {
  currentResume = data.exists ? data : null;
  pendingResume = null;

  const meta    = document.getElementById('resume-meta');
  const dlBtn   = document.getElementById('resume-download-btn');
  const upBtn   = document.getElementById('resume-upload-btn');
  const delBtn  = document.getElementById('resume-delete-btn');
  const warning = document.getElementById('resume-warning');
  const errEl   = document.getElementById('resume-error');

  warning.classList.add('hidden');
  errEl.textContent = '';
  upBtn.disabled    = false;

  if (data.exists) {
    const date = new Date(data.uploaded_at).toLocaleDateString('en-US',
      { year: 'numeric', month: 'short', day: 'numeric' });
    meta.innerHTML =
      `<strong>${esc(data.original_name)}</strong> &middot; Uploaded ${date}`;
    dlBtn.classList.remove('hidden');
    upBtn.textContent = '&#8593; Replace';
    delBtn.classList.remove('hidden');
  } else {
    meta.textContent = 'No resume uploaded yet.';
    dlBtn.classList.add('hidden');
    upBtn.innerHTML  = '&#8593; Upload Resume';
    delBtn.classList.add('hidden');
  }
}

// Called when the file input changes (user picked a file)
function handleResumeSelect(input) {
  const file = input.files[0];
  input.value = '';                 // reset so the same file can be re-selected later
  if (!file) return;

  document.getElementById('resume-error').textContent = '';

  if (currentResume) {
    // A resume already exists — show the replacement warning first
    pendingResume = file;
    document.getElementById('resume-warning-name').textContent = currentResume.original_name;
    document.getElementById('resume-warning').classList.remove('hidden');
  } else {
    // No existing resume — upload straight away
    uploadResume(file);
  }
}

function confirmResumeReplace() {
  if (pendingResume) uploadResume(pendingResume);
}

function cancelResumeReplace() {
  pendingResume = null;
  document.getElementById('resume-warning').classList.add('hidden');
}

async function uploadResume(file) {
  const upBtn = document.getElementById('resume-upload-btn');
  upBtn.disabled    = true;
  upBtn.textContent = 'Uploading…';
  document.getElementById('resume-warning').classList.add('hidden');

  const formData = new FormData();
  formData.append('resume', file);

  const res = await fetch('/api/resume', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body:    formData,
  });

  const data = await res.json();

  if (!res.ok) {
    document.getElementById('resume-error').textContent = data.error || 'Upload failed.';
    upBtn.disabled    = false;
    upBtn.textContent = currentResume ? '&#8593; Replace' : '&#8593; Upload Resume';
    return;
  }

  renderResume(data);
}

async function downloadResume() {
  const filename = currentResume?.original_name || 'resume.docx';

  const res = await fetch('/api/resume/download', {
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
  });

  if (!res.ok) { alert('Download failed.'); return; }

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteResume() {
  if (!confirm(`Permanently delete "${currentResume?.original_name}"? This cannot be undone.`)) return;
  await api('DELETE', '/resume');
  renderResume({ exists: false });
}

// ═══════════════════════════════════════════════════════════
// LINKEDIN CSV IMPORT
// ═══════════════════════════════════════════════════════════

function openImportModal() {
  // Reset state
  parsedImportJobs = [];
  document.getElementById('import-preview').classList.add('hidden');
  document.getElementById('import-error').textContent = '';
  document.getElementById('import-btn').disabled      = true;
  document.getElementById('csv-file').value           = '';
  document.getElementById('drop-zone').classList.remove('drag-over');

  document.getElementById('import-modal').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
}

// Called when a file is selected or dropped
function handleCSVFile(file) {
  const errEl = document.getElementById('import-error');
  errEl.textContent = '';

  if (!file || !file.name.endsWith('.csv')) {
    errEl.textContent = 'Please select a .csv file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      parsedImportJobs = parseLinkedInCSV(e.target.result);

      if (parsedImportJobs.length === 0) {
        errEl.textContent =
          'No valid rows found. Make sure this is the LinkedIn "Job Applications.csv" file.';
        return;
      }

      showImportPreview(parsedImportJobs);
    } catch (err) {
      errEl.textContent = 'Could not parse CSV: ' + err.message;
    }
  };
  reader.readAsText(file);
}

function showImportPreview(jobs) {
  document.getElementById('preview-count').textContent = jobs.length;

  // Show first 5 rows as a preview
  const preview = jobs.slice(0, 5);
  document.getElementById('preview-tbody').innerHTML = preview.map(j => `
    <tr>
      <td>${esc(j.company)}</td>
      <td>${esc(j.position)}</td>
      <td>${j.date_applied || '—'}</td>
      <td><span class="source-badge source-LinkedIn">LinkedIn</span></td>
    </tr>
  `).join('');

  if (jobs.length > 5) {
    document.getElementById('preview-tbody').innerHTML +=
      `<tr><td colspan="4" style="color:var(--gray-400);text-align:center;padding:8px">
        … and ${jobs.length - 5} more
      </td></tr>`;
  }

  document.getElementById('import-preview').classList.remove('hidden');
  document.getElementById('import-btn').disabled = false;
  document.getElementById('import-btn').textContent = `Import ${jobs.length} Applications`;
}

async function importJobs() {
  const btn = document.getElementById('import-btn');
  btn.disabled    = true;
  btn.textContent = 'Importing…';

  const result = await api('POST', '/jobs/import', { jobs: parsedImportJobs });

  if (!result) return;                         // 401 — logout already called

  closeImportModal();
  await loadJobs();
  alert(`Successfully imported ${result.imported} application${result.imported !== 1 ? 's' : ''}!`);
}

// ── CSV parser ────────────────────────────────────────────
// Handles LinkedIn's "Job Applications.csv" export format.
// Flexible column matching so it works even if LinkedIn changes headers.

function parseLinkedInCSV(text) {
  // Normalise Windows line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());

  // Find column index by trying multiple possible header names
  const col = (...names) => {
    for (const name of names) {
      const i = headers.findIndex(h => h.includes(name));
      if (i !== -1) return i;
    }
    return -1;
  };

  const companyIdx  = col('company');
  const titleIdx    = col('job title', 'position', 'title', 'role');
  const dateIdx     = col('application date', 'date applied', 'applied date', 'applied');
  const urlIdx      = col('job url', 'url', 'link', 'posting');
  const statusIdx   = col('status');

  if (companyIdx === -1 || titleIdx === -1) {
    throw new Error(
      'Could not find "Company" or "Job Title" columns. ' +
      'Please use the file exported from LinkedIn → Settings → Get a copy of your data.'
    );
  }

  const jobs = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols    = parseCSVRow(lines[i]);
    const company = cols[companyIdx]?.trim();
    const position = cols[titleIdx]?.trim();
    if (!company || !position) continue;

    // LinkedIn dates come as "2024-01-15 10:30:00 UTC" — extract YYYY-MM-DD
    let dateApplied = null;
    if (dateIdx !== -1 && cols[dateIdx]) {
      const m = cols[dateIdx].trim().match(/(\d{4}-\d{2}-\d{2})/);
      if (m) dateApplied = m[1];
    }

    jobs.push({
      company,
      position,
      status:       statusIdx !== -1 ? (cols[statusIdx]?.trim() || 'Applied') : 'Applied',
      date_applied: dateApplied,
      job_url:      urlIdx !== -1    ? (cols[urlIdx]?.trim()    || null)       : null,
      source:       'LinkedIn',
    });
  }

  return jobs;
}

// Proper CSV row parser — handles quoted fields and escaped quotes
function parseCSVRow(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';   // escaped quote ""
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── XSS protection ───────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
