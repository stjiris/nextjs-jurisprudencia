# Deployment Guide

This system has two deployments that communicate via email sync:

- **Externo** — the public-facing server. Hosts the mailserver. Receives sync emails via IMAP.
- **Interno (dev mode)** — the internal editing server. Sends sync emails via SMTP to the externo mailserver.

Both run on the same repository and docker-compose file, using Docker Compose profiles to select which services start.

---

## Infrastructure Overview

```
Internet
    │
    ▼
[Nginx Proxy / Router]  ← TCP stream on port 587 → [Externo Machine :587]
    │ HTTP :80
    ▼
[Externo Machine]
  - server_externo    (Next.js, port 80)
  - elasticsearch
  - redis
  - mailserver        (IMAP :143, SMTP submission :587)
  - clitools_externo  (backup, RSS, email-sync cron)

[Interno Machine]
  - server_dev        (Next.js dev mode, port 80)
  - elasticsearch
  - redis
  - clitools_dev      (ETL, backup, RSS)
```

The interno machine sends sync emails to the externo mailserver over the internet (port 587). The externo clitools polls the mailserver via IMAP every minute and applies received actions.

---

## Prerequisites

Both machines need:
- Docker and Docker Compose v2 installed
- The repository cloned to the same path (e.g. `/root/nextjs-jurisprudencia`)
- Sibling repositories cloned at the same level:
  ```
  /root/
    nextjs-jurisprudencia/
    jurisprudencia-etl/
    jurisprudencia-privada-etl/
    version-converter/
    backup-jurisprudencia/
  ```

---

## Externo Deployment

### 1. Create `.env`

```env
NEXT_BASE_PATH=/jurisprudencia
SERVER_HOST=0.0.0.0
SERVER_PORT=80

PUBLIC_STATES="público"

ES_JAVA_OPTS="-Xms6g -Xmx6g"

RSS_LINK="https://<your-public-domain>/jurisprudencia"

SYNC_ROLE=externo
SYNC_SECRET=<choose-a-strong-shared-secret>

SYNC_IMAP_HOST=mailserver
SYNC_IMAP_PORT=143
SYNC_IMAP_SECURE=false
SYNC_IMAP_USER=sync@mail.juris.internal
SYNC_IMAP_PASS=<choose-a-password>
SYNC_IMAP_TRUSTED_FROM=sync@mail.juris.internal
```

> `SYNC_SECRET` must be identical on both externo and interno machines.
> `SYNC_IMAP_PASS` must match the password used when creating the mailserver account (step 3).

### 2. Build and start

```bash
docker compose --profile externo up -d --build
```

This starts: `server_externo`, `elasticsearch`, `redis`, `mailserver`, `clitools_externo`.

Wait for all services to be healthy:
```bash
docker compose --profile externo ps
```

### 3. Create the mailserver email account

The mailserver waits up to 120 seconds for an account to be created before shutting down. Run this promptly after starting:

```bash
docker exec nextjs-jurisprudencia-mailserver-1 setup email add sync@mail.juris.internal <password>
```

Use the same password as `SYNC_IMAP_PASS` in `.env`.

Verify it's running:
```bash
docker logs nextjs-jurisprudencia-mailserver-1 2>&1 | grep "is up and running"
```

### 4. Create the admin user

```bash
# Open a shell in the server container
docker exec -it nextjs-jurisprudencia-server_externo-1 sh

# Inside the container, create the admin user
node scripts/create-admin.js   # or however admin creation is done in this project
```

Alternatively, use the admin UI at `https://<domain>/jurisprudencia/admin/users` once logged in.

---

## Interno Deployment (Dev Mode)

> **Important:** Use only `--profile dev`. Do NOT combine `--profile dev --profile interno` — both `server_dev` and `server_interno` bind to port 3000 and will conflict.

### 1. Create `.env`

```env
NEXT_BASE_PATH=/dev-jurisprudencia
SERVER_HOST=0.0.0.0
SERVER_PORT=80

PUBLIC_STATES=público

ES_JAVA_OPTS="-Xms6g -Xmx6g"

ANONIMIZADOR_URL=https://<your-public-domain>/dev-jurisprudencia-anonimizador/
ANONIMIZADOR_SECRET=<anonimizador-secret>

SYNC_ROLE=interno
SYNC_SECRET=<same-shared-secret-as-externo>

SYNC_SMTP_HOST=<externo-public-hostname-or-ip>
SYNC_SMTP_PORT=587
SYNC_SMTP_SECURE=false
SYNC_SMTP_USER=sync@mail.juris.internal
SYNC_SMTP_PASS=<same-password-as-externo-imap>
SYNC_SMTP_FROM=sync@mail.juris.internal
SYNC_SMTP_TO=sync@mail.juris.internal
```

> `SYNC_SMTP_HOST` must be just a hostname or IP — no `https://`, no path.
> `SYNC_SMTP_PASS` must match the mailserver account password on the externo machine.

### 2. Build and start

```bash
docker compose --profile dev up -d --build
```

This starts: `server_dev`, `elasticsearch`, `redis`, `clitools_dev`.

### 3. Verify filesystem-results volume is mounted

The `server_dev` container mounts `../jurisprudencia-privada-etl/results` as `/filesystem-results`. After starting, confirm it's accessible:

