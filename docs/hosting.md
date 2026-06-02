# Hosting CLIkanban

This guide covers how to deploy CLIkanban as a self-hosted web application.

## Overview

CLIkanban ships with an Express 5 production server that:

- Serves the built Vue SPA from `web/dist/`
- Provides authenticated account APIs and legacy JSON board APIs
- Supports HTTP and HTTPS
- Stores account, session, board, column, card, and settings data in SQL
- Keeps legacy CLI board data as JSON files on disk in `boards/`

## Quick Setup

```bash
# Clone and install
git clone <repo-url> kanban
cd kanban
npm install

# Build the web UI
npm run build

# Start the server
npm run start          # HTTP on port 3000
```

Visit `http://localhost:3000` to access the web UI. The default database path is `data/kanban.db`; override it with `KANBAN_DB_PATH`.

```bash
KANBAN_DB_PATH=./data/kanban.db npm run start
```

Interactive API documentation is available at `/api/docs`.

## GitHub OAuth

For local login, create a GitHub OAuth App with:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/github/callback`

Start the backend with:

```bash
GITHUB_CLIENT_ID=your_client_id \
GITHUB_CLIENT_SECRET=your_client_secret \
GITHUB_OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/github/callback \
KANBAN_DB_PATH=./data/kanban.db \
npm run start
```

For production, set the callback to your public URL, for example `https://kanban.example.com/api/auth/github/callback`, and use the same value for `GITHUB_OAUTH_REDIRECT_URL`. A mismatch between GitHub's callback URL and the app's `redirect_uri` will make GitHub reject the token exchange.

GitHub-authenticated users display their GitHub avatar. Email/password users keep the initials avatar. If GitHub does not expose an email address or rejects the private email lookup, CLIkanban stores a stable GitHub noreply-style email for that account.

GitHub issue/PR metadata refresh uses the public GitHub REST API by default. Set `GITHUB_TOKEN` on the server if cards point to private repositories or you need higher API rate limits.

## Local Frontend Development

The authenticated frontend expects the Express backend on `http://localhost:3000`.

Run the backend in one terminal:

```bash
KANBAN_DB_PATH=./data/kanban.db npm run start
```

Run Vite in another terminal:

```bash
npm run dev
```

The Vite dev server proxies authenticated `/api/auth`, `/api/me`, and `/api/account` requests to `http://localhost:3000`.

## Server Options

### Port

```bash
node server/src/index.js --port 8080
# or
PORT=8080 node server/src/index.js
```

### HTTPS

```bash
# Auto-generated self-signed certificate (for dev/testing)
node server/src/index.js --https
# or
HTTPS=true node server/src/index.js

# Custom certificates (for production)
TLS_CERT=/path/to/cert.pem TLS_KEY=/path/to/key.pem node server/src/index.js --https
```

The auto-generated certificate uses `openssl` to create a self-signed cert valid for 365 days with `CN=localhost`. Browsers will show a security warning — this is expected for self-signed certs.

## Production Deployment

### Recommended Setup

For production, we recommend:

1. **VPS or dedicated server** (e.g., a small DigitalOcean droplet, Hetzner, or Linode instance)
2. **Reverse proxy** (nginx or Caddy) for TLS termination
3. **Process manager** (systemd or PM2) to keep the server running
4. **Let's Encrypt** for free TLS certificates

### Using systemd

Create a service file at `/etc/systemd/system/clikanban.service`:

```ini
[Unit]
Description=CLIkanban Server
After=network.target

[Service]
Type=simple
User=clikanban
WorkingDirectory=/opt/clikanban
ExecStart=/usr/bin/node server/src/index.js --port 3000
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=KANBAN_DB_PATH=/opt/clikanban/data/kanban.db
Environment=GITHUB_CLIENT_ID=your_client_id
Environment=GITHUB_CLIENT_SECRET=your_client_secret
Environment=GITHUB_OAUTH_REDIRECT_URL=https://kanban.example.com/api/auth/github/callback

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable clikanban
sudo systemctl start clikanban
sudo systemctl status clikanban
```

### Using PM2

```bash
npm install -g pm2

# Start
pm2 start server/src/index.js --name clikanban -- --port 3000

# Auto-start on boot
pm2 startup
pm2 save
```

### nginx Reverse Proxy

Use nginx to handle TLS and proxy to CLIkanban:

```nginx
server {
    listen 80;
    server_name kanban.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name kanban.example.com;

    ssl_certificate     /etc/letsencrypt/live/kanban.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kanban.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get a free certificate with Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kanban.example.com
```

### Caddy (Simpler Alternative)

Caddy handles TLS automatically:

```
kanban.example.com {
    reverse_proxy localhost:3000
}
```

```bash
caddy run --config Caddyfile
```

Caddy will automatically obtain and renew Let's Encrypt certificates.

## Remote Access via SSH

If CLIkanban runs on a remote server, you can access it via SSH tunnel without exposing the port publicly:

