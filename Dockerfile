FROM node:4

COPY . /app

RUN cd /app && npm install --production

WORKDIR /app

CMD [ "npm", "start" ]

