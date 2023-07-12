import { Injectable,Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class AppService {

  // constructor(@Inject('RABBIMTQ_SERVICE') private readonly client: ClientProxy) {}
  
  // publishToQueue(key: string, message: String) {
  //   return this.client.send(key, message);
  // }


  getHello(): string {
    return 'Hello World!';
  }
}