```bash
# Forward local port 3000 to the remote server's port 3000
ssh -L 3000:localhost:3000 user@your-server.com

# Then open http://localhost:3000 in your browser
```

For persistent tunnels, add to `~/.ssh/config`:

```
Host kanban-server
    HostName your-server.com
    User clikanban
    LocalForward 3000 localhost:3000
```

Then just run `ssh kanban-server` and visit `http://localhost:3000`.

### Using the CLI Remotely

You can run CLI commands directly via SSH:

```bash
# One-off command
ssh user@your-server.com "cd /opt/clikanban && node cli/bin/kanban.js board list --ni"

# Interactive session
ssh -t user@your-server.com "cd /opt/clikanban && node cli/bin/kanban.js"
```

The `-t` flag allocates a TTY, enabling interactive mode on the remote machine.

## Docker

CLIkanban includes a production-ready `Dockerfile` and `docker-compose.yml` for one-command deployment.

### Quick Start (Docker Compose)

```bash
docker compose up -d
```

That's it. The web UI is available at `http://localhost:3000`. Account database state is persisted in the `data` volume; legacy board JSON is persisted in the `boards` volume.

To use a different port:

```bash
PORT=8080 docker compose up -d
```

To stop:

```bash
docker compose down
```

### Manual Docker Build

If you prefer not to use Compose:

```bash
# Build the image
docker build -t clikanban .

# Run with a named volume for board data
docker run -d \
  --name clikanban \
  -p 3000:3000 \
  -v clikanban-boards:/app/boards \
  -v clikanban-data:/app/data \
  --restart unless-stopped \
  clikanban
```

### Custom Port

```bash
docker run -d \
  -p 8080:3000 \
  -v clikanban-boards:/app/boards \
  -v clikanban-data:/app/data \
  clikanban
```

### Bind Mount (Instead of Named Volume)

To store runtime data in host directories (useful for easy backups):

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/your/boards:/app/boards \
  -v /path/to/your/data:/app/data \
  clikanban
```

Or in `docker-compose.yml`, replace the volumes section:

```yaml
services:
  clikanban:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./my-boards:/app/boards
      - ./my-data:/app/data
    restart: unless-stopped
```

### Running CLI Commands in the Container

```bash
# List boards
docker exec clikanban node cli/bin/kanban.js board list --ni

# Add a card
docker exec clikanban node cli/bin/kanban.js card add my-project "New task" --ni

# Interactive session
docker exec -it clikanban node cli/bin/kanban.js
```

### Docker with nginx + Let's Encrypt

For production with TLS, use Docker Compose with an nginx reverse proxy:

```yaml
services:
  clikanban:
    build: .
    restart: unless-stopped
    volumes:
      - boards:/app/boards
      - data:/app/data
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - certs:/etc/letsencrypt:ro
    depends_on:
      - clikanban

volumes:
  boards:
  data:
  certs:
```

### Multi-Architecture Builds

To build for multiple platforms (e.g., for deploying to ARM servers):

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t clikanban .
```

### Image Details

The Dockerfile uses a multi-stage build:

1. **Build stage**: Installs all dependencies, builds the Vue SPA
2. **Production stage**: Installs production dependencies only, copies the built SPA and server/CLI source

The final image runs as a non-root `node` user and is based on `node:22-alpine` (~180 MB).

## Data Backup

Account data is stored in SQLite database files under `data/` by default. Legacy CLI board data is stored as JSON files under `boards/`. Back up both directories regularly:

```bash
# Simple backup
tar -czf clikanban-backup-$(date +%Y%m%d).tar.gz data/ boards/

# Or rsync to a remote location
rsync -avz data/ boards/ backup-server:/backups/clikanban/
```

If the server is running while you back up SQLite files, include the `*.db`, `*.db-wal`, and `*.db-shm` files together.

## Security Considerations

- **Use HTTPS in production.** Session cookies are HTTP-only; set `COOKIE_SECURE=true` only when the app is served over HTTPS.
- **Keep database files private.** Restrict file permissions on `data/` and `boards/` to the server user only.
- **Keep Node.js updated.** Run `npm audit` regularly (the CI workflow includes a weekly audit).
- **Protect legacy file APIs** if you expose them beyond trusted users. The current web UI uses authenticated account APIs, but legacy file-backed endpoints still exist for compatibility.

## Troubleshooting

### Server won't start

- Check that `web/dist/` exists (run `npm run build` first)
- Check the port isn't already in use: `lsof -i :3000`
- Check Node.js version: `node --version` (requires Node 20+)
- Check database path permissions: `KANBAN_DB_PATH=./data/kanban.db npm run start`

### HTTPS certificate errors

- Self-signed certs will always show browser warnings — this is normal
- For production, use Let's Encrypt via nginx/Caddy
- Check that `openssl` is installed (required for self-signed cert generation)

### GitHub CLI not working

- Ensure `gh` is installed: `gh --version`
- Ensure you're authenticated: `gh auth status`
- The server process needs `gh` in its PATH
