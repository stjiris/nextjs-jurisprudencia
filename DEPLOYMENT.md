# Deployment

Two machines: **externo** (public) and **interno** (internal editing).

## Requirements (both machines)

- Docker + Docker Compose v2
- This repo cloned

---

## Externo

**1. Create `.env`**

```env
NEXT_BASE_PATH=/jurisprudencia
SERVER_HOST=0.0.0.0
SERVER_PORT=80
PUBLIC_STATES="público"
ES_JAVA_OPTS="-Xms4g -Xmx4g"
RSS_LINK="https://<your-domain>/jurisprudencia"

SYNC_ROLE=externo
SYNC_SECRET=<shared-secret>
SYNC_IMAP_HOST=mailserver
SYNC_IMAP_PORT=143
SYNC_IMAP_SECURE=false
SYNC_IMAP_USER=sync@mail.juris.internal
SYNC_IMAP_PASS=<mailserver-password>
SYNC_IMAP_TRUSTED_FROM=sync@mail.juris.internal
```

**2. Start**

```bash
docker compose --profile externo up -d --build
```

**3. Create the mailserver account** (do this quickly — mailserver shuts down after 120s without an account)

```bash
docker exec nextjs-jurisprudencia-mailserver-1 setup email add sync@mail.juris.internal <mailserver-password>
```

---

## Interno

**1. Create `.env`**

```env
NEXT_BASE_PATH=/dev-jurisprudencia
SERVER_HOST=0.0.0.0
SERVER_PORT=80
PUBLIC_STATES=público
ES_JAVA_OPTS="-Xms4g -Xmx4g"
ANONIMIZADOR_URL=https://<your-domain>/dev-jurisprudencia-anonimizador/
ANONIMIZADOR_SECRET=<anonimizador-secret>

SYNC_ROLE=interno
SYNC_SECRET=<shared-secret>
SYNC_SMTP_HOST=<externo-public-hostname-or-ip>
SYNC_SMTP_PORT=587
SYNC_SMTP_SECURE=false
SYNC_SMTP_USER=sync@mail.juris.internal
SYNC_SMTP_PASS=<mailserver-password>
SYNC_SMTP_FROM=sync@mail.juris.internal
SYNC_SMTP_TO=sync@mail.juris.internal
```

> `SYNC_SECRET` must be the same on both machines.  
> `SYNC_SMTP_PASS` must match the password used in externo step 3.  
> `SYNC_SMTP_HOST` is a plain hostname or IP — no `https://`.

Also add the SharePoint credentials to `.env` (needed by clitools to pull documents):

```env
TENANT_ID=<azure-tenant-id>
CLIENT_ID=<azure-client-id>
CLIENT_SECRET=<azure-client-secret>
SITE_ID=<sharepoint-site-id>
DRIVES='["Anonimização"]'
```

**2. Start**

```bash
docker compose --profile interno up -d --build
```

---

## Network: expose port 587 to the internet

The interno machine sends emails to the externo mailserver on port 587. This port needs to be reachable from the internet.

**On the nginx proxy machine** — add a TCP stream block to `/etc/nginx/nginx.conf` outside the `http {}` block:

```nginx
stream {
    server {
        listen 587;
        proxy_pass <externo-internal-ip>:587;
    }
}
```

```bash
nginx -t && nginx -s reload
```

**If the public IP belongs to a router/Proxmox host** (not the nginx machine directly), add a NAT rule on that host:

```bash
iptables -t nat -A PREROUTING -p tcp --dport 587 -j DNAT --to-destination <nginx-internal-ip>:587
iptables -A FORWARD -p tcp -d <nginx-internal-ip> --dport 587 -j ACCEPT
apt install iptables-persistent -y && netfilter-persistent save
```

---

## Verify it works

**From interno**, check port 587 is reachable:
```bash
nc -zv <externo-public-hostname> 587
# expected: Connection succeeded
```

**Publish a document** on interno. Within ~10 seconds it should appear as public on externo.

Check externo sync logs:
```bash
docker logs nextjs-jurisprudencia-email_sync-1 --tail 20
docker logs nextjs-jurisprudencia-server_externo-1 2>&1 | grep email-sync | tail 10
```

---

## Useful commands

```bash
# Mailserver: list accounts
docker exec nextjs-jurisprudencia-mailserver-1 setup email list

# Mailserver: delete account
docker exec nextjs-jurisprudencia-mailserver-1 setup email del sync@mail.juris.internal

# Mailserver: check mail log
docker exec nextjs-jurisprudencia-mailserver-1 tail -50 /var/log/mail/mail.log

# Force recreate a container (picks up volume/env changes)
docker compose --profile externo up -d --force-recreate <service>

# Check TypeScript errors before building
npx tsc --noEmit
```
