// Redirect if already logged in
if (localStorage.getItem('token')) {
  window.location.href = '/dashboard.html';
}

function showTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('login-tab').classList.toggle('active', tab === 'login');
  document.getElementById('register-tab').classList.toggle('active', tab === 'register');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) { errEl.textContent = data.error; return; }

    localStorage.setItem('token',    data.token);
    localStorage.setItem('username', data.username);
    window.location.href = '/dashboard.html';
  } catch {
    errEl.textContent = 'Cannot reach server. Make sure it is running.';
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';

  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, email, password }),
    });
    const data = await res.json();

    if (!res.ok) { errEl.textContent = data.error; return; }

    localStorage.setItem('token',    data.token);
    localStorage.setItem('username', data.username);
    window.location.href = '/dashboard.html';
  } catch {
    errEl.textContent = 'Cannot reach server. Make sure it is running.';
  }
});
