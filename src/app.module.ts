import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { QuotesModule } from './quotes/quotes.module';
import { DocumentsModule } from './documents/documents.module';
import { MessagingModule } from './messaging/messaging.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PlatformSettingsModule } from './platform-settings/platform-settings.module';
import { P2pShippingModule } from './p2p-shipping/p2p-shipping.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'), // Note: .env has DB_USERNAME
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        migrationsRun: true,
      synchronize: false,
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    NotificationsModule,
    AuthModule,
    FilesModule,
    ShipmentsModule,
    QuotesModule,
    DocumentsModule,
    MessagingModule,
    PaymentsModule,
    ReviewsModule,
    PlatformSettingsModule,
    P2pShippingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
