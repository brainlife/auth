FROM node:16

RUN apt-get update && apt install openssl

COPY . /app

RUN npm install -g pm2

ENTRYPOINT [ "/app/run.sh" ]
