import { Module } from "@nestjs/common";
import { AppController } from "../app.controller";
import { AppService } from "../app.service";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { UserSchema } from "../schema/user.schema";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forFeature([{ 
            name: 'User', schema: UserSchema 
        }])],
    controllers: [AppController, UserController],
    providers: [AppService, UserService]
})

export class UserModule {}