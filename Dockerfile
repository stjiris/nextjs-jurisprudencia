FROM node:lts

RUN apt update && apt install -y pandoc pdflatex

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
