// ── Auth guard ──────────────────────────────────────────
if (!localStorage.getItem('token')) {
  window.location.href = '/';
}

let allJobs = [];

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
  await loadJobs();
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
  document.getElementById('stat-total').textContent    = jobs.length;
  document.getElementById('stat-applied').textContent  = jobs.filter(j => j.status === 'Applied').length;
  document.getElementById('stat-interview').textContent =
    jobs.filter(j => ['Phone Screen', 'Interview', 'Technical'].includes(j.status)).length;
  document.getElementById('stat-offer').textContent    = jobs.filter(j => j.status === 'Offer').length;
  document.getElementById('stat-rejected').textContent = jobs.filter(j => j.status === 'Rejected').length;
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

function renderJobs(jobs) {
  const tbody = document.getElementById('jobs-tbody');

  if (jobs.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-state">No applications match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map(job => `
    <tr>
      <td><span class="company-name">${esc(job.company)}</span></td>
      <td>${esc(job.position)}</td>
      <td>
        <span class="status-badge ${STATUS_CLASS[job.status] || ''}">${esc(job.status)}</span>
      </td>
      <td>${job.location    ? esc(job.location)    : '<span style="color:var(--gray-400)">—</span>'}</td>
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
  `).join('');
}

// ── Filter ────────────────────────────────────────────────
function filterJobs() {
  const query  = document.getElementById('search-input').value.toLowerCase();
  const status = document.getElementById('status-filter').value;

  const filtered = allJobs.filter(j => {
    const matchSearch = !query  || j.company.toLowerCase().includes(query) ||
                                   j.position.toLowerCase().includes(query);
    const matchStatus = !status || j.status === status;
    return matchSearch && matchStatus;
  });

  renderJobs(filtered);
}

function filterByStatus(status) {
  document.getElementById('status-filter').value = status;
  filterJobs();
}

// ── Modal ─────────────────────────────────────────────────
function openModal(job = null) {
  document.getElementById('job-form').reset();
  document.getElementById('modal-title').textContent = job ? 'Edit Application' : 'Add Application';
  document.getElementById('save-btn').textContent    = job ? 'Update' : 'Save';
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
  }

  document.getElementById('job-modal').classList.remove('hidden');
  document.getElementById('company').focus();
}

function closeModal() {
  document.getElementById('job-modal').classList.add('hidden');
}

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
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
  };

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
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

// ── XSS protection ───────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
