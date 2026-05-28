import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from './users/entities/user.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    const email = 'admin@nzubia.com';
    const password = 'Password@2025?';

    const existing = await usersService.findByEmail(email);
    if (existing) {
        console.log('Admin user already exists.');
    } else {
        const salt = await bcrypt.genSalt();
        const hash = await bcrypt.hash(password, salt);

        await usersService.create({
            email,
            password_hash: hash,
            role: UserRole.ADMIN,
            is_verified: true,
            kyc_status: 'VERIFIED' as any,
        } as any);
        console.log('Admin user created successfully.');
    }

    await app.close();
}
bootstrap();
