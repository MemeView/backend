import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DefinedTokensService } from '../defined-tokens/defined-tokens.service';
import { CronService } from './cron.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [DefinedTokensService, CronService],
})
export class CronModule {}
