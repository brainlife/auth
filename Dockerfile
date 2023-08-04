FROM node:18-alpine AS dev-stage
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn install
COPY . .

CMD ["sh", "-c", "yarn install && yarn run start:dev"]

FROM node:18-alpine AS prod-stage
WORKDIR /usr/src/app
COPY package.json yarn.lock ./
RUN yarn install
RUN yarn run build
COPY . .

CMD ["yarn", "run", "start:prod"]