FROM node:4

COPY . /app

RUN cd /app && npm install --production

EXPOSE 80

CMD node /app/api/auth.js

