// queue-publisher.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RmqOptions,
  Transport,
} from '@nestjs/microservices';
import { Message } from '../schema/message';

@Injectable()
export class RabbitMQ implements OnModuleInit {
  private client: ClientProxy;

  onModuleInit() {
    const clientOptions: RmqOptions = {
      transport: Transport.RMQ,
      options: {
        // urls: ['amqp://guest:guest@localhost:5672/brainlife?heartbeat=30'],
        urls: ['amqp://guest:guest@brainlife_rabbitmq:5672/brainlife?heartbeat=30'],
        queue: 'user-messages',
        queueOptions: {
          durable: false,
        },
      },
    };

    this.client = ClientProxyFactory.create(clientOptions);
    this.client.connect().catch(console.error);
  }

  public async publishToQueue(key: string, message: string): Promise<void> {
    this.client.emit<any>(key, new Message(message)).subscribe({
      next: () => console.log(key, message),
      error: (err) => console.error(err),
    });
  }
}
