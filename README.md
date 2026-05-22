# Job Tracker

A full-stack web application to track job applications, built for learning purposes.

## Architecture

```
Browser (Chrome)
  │  HTML / CSS / JavaScript (public/)
  │  fetch() API calls
  ▼
Express Server  (server.js — port 3000)
  │  Routes: /api/auth  /api/jobs
  │  Middleware: JWT auth check
  ▼
SQLite Database  (jobs.db — a single file)
  │  Tables: users, jobs
```

### How the pieces connect

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| **Frontend** | `public/index.html` + `login.js` | Login / Register UI |
| **Frontend** | `public/dashboard.html` + `app.js` | App UI, fetch calls |
| **Frontend** | `public/style.css` | Styling |
| **Backend entry** | `server.js` | Starts Express, mounts routes |
| **Auth routes** | `routes/auth.js` | POST /api/auth/login, /register |
| **Jobs routes** | `routes/jobs.js` | CRUD for job applications |
| **Auth middleware** | `middleware/auth.js` | Verifies JWT on every /api/jobs call |
| **Database** | `database.js` | Creates tables, exports `db` |

### Key concepts demonstrated

- **REST API** — structured HTTP verbs (GET / POST / PUT / DELETE)
- **JWT authentication** — stateless tokens stored in `localStorage`
- **Password hashing** — `bcryptjs` hashes passwords before storing
- **SQLite** — file-based relational database (built into Node.js 22+)
- **Middleware** — `auth.js` runs before every protected route
- **SPA pattern** — server serves static files; frontend handles navigation

## Quick start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in Chrome
# → http://localhost:3000
```

For auto-reload during development:
```bash
npm run dev
```

## API reference

### Auth

| Method | Endpoint | Body | Returns |
|--------|----------|------|---------|
| POST | `/api/auth/register` | `{ username, email, password }` | `{ token, username }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, username }` |

### Jobs  *(all require `Authorization: Bearer <token>` header)*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all your applications |
| POST | `/api/jobs` | Add a new application |
| PUT | `/api/jobs/:id` | Update an application |
| DELETE | `/api/jobs/:id` | Delete an application |

## Application statuses

`Applied` → `Phone Screen` → `Interview` → `Technical` → `Offer`  
`Rejected` / `Withdrawn` (terminal states)

## Tech stack

- **Node.js** (runtime)
- **Express** (HTTP server + routing)
- **node:sqlite** (built-in SQLite — no install needed)
- **bcryptjs** (password hashing)
- **jsonwebtoken** (JWT creation + verification)
- Vanilla HTML / CSS / JavaScript (no framework)
