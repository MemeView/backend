import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'graphql-import-node';
import * as cookieParser from 'cookie-parser';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: ['https://localhost:3003', 'https://twa.tokenwatch.ai', 'https://tw-telegram-mini-app.ngrok.app'],
    credentials: true,
    preflightContinue: false,
    methods: ['GET', 'POST', 'PUT', 'HEAD', 'PATCH', 'DELETE'],
  });
  await app.listen(3000);
}

bootstrap();
