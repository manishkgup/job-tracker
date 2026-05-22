# Application Architecture

## The Big Picture

```
┌─────────────────────────────────────────┐
│           BROWSER (Chrome)              │
│  index.html / dashboard.html            │
│  style.css  → how it looks              │
│  login.js / app.js → what it does       │
│                                         │
│  Uses fetch() to talk to the server     │
└──────────────────┬──────────────────────┘
                   │  HTTP (JSON over port 3000)
                   ▼
┌─────────────────────────────────────────┐
│         SERVER  (Node.js + Express)     │
│                                         │
│  server.js → starts the server          │
│  routes/auth.js → /api/auth/*           │
│  routes/jobs.js → /api/jobs/*           │
│  middleware/auth.js → checks JWT token  │
└──────────────────┬──────────────────────┘
                   │  SQL queries
                   ▼
┌─────────────────────────────────────────┐
│         DATABASE  (SQLite)              │
│         jobs.db  (a single file)        │
│                                         │
│  Table: users  (id, username, email...) │
│  Table: jobs   (id, company, status...) │
└─────────────────────────────────────────┘
```

This is called a **3-tier architecture**: Frontend → Backend → Database.
It is the foundation of almost every web app you will ever use.

---

## The Technology Stack

### Runtime: Node.js
- JavaScript has always run in browsers. **Node.js** lets JavaScript run on a server (your machine) instead.
- It is the engine that runs `server.js` when you type `npm start`.

### Web Framework: Express
- Node.js alone can handle HTTP requests, but it is very low-level.
- **Express** is a thin layer on top that makes it easy to define routes like `GET /api/jobs` or `POST /api/auth/login`.
- Think of it as the traffic controller — it reads the incoming URL and method, and hands the request to the right function.

### Database: SQLite (`node:sqlite`)
- **SQLite** stores data in a single file (`jobs.db`) on disk. No separate database server to install or run.
- You talk to it using **SQL** — structured queries like `SELECT * FROM jobs WHERE user_id = 3`.
- `node:sqlite` is built directly into Node.js 22+ so no extra install is needed.

### Authentication: JWT + bcryptjs

Two separate problems, two separate tools:

| Problem | Tool | How it works |
|---------|------|--------------|
| Store passwords safely | **bcryptjs** | Hashes the password before saving. A hash is a one-way transformation — you can never reverse it back to the original password. |
| Prove who you are on every request | **JWT** (JSON Web Token) | After login the server creates a signed token and sends it to the browser. The browser sends it back with every request. The server verifies the signature — no database lookup needed. |

### Frontend: Vanilla HTML / CSS / JavaScript
- No framework (no React, no Vue). Just the raw building blocks of the web.
- **HTML** defines the structure (buttons, inputs, tables).
- **CSS** controls the visual appearance (colors, layout, spacing).
- **JavaScript** handles behavior — listening for clicks, calling the server with `fetch()`, updating the page with the response.

---

## How One Request Flows End-to-End

Here is exactly what happens when you click **Save** on a new job application:

```
1. BROWSER  — app.js calls:
              fetch('POST /api/jobs', { body: { company, position... } })
              + Authorization: Bearer <token> in the header

2. EXPRESS  — server.js receives the request
              matches it to routes/jobs.js (POST /)

3. MIDDLEWARE — middleware/auth.js runs first
               reads the token from the header
               verifies the JWT signature
               attaches req.user = { id: 5, username: "manish" }
               passes control to the route handler

4. ROUTE    — routes/jobs.js runs the INSERT SQL query:
               INSERT INTO jobs (user_id, company...) VALUES (5, 'Google'...)

5. DATABASE — SQLite writes the row to jobs.db on disk
               returns the new row's ID

6. ROUTE    — fetches the saved row, sends it back as JSON:
               { id: 12, company: "Google", status: "Applied"... }

7. BROWSER  — app.js receives the JSON response
               closes the modal, reloads the job list
               re-renders the table with the new row
```

---

## The File Map

```
server.js              ← starts Express, wires up routes, serves public/
database.js            ← opens jobs.db, creates tables if they don't exist
middleware/
  auth.js              ← reads + verifies JWT on every /api/jobs call
routes/
  auth.js              ← POST /api/auth/register  and  /api/auth/login
  jobs.js              ← GET / POST / PUT / DELETE  /api/jobs
public/                ← static files the browser downloads directly
  index.html           ← login / register page
  dashboard.html       ← main app page
  style.css            ← all visual styling
  login.js             ← handles the login/register form submissions
  app.js               ← loads jobs, renders table, opens modal, saves edits
```

---

## Key Concepts

**REST API** — A convention for structuring URLs and HTTP methods. `GET` = read, `POST` = create, `PUT` = update, `DELETE` = delete. The server only deals in data (JSON); it does not care how the UI looks.

**Stateless auth with JWT** — The server does not store sessions. Every request carries its own proof of identity (the token). The server just checks the signature — like verifying a signed letter without needing to look up who signed it.

**Middleware** — A function that runs between the request arriving and the route handler. Used here for auth, but the same pattern is used for logging, rate limiting, input validation, etc.

**Static files** — Files in `public/` (HTML, CSS, JS) are served directly by Express without any processing. The browser downloads them once and runs them locally. The backend only gets involved when `fetch()` is called.

**Single source of truth** — The database is authoritative. The frontend never trusts its own in-memory state for long — after every add/edit/delete it re-fetches from the server to make sure what it shows is accurate.
