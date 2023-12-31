import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { CronService } from './cron.service';
import { VolumeService } from './volume-sync/volume.service';
import { PrismaModule } from 'prisma/prisma.module';
import { SolveScoreService } from './solve-score-sync/solve-score.service';
import { PostingService } from './posting/posting.service';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [
    DefinedTokensService,
    VolumeService,
    SolveScoreService,
    CronService,
    PostingService,
  ],
})
export class CronModule {}
