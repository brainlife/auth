FROM node:4

COPY . /app

RUN cd /app && npm install --production

EXPOSE 8080
CMD [ "npm", "start" ]

