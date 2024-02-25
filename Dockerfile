FROM node:20.11-bookworm-slim

RUN apt update && apt install -y pandoc texlive-xetex

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

ARG NEXT_BASE_PATH

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
