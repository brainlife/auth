FROM node:16
MAINTAINER Soichi Hayashi <hayashis@iu.edu>

COPY . /ui
WORKDIR /ui

RUN npm install -g sirv-cli

EXPOSE 80

CMD [ "sirv", "--host", "--port", "80" ]


