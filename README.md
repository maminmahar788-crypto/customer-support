# SupportDesk Pro — MERN Customer Support Helpdesk

A local-development full-stack project using React + Vite, Express, MongoDB/Mongoose, JWT authentication, Socket.IO, and Recharts. It includes customer/agent/admin roles, ticket priorities and statuses, live ticket chat, SLA deadline tracking, and reports.


## 1. Prerequisites

Install these on Windows:
- Node.js LTS (includes npm): https://nodejs.org/
- MongoDB Community Server: https://www.mongodb.com/try/download/community
- Optional: MongoDB Compass to inspect your local database.
- VS Code (recommended): https://code.visualstudio.com/

Verify Node/npm in PowerShell:

```powershell
node -v
npm -v
```

MongoDB should be installed as a Windows service and running. If you installed it as a service, open Windows Services and confirm **MongoDB Server** is running. The app uses `mongodb://127.0.0.1:27017/supportdesk_pro` by default.

## 2. Open the project

Extract the `supportdesk-pro` folder somewhere convenient, for example `E:\Projects\supportdesk-pro`, then open that folder in VS Code. There are two independent apps:

- `server` — Express REST API and Socket.IO server.
- `client` — React UI served by Vite.

## 3. Configure the backend

Open a PowerShell terminal in VS Code:

```powershell
cd server
Copy-Item .env.example .env
```

Open `server/.env`. For local MongoDB, use values like:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/supportdesk_pro
JWT_SECRET=use_a_long_random_secret_for_local_development_only
CLIENT_URL=http://localhost:5173
```

`MONGODB_URI` tells Mongoose where the database lives. `JWT_SECRET` signs login tokens; use a private, long random value. `.env` is local configuration and must not be shared. This project intentionally does not require a cloud database.

Install backend dependencies:

```powershell
npm install
```

This reads `server/package.json` and downloads Express, Mongoose, JWT, Socket.IO, security middleware, and other libraries into `server/node_modules`.

## 4. Seed demo accounts

Still in `server`:

```powershell
npm run seed
```

This creates these demo users if they don't already exist:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@supportdesk.local` | `Admin123!` |
| Agent | `agent@supportdesk.local` | `Agent123!` |
| Customer | `customer@supportdesk.local` | `Customer123!` |

Passwords are hashed with bcrypt before they are saved. These are local demo credentials only. The public registration endpoint always creates a customer; it does not allow people to register themselves as admin or agent.

## 5. Start the backend

From `server`:

```powershell
npm run dev
```

Expected terminal output includes `MongoDB connected: supportdesk_pro` and `SupportDesk API running at http://localhost:5000`. Keep this terminal open. To test the API, open `http://localhost:5000/api/health` in your browser; it should return a small JSON status response.

If MongoDB refuses the connection, confirm the MongoDB service is running and the URI in `.env` is correct.

## 6. Install and start the frontend

Open a **second** VS Code terminal (leave the backend running):

```powershell
cd client
Copy-Item .env.example .env
npm install
npm run dev
```

Vite prints a local address, normally `http://localhost:5173`. Open it in your browser. The client `.env` points to the local API and Socket.IO server; no deployment is involved.

## 7. Try the app by role

1. Sign in as the demo customer and create a ticket. Choose a category and priority.
2. Sign out, sign in as the demo agent, open the ticket, assign it to an agent, change status/priority, and reply.
3. Keep a second browser profile or incognito window signed in as the customer to see the ticket conversation. Socket.IO delivers new messages to connected ticket viewers.
4. Sign in as admin to see the same support overview and agent performance reporting.
5. Visit Reports to inspect ticket counts, priorities, overdue SLA count, and average resolution time.

The API restricts customers to their own ticket list and ticket detail. Admins/agents can see and manage the support queue. In this starter, agents see assigned tickets plus unassigned tickets.

## 8. SLA policy in this starter

The editable policy is in `server/src/utils/sla.js`:

| Priority | First response deadline | Resolution deadline |
|---|---:|---:|
| Urgent | 1 hour | 8 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 72 hours |
| Low | 24 hours | 120 hours |

Deadlines use elapsed clock hours, not business hours, holidays, or a working-hours calendar. The UI shows due times and overdue status; reports count tickets whose response or resolution deadlines have passed. This is an educational starter SLA implementation, not a contractual SLA engine.

## 9. Main project structure

```text
supportdesk-pro/
├── README.md
├── server/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/db.js
│       ├── controllers/authController.js
│       ├── controllers/ticketController.js
│       ├── middleware/auth.js
│       ├── models/User.js
│       ├── models/Ticket.js
│       ├── models/Message.js
│       ├── routes/authRoutes.js
│       ├── routes/ticketRoutes.js
│       ├── utils/sla.js
│       ├── seed.js
│       └── server.js
└── client/
    ├── .env.example
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        └── styles.css
```

## 10. How the code works

- **Authentication:** `/api/auth/register` and `/api/auth/login` return a JWT. `protect` middleware validates the token and loads the user. Passwords are bcrypt-hashed.
- **Tickets:** `Ticket` stores customer, assigned agent, status, priority, and SLA timestamps. `POST /api/tickets` creates a ticket and adds the initial description as the first message.
- **Chat:** messages are stored in MongoDB. The frontend emits a `ticket:join` event to join the ticket room; the server only permits the ticket's customer or signed-in support staff. New messages are sent over Socket.IO and also saved via REST.
- **SLA:** the selected priority determines response and resolution deadlines. The first agent/admin reply records `firstResponseAt`; resolving or closing records `resolvedAt`.
- **Reports:** `/api/tickets/reports` aggregates ticket counts by status and priority, overdue cases, average elapsed resolution hours, and agent assigned/resolved counts.
- **Frontend:** the single React app provides authentication, overview, ticket list, ticket details/chat, SLA details, and reports. Styling is local CSS; Google Fonts are an optional external font request and the UI still works if unavailable.

## 11. API route reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Check API status |
| POST | `/api/auth/register` | Create customer account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/tickets` | List accessible tickets; optional `status`, `priority`, `search` query parameters |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Ticket detail and messages |
| PATCH | `/api/tickets/:id` | Staff updates status, priority, assignment |
| POST | `/api/tickets/:id/messages` | Send a chat reply |
| GET | `/api/tickets/agents` | List agents/admins for assignment |
| GET | `/api/tickets/reports` | Ticket analytics |

## 12. Troubleshooting

- **`npm` is not recognized:** reinstall Node.js LTS and restart VS Code/PowerShell.
- **MongoDB `ECONNREFUSED`:** start the MongoDB Windows service and confirm port 27017 is listening.
- **Port 5000 already in use:** change `PORT` in `server/.env` and update `VITE_API_URL` / `VITE_SOCKET_URL` in `client/.env` accordingly.
- **CORS error:** ensure `CLIENT_URL=http://localhost:5173` in `server/.env` and restart the backend.
- **No demo users:** run `npm run seed` from the `server` directory.
- **Chat does not update:** keep both terminals running, verify both client/server URLs, and sign in again to refresh the token.
- **Ticket shows overdue:** that is expected if the configured SLA deadline has passed; change the priority policy in `server/src/utils/sla.js` if you want a different demo policy.

## 13. Scope and production hardening

This is a complete local-learning starter, not a production-certified helpdesk. Before real users, add automated tests, audit logging, pagination for large ticket sets, attachment malware scanning, email delivery, stronger socket ticket assignment rules, account recovery, refresh-token/session revocation, and business-hours SLA calendars. Do not expose the server publicly with demo credentials or the example JWT secret.
