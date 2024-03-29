FROM node:16

#TODO do we still need this?
RUN apt-get update && apt install openssl
RUN npm install -g pm2

WORKDIR /app
COPY package.json /app
COPY package-lock.json /app
RUN npm install

COPY . /app

ENTRYPOINT [ "/app/run.sh" ]
