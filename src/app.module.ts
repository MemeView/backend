import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DefinedTokensModule } from './defined-tokens/defined-tokens.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [CronModule, DefinedTokensModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
