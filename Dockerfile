FROM node:4

COPY . /app
WORKDIR /app

RUN npm install --production
CMD [ "npm", "start" ]