```bash
docker exec nextjs-jurisprudencia-server_dev-1 ls /filesystem-results/
```

If the directory is empty or the command errors, force-recreate the container:

```bash
docker compose --profile dev up -d --force-recreate server_dev
```

---

## Nginx Proxy Configuration

The nginx proxy machine handles:
- HTTP traffic on port 80 (reverse proxy to both machines)
- TCP traffic on port 587 (stream proxy to the externo mailserver)

### HTTP (sites-enabled config)

Add location blocks as needed for your paths, proxying to the externo machine's internal IP (e.g. `10.10.10.92`):

```nginx
location /jurisprudencia {
    proxy_pass http://10.10.10.92:80;
    client_max_body_size 200G;
    proxy_connect_timeout 3600s;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    send_timeout 3600s;
}
```

### SMTP TCP proxy (nginx.conf)

Add a `stream {}` block **outside and after** the `http {}` block in `/etc/nginx/nginx.conf`:

```nginx
stream {
    server {
        listen 587;
        proxy_pass 10.10.10.92:587;
    }
}
```

Reload nginx:
```bash
nginx -t && nginx -s reload
```

Verify nginx is listening on 587:
```bash
ss -tlnp | grep 587
```

---

## Network / Firewall Configuration

### If behind a NAT router or Proxmox host

If the public IP belongs to a router or Proxmox host (not directly to the nginx VM), you need to add a port-forwarding rule for port 587 on the machine that owns the public IP.

On the machine with the public IP:
```bash
iptables -t nat -A PREROUTING -p tcp --dport 587 -j DNAT --to-destination <nginx-internal-ip>:587
iptables -A FORWARD -p tcp -d <nginx-internal-ip> --dport 587 -j ACCEPT
```

Make the rules persistent:
```bash
apt install iptables-persistent -y
netfilter-persistent save
```

### Firewall on nginx machine

Ensure port 587 is open. If using ufw:
```bash
ufw allow 587/tcp
```

---

## Testing the Email Sync

### 1. Confirm connectivity from interno to externo port 587

```bash
# on interno machine
nc -zv <externo-public-hostname> 587
```

Should output: `Connection to ... 587 port [tcp/submission] succeeded!`

### 2. Trigger a sync from interno

Publish or change the state of a document in the interno UI. Check the interno server logs for success:

```bash
docker logs nextjs-jurisprudencia-server_dev-1 2>&1 | grep -i sync
```

Should show something like: `[gestao/publicar] Sync email sent`

### 3. Verify email landed in the mailserver

```bash
# on externo machine
docker exec nextjs-jurisprudencia-mailserver-1 ls /var/mail/mail.juris.internal/sync/new/
```

Should show one or more files.

### 4. Manually trigger the IMAP poll on externo

```bash
docker exec nextjs-jurisprudencia-clitools_externo-1 \
  curl -sf -X POST "http://server_externo:3000${NEXT_BASE_PATH}/api/gestao/email-sync"
```

Should return `{"ok":true,"processed":1,"errors":0}`.

The clitools cron also polls automatically every minute.

---

## Troubleshooting

### Build fails with TypeScript errors

Dev mode (`next dev`) skips type checking. Run before building to catch errors early:
```bash
npx tsc --noEmit
```

### Volume not mounted in server_dev

Docker may not pick up volume changes without a force-recreate:
```bash
docker compose --profile dev up -d --force-recreate server_dev
```

### Email delivered to mbox instead of Maildir (IMAP sees 0 messages)

Symptom: `/var/mail/sync` file exists but `/var/mail/mail.juris.internal/sync/new/` is empty.

Cause: `mail.juris.internal` is in both `mydestination` and `virtual_mailbox_domains`. Postfix routes to local mbox instead of virtual Maildir.

Fix: Ensure the mailserver has these environment variables set in docker-compose:
```yaml
- POSTFIX_MYDESTINATION=localhost
- ENABLE_SUBMISSION=1
```
And the hostname is set to something other than the mail domain:
```yaml
hostname: mailserver.juris.internal
```
Then recreate:
```bash
docker compose --profile externo up -d --force-recreate mailserver
docker exec nextjs-jurisprudencia-mailserver-1 setup email del sync@mail.juris.internal
docker exec nextjs-jurisprudencia-mailserver-1 setup email add sync@mail.juris.internal <password>
```

### SMTP connection refused from interno

1. Confirm nginx is listening: `ss -tlnp | grep 587` on the nginx machine
2. Confirm the externo machine's mailserver port 587 is reachable from nginx: `nc -zv <externo-internal-ip> 587`
3. Confirm the NAT rule exists if behind a router: `iptables -t nat -L PREROUTING -n | grep 587`
4. `SYNC_SMTP_HOST` must be a plain hostname/IP — never a URL with `https://`

### Mailserver account already exists error

```bash
docker exec nextjs-jurisprudencia-mailserver-1 setup email del sync@mail.juris.internal
docker exec nextjs-jurisprudencia-mailserver-1 setup email add sync@mail.juris.internal <password>
```

### View mailserver logs

```bash
docker exec nextjs-jurisprudencia-mailserver-1 tail -50 /var/log/mail/mail.log
```

### List mailserver accounts

```bash
docker exec nextjs-jurisprudencia-mailserver-1 setup email list
```
