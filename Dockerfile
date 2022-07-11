FROM node:16

COPY . /apps/auth
WORKDIR /apps/auth/api
RUN npm install
