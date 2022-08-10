FROM node:16
MAINTAINER Soichi Hayashi <hayashis@iu.edu>

COPY . /ui
WORKDIR /ui

RUN npm install -g sirv-cli

EXPOSE 8080

CMD [ "sirv", "--host", "--port", "8080" ]

