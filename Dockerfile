FROM node:16

# RUN apt-get update && apt install openssl
RUN npm install -g pm2

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install

COPY . /app

CMD [ "pm2", "start", "./api/auth.js" ]
