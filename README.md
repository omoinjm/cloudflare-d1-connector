# D1 Studio

A dark-mode web GUI for querying [Cloudflare D1](https://developers.cloudflare.com/d1/) SQLite databases, inspired by Cloudflare D1 Studio. Built with Next.js, TypeScript, and Tailwind CSS.

![Stack](https://img.shields.io/badge/Next.js-16-black)
![Stack](https://img.shields.io/badge/TypeScript-5-blue)
![Stack](https://img.shields.io/badge/Cloudflare-D1-orange)

## Features

- **SQL query editor** — Monospace editor with `Ctrl+Enter` / `Cmd+Enter` to execute
- **Multiple database connections** — Save and switch between different account/database/token combinations
- **Table browser** — Left sidebar lists tables for the active connection; click to run `SELECT * … LIMIT 100`
- **Results grid** — Sticky headers, row hover, scrollable output with execution time and row count
- **Export** — Download results as Excel (`.xlsx`), JSON, or CSV
- **Encrypted credential storage** — API tokens encrypted in the browser; session or local persistence
- **Error handling** — Network, auth, and SQL errors shown in the UI

## Quick start

### Prerequisites

- Node.js 20+
- A Cloudflare account with at least one D1 database
- An [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with **D1 Read** (or Read/Write) permissions

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

## Usage

### 1. Add a connection

On first launch, the connection modal opens automatically. Enter:

| Field | Description |
|-------|-------------|
| **Label** | Friendly name (e.g. `Production`, `Staging`) |
| **Account ID** | Your Cloudflare account ID |
| **Database ID** | D1 database UUID |
| **API Token** | Bearer token with D1 access |
| **Storage** | **Session** (tab lifetime) or **Local** (persists across restarts) |

Click **Add & Connect**. Credentials are validated against the D1 API before being saved.

### 2. Manage multiple databases

Use **Add Connection** in the header or the **+** button in the sidebar to add more instances. Each connection can use a different account, database, and token.

- **Click** a database in the sidebar to switch the active connection
- **Edit** (pencil) to update credentials or label
- **Delete** (trash) to remove a saved connection

### 3. Run queries

- Select a table from the sidebar, or write SQL in the editor
- Click **Execute Query** or press `Ctrl+Enter` / `Cmd+Enter`
- Use the **Export** dropdown to download results

## Architecture

```
src/
├── app/
│   ├── api/query/route.ts   # Server proxy to Cloudflare D1 API (avoids CORS)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ConnectionModal.tsx  # Add/edit connection popup
│   ├── D1Studio.tsx         # Main app shell
│   ├── DataGrid.tsx
│   ├── ErrorBanner.tsx
│   ├── ExportDropdown.tsx
│   ├── QueryEditor.tsx
│   ├── StatusBar.tsx
│   └── TableSidebar.tsx     # Databases + tables
├── lib/
│   ├── connection-storage.ts # Encrypted multi-connection persistence
│   ├── d1-api.ts             # Client D1 helpers
│   └── export-data.ts        # Excel / JSON / CSV export
└── types/
    └── d1.ts
```

### D1 API integration

The browser calls `/api/query`, which proxies requests to:

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
```

Headers: `Authorization: Bearer {api_token}`, `Content-Type: application/json`  
Body: `{ "sql": "<query>" }`

The API token is sent from the client on each request and is **not** stored on the server.

### Credential storage

| Data | Storage |
|------|---------|
| API token | AES-GCM encrypted |
| Account ID, Database ID, label | Plain text (for display) |
| Connection fingerprint | SHA-256 hash |

Session connections live in `sessionStorage`; local connections in `localStorage`. A legacy single-connection format is migrated automatically on load.

## Security notes

- This tool is intended for **local or trusted** use. Anyone with access to the running app and browser storage can query your D1 databases.
- API tokens remain in browser storage (encrypted). Use **Session** storage on shared machines.
- For production deployments, consider adding authentication in front of the app and restricting network access.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint |

## License

Private — see repository owner for terms.
