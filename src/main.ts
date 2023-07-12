import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, Client } from '@nestjs/microservices';

import { OnModuleInit } from '@nestjs/common';
import * as dotenv from 'dotenv';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice({
    transport: Transport.REDIS,
    options: {
      host: 'localhost',
      port: 6379,
    },
  })
  
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://guest:guest@localhost:5672/brainlife'],
      queue: 'queue-name',
      queueOptions: { durable: false },
    },
  })
  
  dotenv.config();

  await app.startAllMicroservices();
  await app.listen(9000);
}

bootstrap().then().catch(err => console.error(err));



