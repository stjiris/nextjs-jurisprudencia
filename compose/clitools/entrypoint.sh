#!/bin/sh
printenv | grep -v "no_proxy" >> /etc/environment

chown clitools:clitools /rss

# The ETL writes its results into a Docker named volume, which mounts owned by
# root by default — make it writable by the clitools user the cron jobs run as.
# Guarded so it's a no-op on deployments without the ETL (e.g. externo).
ETL_DIR=/home/clitools/jurisprudencia-privada-etl
if [ -d "$ETL_DIR" ]; then
    mkdir -p "$ETL_DIR/results"
    chown -R clitools:clitools "$ETL_DIR/results"
fi

cron -f -L 15