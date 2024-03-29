FROM node:16

WORKDIR /ui
COPY package.json /ui
COPY package-lock.json /ui
RUN npm install

RUN npm install -g lite-server
CMD [ "lite-server" ]
