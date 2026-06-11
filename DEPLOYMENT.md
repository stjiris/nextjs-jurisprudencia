# Deployment

## Architecture Overview

The system has two main repositories that work together:

- **`nextjs-jurisprudencia`** — the Juris platform itself, deployed in two distinct instances:
  - **Externo** — public-facing, read-only search interface hosted on an external server (OVH). Only documents with `STATE=público` are visible.
  - **Interno** — internal editing platform running on a VM inside the court's intranet. Editors annotate, edit, and anonymize documents here, and publish them to externo via email sync.

- **`anonimizador_dev`** — standalone anonymization tool, also running on an internal VM. Interno hands documents off to it (with pre-computed NLP entities), the editor anonymizes them in the browser, and the result is pushed back to interno. The anonimizador runs a companion `nlp_server` (Python/spaCy) for named entity recognition.

Externo and interno synchronize through an **email-based push**: interno sends published documents to an SMTP server on externo's machine; externo's `email_sync` service polls and ingests them continuously. Interno also pulls new documents from SharePoint via `clitools_interno`.

---

## Juris (nextjs-jurisprudencia)

### Requirements

- Docker + Docker Compose v2
- This repo cloned

---

### Externo

**1. Create `.env`** (use the provided template)

**2. Start**

```bash
docker compose --profile externo up -d --build
```

**3. Create the mailserver account** (do this quickly — mailserver shuts down after 120s without an account)

```bash
docker exec nextjs-jurisprudencia-mailserver-1 setup email add sync@mail.juris.internal <mailserver-password>
```

---

### Interno

**1. Create `.env`** (use the provided template)

**2. Start**

```bash
docker compose --profile interno up -d --build
```

---

### Starting from backup

On a production machine, export a backup first:

```bash
docker compose exec -it clitools_interno bash
cd backup-jurisprudencia
node cli backup jurisprudencia.12.0,users.0.0,keys-info.0.0
```

Copy the backup file to the target machine, then restore:

```bash
docker compose cp <backup_file> clitools_interno:/home/clitools/backup-jurisprudencia/
docker compose exec -it clitools_interno bash
cd backup-jurisprudencia && npm install
node cli restore <backup_file>
```

If a schema version conversion is needed:

```bash
cd ../version-converter/dist
node create.js jurisprudencia.13.0
node convert.js 12to13
```

---

### From scratch (fresh ETL)

```bash
docker compose exec -it clitools_interno bash
cd version-converter/dist
node create.js jurisprudencia.13.0
cd ../../jurisprudencia-privada-etl
npm run run_dgsi
```

---

### Network: expose port 587 to the internet

Interno sends emails to externo's mailserver on port 587. This port must be reachable from the internet.

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

**If the public IP belongs to a router/Proxmox host** (not the nginx machine directly), add a NAT rule:

```bash
iptables -t nat -A PREROUTING -p tcp --dport 587 -j DNAT --to-destination <nginx-internal-ip>:587
iptables -A FORWARD -p tcp -d <nginx-internal-ip> --dport 587 -j ACCEPT
apt install iptables-persistent -y && netfilter-persistent save
```

---

### Verify sync

Check port 587 is reachable from interno:

```bash
nc -zv <externo-public-hostname> 587
# expected: Connection succeeded
```

Publish a document on interno — it should appear on externo within ~10 seconds. Check externo sync logs:

```bash
docker logs nextjs-jurisprudencia-email_sync-1 --tail 20
docker logs nextjs-jurisprudencia-server_externo-1 2>&1 | grep email-sync | tail 10
```

---

## Anonimizador

The anonimizador runs independently of juris on its own VM. Interno reaches it at `ANONIMIZADOR_URL`; the anonimizador calls back to interno at `NEXT_PUBLIC_JURIS_URL`. Both must share the same `ANONIMIZADOR_SECRET`.

### Requirements

- Docker + Docker Compose v2
- Git LFS installed on the machine (`apt install git-lfs && git lfs install`)
- This repo cloned: `anonimizador_dev`

### Setup

**1. Clone the NLP model storage** (required before first build — the `deploy.sh` handles this automatically):

```bash
git clone https://gitlab.com/diogoalmiro/iris-lfs-storage.git
cd iris-lfs-storage && git lfs pull && cd ..
```

**2. Create `.env`** (use the provided template)

**3. Deploy**

```bash
bash deploy.sh
```

This builds the `anonimizador` and `nlp_server` services and starts them with `--force-recreate`. On Windows use `deploy.cmd` instead.

The `nlp_server` container loads the spaCy NLP model from `iris-lfs-storage/model-best`. On first build this may take a few minutes.

