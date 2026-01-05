FROM node:20.11-bookworm-slim

RUN apt update && apt install -y pandoc texlive-xetex

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --verbose

COPY . .

ARG NEXT_PUBLIC_ANONIMIZADOR_URL

ENV NEXT_PUBLIC_ANONIMIZADOR_URL=${NEXT_PUBLIC_ANONIMIZADOR_URL}

ARG NEXT_BASE_PATH

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
