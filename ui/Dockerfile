FROM node:16 as builder

COPY package.json .
COPY package-lock.json .
COPY . /ui

WORKDIR /ui
RUN npm install

FROM node:16

RUN npm install -g sirv-cli

CMD ["sirv", "--host", "--port", "80"]
EXPOSE 80

RUN ls -la

