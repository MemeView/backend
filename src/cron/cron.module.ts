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
import { HoldersService } from './holders/holders.service';
import { VotesModule } from './votes-sync/votes.module';
import { GraphqlService } from 'src/graphql/graphql.service';
import { VotesService } from './votes-sync/votes.service';
import { PrivateBotModule } from './private-bot/private-bot.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, HoldersModule, VotesModule, PrivateBotModule],
  providers: [
    DefinedTokensService,
    VolumeService,
    SolveScoreService,
    CronService,
    GraphqlService,
    HoldersService,
    PostingService,
    VotesService,
  ],
  controllers: [CronController],
})
export class CronModule {}
