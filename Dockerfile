FROM node:18-alpine

RUN apk add curl

WORKDIR /app
COPY package.json ./
COPY . .
RUN npm install

CMD ["sh", "-c", "npm install && npm run start:dev"]

# FROM node:18-alpine AS prod-stage
# WORKDIR /app
# COPY package.json ./
# RUN npm install
# COPY . .
# RUN npm run build

# CMD ["npm", "run", "start:prod"]