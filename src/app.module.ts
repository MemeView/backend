import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DefinedTokensModule } from './defined-tokens/defined-tokens.module';

@Module({
  imports: [DefinedTokensModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
