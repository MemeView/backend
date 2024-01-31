import { Module } from '@nestjs/common';
import { HoldersController } from './holders.controller';
import { HoldersService } from './holders.service';
import { GraphqlService } from 'src/graphql/graphql.service';
import { SolveScoreService } from '../solve-score-sync/solve-score.service';

@Module({
  controllers: [HoldersController],
  providers: [HoldersService, GraphqlService, SolveScoreService],
})
export class HoldersModule {}
