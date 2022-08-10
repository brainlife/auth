<<<<<<< HEAD
FROM node:16
MAINTAINER Soichi Hayashi <hayashis@iu.edu>

COPY . /ui
WORKDIR /ui

RUN npm install -g sirv-cli

EXPOSE 8080

CMD [ "sirv", "--host", "--port", "8080" ]
=======
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
>>>>>>> fa230ae57279adadbd9e39c8d37e9f6d2565034f

