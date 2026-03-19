# Hosting CLIkanban

This guide covers how to deploy CLIkanban as a self-hosted web application.

## Overview

CLIkanban ships with an Express 5 production server that:

- Serves the built Vue SPA from `web/dist/`
- Provides the JSON API (same endpoints as the Vite dev middleware)
- Supports HTTP and HTTPS
- Stores data as JSON files on disk (in `boards/`)

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

Visit `http://localhost:3000` to access the web UI. Interactive API documentation is available at `/api/docs`.

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

That's it. The web UI is available at `http://localhost:3000`. Board data is persisted in a named Docker volume.

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
  --restart unless-stopped \
  clikanban
```

### Custom Port

```bash
docker run -d -p 8080:3000 -v clikanban-boards:/app/boards clikanban
```

### Bind Mount (Instead of Named Volume)

To store board data in a host directory (useful for easy backups):

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/your/boards:/app/boards \
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

Board data is stored as plain JSON files in `boards/`. Back up this directory regularly:

```bash
# Simple backup
tar -czf clikanban-backup-$(date +%Y%m%d).tar.gz boards/

# Or rsync to a remote location
rsync -avz boards/ backup-server:/backups/clikanban/
```

## Security Considerations

- **Do not expose the API to the public internet without authentication.** CLIkanban has no built-in authentication. Use a reverse proxy with basic auth, VPN, or SSH tunnels.
- **Keep Node.js updated.** Run `npm audit` regularly (the CI workflow includes a weekly audit).
- **Use HTTPS in production.** Either via the built-in HTTPS support or a reverse proxy with TLS.
- **Restrict file permissions** on the `boards/` directory to the server user only.

## Troubleshooting

### Server won't start

- Check that `web/dist/` exists (run `npm run build` first)
- Check the port isn't already in use: `lsof -i :3000`
- Check Node.js version: `node --version` (requires Node 20+)

### HTTPS certificate errors

- Self-signed certs will always show browser warnings — this is normal
- For production, use Let's Encrypt via nginx/Caddy
- Check that `openssl` is installed (required for self-signed cert generation)

### GitHub CLI not working

- Ensure `gh` is installed: `gh --version`
- Ensure you're authenticated: `gh auth status`
- The server process needs `gh` in its PATH
