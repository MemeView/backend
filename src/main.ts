import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'graphql-import-node';
import { utcToZonedTime } from 'date-fns-tz';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const now = new Date();
  const zonedTime = utcToZonedTime(now, 'UTC');
  await app.listen(3000);
}
bootstrap();
