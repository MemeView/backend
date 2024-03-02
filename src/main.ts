import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'graphql-import-node';
import * as cookieParser from 'cookie-parser';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'https://localhost:3003',
      'http://localhost:8004',
      'https://twa.tokenwatch.ai',
      'https://tw-telegram-mini-app.ngrok.app',
      'https://tokenwatch.ai'
    ],
    credentials: true,
    preflightContinue: false,
    methods: ['GET', 'POST', 'PUT', 'HEAD', 'PATCH', 'DELETE'],
  });
  await app.listen(3000);
}

bootstrap();
