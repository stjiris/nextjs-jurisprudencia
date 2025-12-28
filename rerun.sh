#!/bin/bash
set -e

CLITOOLS="nextjs-jurisprudencia-clitools-1"
ELASTIC="nextjs-jurisprudencia-elasticsearch-1"
ELASTIC_VOL="nextjs-jurisprudencia_elasticsearch_data"

docker compose rm -sf elasticsearch || true
docker compose rm -sf clitools || true
docker compose rm -sf server || true

#docker rm -f nextjs-jurisprudencia-clitools-1 2>/dev/null || true

#IMG=$(docker compose images -q clitools)
#[ -n "$IMG" ] && docker rmi -f "$IMG" || true

#docker compose build --no-cache clitools
#docker compose build --no-cache server

#docker volume rm -f $ELASTIC_VOL || true
docker compose up -d elasticsearch
docker compose up -d clitools
docker compose up -d server

#docker exec -it nextjs-jurisprudencia-clitools-1 git -C /home/clitools/jurisprudencia-etl rev-parse --short HEAD


docker exec -it nextjs-jurisprudencia-clitools-1 bash -c "cd /home/clitools/version-converter/ && npm install && npm run build && cd /home/clitools/version-converter/dist && node create.js jurisprudencia.13.0 && cd ../../jurisprudencia-privada-etl/ && npm install && npm start"
