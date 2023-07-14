import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Inject } from '@nestjs/common';
import { Message } from './schema/message';
import { ClientProxy } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
  ) {}

  async onApplicationBootstrap() {
    // await this.client.connect();
  }

  @Get()
  getHello() {
    this.client.emit<any>(
      'message_printed',
      new Message('AUTH TS in App Controller - Hello World'),
    );
    return 'Hello World printed by auth-ts';
  }
}
