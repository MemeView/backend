import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';

import { DefinedTokensModule } from './cron/defined-tokens/defined-tokens.module';
import { CronModule } from './cron/cron.module';
import { VolumeModule } from './cron/volume-sync/volume.module';
import { SolveScoreModule } from './cron/solve-score-sync/solve-score.module';
import { GraphqlModule } from './graphql/graphql.module';
import { BlackListModule } from './black-list/black-list.module';
import { ExcelModule } from './excel/excel.module';
import { PostingModule } from './cron/posting/posting.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env'],
    }),
    GraphqlModule,
    CronModule,
    DefinedTokensModule,
    SolveScoreModule,
    VolumeModule,
    BlackListModule,
    ExcelModule,
    PostingModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
