import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { VolumeService } from './volume-sync/volume.service';
import { SolveScoreService } from './solve-score-sync/solve-score.service';

@Injectable()
export class CronService {
  constructor(
    private readonly definedTokensService: DefinedTokensService,
    private readonly volumeService: VolumeService,
    private readonly solveScoreService: SolveScoreService,
  ) {}

  @Cron('0 * * * *') // начало каждого часа
  async tokensCron() {
    // defined-tokens-sync
    try {
      const { deletedCount, addedCount } =
        await this.definedTokensService.handleTokens();
      console.log(
        `Cron job completed: ${deletedCount} tokens deleted, ${addedCount} tokens added.`,
      );

      await this.solveScoresCron();
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  }

  @Cron('2 0 * * *')
  async volumeCron() {
    try {
      await this.volumeService.handleVolumeData();
      console.log(`Cron 'volume-sync' job completed`);
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  }

  async solveScoresCron() {
    try {
      await this.solveScoreService.solveScores();
      console.log(`solveScoresCron job completed`);
    } catch (error) {
      console.error('solveScoresCron job failed:', error);
    }
  }
}
