#!/bin/sh
printenv | grep -v "no_proxy" >> /etc/environment

chown clitools:clitools /rss

cron -f -L 15