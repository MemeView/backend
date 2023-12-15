import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'graphql-import-node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
