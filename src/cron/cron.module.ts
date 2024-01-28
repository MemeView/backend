import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { CronService } from './cron.service';
import { VolumeService } from './volume-sync/volume.service';
import { PrismaModule } from 'prisma/prisma.module';
import { SolveScoreService } from './solve-score-sync/solve-score.service';
import { PostingService } from './posting/posting.service';
import { HoldersModule } from './holders/holders.module';
import { CronController } from './cron.controller';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, HoldersModule],
  providers: [
    DefinedTokensService,
    VolumeService,
    SolveScoreService,
    CronService,
    PostingService,
  ],
  controllers: [CronController],
})
export class CronModule {}
