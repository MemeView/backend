import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { VolumeService } from './volume-sync/volume.service';
import { SolveScoreService } from './solve-score-sync/solve-score.service';

@Injectable()
export class CronService {
  private readonly RETRY_DELAY_MS = 3000; // задержка перед попыткой повторного выполнения
  private readonly MAX_RETRIES = 3; // максимальное число попыток

  constructor(
    private readonly definedTokensService: DefinedTokensService,
    private readonly volumeService: VolumeService,
    private readonly solveScoreService: SolveScoreService,
  ) {}

  private async handleRetry(
    method: () => Promise<void>,
    retries: number = this.MAX_RETRIES,
  ) {
    try {
      await method();
    } catch (error) {
      if (retries > 0) {
        console.error(
          `Попытка выполнения не удалась, осталось попыток: ${retries}. Ошибка:`,
          error,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.RETRY_DELAY_MS),
        );
        await this.handleRetry(method, retries - 1);
      } else {
        console.error(
          'Достигнуто максимальное число попыток выполнения задачи.',
          error,
        );
      }
    }
  }

  @Cron('0 * * * *') // начало каждого часа
  async tokensCron() {
    await this.handleRetry(async () => {
      let totalDeletedCount = 0;
      let totalAddedCount = 0;

      for (let i = 1; i <= 6; i++) {
        const { deletedCount, addedCount } =
          await this.definedTokensService.handleTokens(i);
        totalDeletedCount += deletedCount;
        totalAddedCount += addedCount;
      }

      console.log(
        `Cron job completed: ${totalDeletedCount} tokens deleted, ${totalAddedCount} tokens added.`,
      );
    });

    await this.handleRetry(async () => {
      await this.solveScoreService.solveScores();

      console.log(`solveScoreService job completed'`);
    });

    await this.handleRetry(async () => {
      const currentHour = new Date().getHours();

      if (currentHour === 0) {
        await this.volumeService.handleVolumeData();
        console.log(`Cron 'volume-sync' job completed`);
      }
    });
  }

  async volumeCron() {
    await this.handleRetry(async () => {
      await this.volumeService.handleVolumeData();
      console.log(`Cron 'volume-sync' job completed`);
    });
  }

  async solveScoresCron() {
    await this.handleRetry(async () => {
      await this.solveScoreService.solveScores();
      console.log(`solveScoresCron job completed`);
    });
  }
}
