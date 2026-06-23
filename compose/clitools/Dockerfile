FROM node:20.10-bookworm-slim

RUN apt update && apt install vim cron git -y

RUN useradd -m clitools

RUN passwd -d clitools

RUN mkdir -p /etc/cron.d/ && touch /etc/cron.d/cron.allow && echo "root\nclitools" > /etc/cron.d/cron.allow

USER clitools

WORKDIR /home/clitools

# util to convert between versions
RUN git clone https://github.com/stjiris/version-converter && cd version-converter && npm install && npm run build

# no build needed here
RUN git clone https://github.com/stjiris/backup-jurisprudencia && cd backup-jurisprudencia && npm install
#   At 10:00 on Sunday.
RUN (crontab -l; echo "0 10 * * 0 cd /home/clitools/backup-jurisprudencia && /usr/local/bin/node cli backup jurisprudencia.12.0,users.0.0,keys-info.0.0 >> ../backup-jurisprudencia.full.stdout.log 2>> ../backup-jurisprudencia.full.stderr.log") | crontab -

# update rss feed
RUN git clone https://github.com/stjiris/jurisprudencia-rss.git && cd jurisprudencia-rss && npm install && npm run build
# At minute 45 past every 3rd hour from 9 through 18 on every day-of-week from Monday through Friday.
RUN (crontab -l; echo "45 9-18/3 * * 1-5 cd /home/clitools/jurisprudencia-rss && /usr/local/bin/node dist >> ../jurisprudencia-rss.stdout.log 2>> ../jurisprudencia-rss.stderr.log") | crontab -


COPY entrypoint.sh .

USER root

ENTRYPOINT ["./entrypoint.sh"]
