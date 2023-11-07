#!/bin/sh
printenv | grep -v "no_proxy" >> /etc/environment

cron -f -L 15