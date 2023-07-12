import { Body, Controller, Post } from "@nestjs/common";


@Controller('/')
export class SignupController {
    @Post('signup')
    async create(@Body() {email, password} ) {
        return {"email": email, "password": password, "message": "Signup successful"};
    }
}