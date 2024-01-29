import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { VolumeService } from './volume-sync/volume.service';
import { SolveScoreService } from './solve-score-sync/solve-score.service';
import { PrismaClient } from '@prisma/client';
import { PostingService } from './posting/posting.service';
import * as process from 'process';
import { HoldersService } from './holders/holders.service';
import { startOfHour } from 'date-fns';

@Injectable()
export class CronService {
  private readonly RETRY_DELAY_MS = 3000; // задержка перед попыткой повторного выполнения
  private readonly MAX_RETRIES = 3; // максимальное число попыток

  constructor(
    private readonly definedTokensService: DefinedTokensService,
    private readonly volumeService: VolumeService,
    private readonly solveScoreService: SolveScoreService,
    private readonly postingService: PostingService,
    private readonly holdersService: HoldersService,
    private prisma: PrismaClient,
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

  @Cron('0 * * * *', { disabled: process.env.NODE_ENV === 'development' }) // начало каждого часа
  async tokensCron() {
    const now = new Date();
    const currentHour = now.getHours();
    const startOfCurrentHour = startOfHour(now);

    await this.handleRetry(async () => {
      let totalDeletedCount = 0;
      let totalAddedCount = 0;

      for (let i = 1; i <= 6; i++) {
        try {
          const { deletedCount, addedCount } =
            await this.definedTokensService.handleTokens(i);

          totalDeletedCount += deletedCount;
          totalAddedCount += addedCount;

          console.log(
            `Cron job completed: ${totalDeletedCount} tokens deleted, ${totalAddedCount} tokens added.`,
          );
        } catch (e) {
          break;
        }
      }
    });

    await this.handleRetry(async () => {
      await this.prisma.holders.deleteMany({
        where: {
          createdAt: { gte: startOfCurrentHour },
        },
      });

      await this.holdersService.handleHolders();

      console.log(`handleHolders job completed'`);
    });

    await this.handleRetry(async () => {
      await this.volumeService.handleVolumeData();
      console.log(`Cron 'volume-sync' job completed`);
    });

    if (currentHour === 0) {
      await this.prisma.scoreByHours.deleteMany();
    }

    await this.handleRetry(async () => {
      await this.solveScoreService.solveScores();

      console.log(`solveScoreService job completed'`);
    });

    await this.handleRetry(async () => {
      const { deletedCount, addedCount } =
        await this.holdersService.handleHoldersScore();

      console.log('deletedCount', deletedCount);
      console.log('addedCount', addedCount);

      console.log(`handleHoldersScore job completed'`);
    });

    if (currentHour === 23) {
      await this.handleRetry(async () => {
        await this.solveScoreService.updateDailyScores();
        console.log(`Cron 'average-score' job completed`);
      });
    }

    await this.handleRetry(async () => {
      await this.postingService.handleCombinedPosting();
      console.log(`Cron 'posting' job completed`);
    });
  }

  async volumeCron() {
    await this.handleRetry(async () => {
      await this.volumeService.handleVolumeData();
      console.log(`Cron 'volume-sync' job completed`);
    });
  }

  @Cron('35 * * * *', { disabled: process.env.NODE_ENV === 'development' })
  async solveScoresCron() {
    await this.handleRetry(async () => {
      await this.solveScoreService.solveScores();
      console.log(`solveScoresCron job completed`);
    });
  }
}
