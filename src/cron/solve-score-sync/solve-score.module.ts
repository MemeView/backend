import { Module } from '@nestjs/common';
import { SolveScoreController } from './solve-score.controller';
import { SolveScoreService } from './solve-score.service';

@Module({
  controllers: [SolveScoreController],
  providers: [SolveScoreService],
})
export class SolveScoreModule {}
