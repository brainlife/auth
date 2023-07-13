import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, Client } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
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
  });

  // app.connectMicroservice({
  //   transport: Transport.RMQ,
  //   options: {
  //     urls: ['amqp://guest:guest@localhost:5672/brainlife'],
  //     queue: 'user-messages',
  //     queueOptions: { durable: false },
  //   },
  // })

  dotenv.config();

  const config = new DocumentBuilder()
    .setTitle('AUTH API')
    .setDescription('The AUTH API description')
    .setVersion('1.0')
    .addTag('auth')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.startAllMicroservices();
  await app.listen(8000);
}

bootstrap()
  .then()
  .catch((err) => console.error(err));
