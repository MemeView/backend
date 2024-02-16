import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'graphql-import-node';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as process from 'process';

const httpsOptions = {
  key: fs.readFileSync('./secrets/key.pem'),
  cert: fs.readFileSync('./secrets/cert.pem'),
};

const isDev = process.env.NODE_ENV === 'development';


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    ...(isDev ? {httpsOptions} : {})
  });

  app.use(cookieParser());

  app.enableCors({
    origin: true,
    credentials: true,
    preflightContinue: false,
    methods: ['GET', 'POST', 'PUT', 'HEAD', 'PATCH', 'DELETE'],
  });
  await app.listen(3000);
}

bootstrap();
