FROM node:16

# RUN apt-get update && apt install openssl
RUN npm install -g pm2

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install

COPY . /app

HEALTHCHECK CMD curl --fail http://localhost:8080/health || exit 1

CMD [ "pm2-runtime", "start", "./api/auth.js" ]
