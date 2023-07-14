import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UserModule } from './users/user.module';

import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot('mongodb://localhost:27017', { dbName: 'test' }), // temporary connection string
    UserModule,
    ClientsModule.register([
      {
        name: 'REDIS_SERVICE',
        transport: Transport.REDIS,
        options: {
          host: 'localhost',
          port: 6379,
        },
      },
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@localhost:5672/brainlife?heartbeat=30'],
          queue: 'user-messages',
          queueOptions: {
            durable: false,
          },
        },
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
