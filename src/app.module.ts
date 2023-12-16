import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DefinedTokensModule } from './cron/defined-tokens/defined-tokens.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronModule } from './cron/cron.module';
import { VolumeModule } from './cron/volume-sync/volume.module';
import { SolveScoreModule } from './cron/solve-score-sync/solve-score.module';

@Module({
  imports: [CronModule, DefinedTokensModule, SolveScoreModule, VolumeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
