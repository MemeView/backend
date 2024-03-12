import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DefinedTokensService } from './defined-tokens/defined-tokens.service';
import { VolumeService } from './volume-sync/volume.service';
import { SolveScoreService } from './solve-score-sync/solve-score.service';
import { PrismaClient } from '@prisma/client';
import { PostingService } from './posting/posting.service';
import * as process from 'process';
import { HoldersService } from './holders/holders.service';
import { startOfHour, subHours } from 'date-fns';
import { VotesService } from './votes-sync/votes.service';
import { UTCDate } from '@date-fns/utc';
import { AuthService } from 'src/auth/auth.service';
import { SignalBotService } from './signal-bot/signal-bot.service';
import { TtmsPortfolioService } from './ttms-portfolio/ttms-portfolio.service';
import { AirdropsService } from './airdrops/airdrops.service';

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
    private readonly votesService: VotesService,
    private readonly authService: AuthService,
    private readonly signalBotService: SignalBotService,
    private readonly ttmsPortfolioService: TtmsPortfolioService,
    private readonly airdropsService: AirdropsService,
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
    const utcDate = new UTCDate();
    const pstDate = subHours(utcDate, 7);
    const currentHour = utcDate.getUTCHours();
    const currentPstHour = pstDate.getUTCHours();

    await this.handleRetry(async () => {
      let totalDeletedCount = 0;
      let totalAddedCount = 0;

      // ищем токены на networkId = 1
      for (let i = 1; i <= 6; i++) {
        try {
          const networkId = 1;
          const { deletedCount, addedCount } =
            await this.definedTokensService.handleTokens(i, networkId);

          totalDeletedCount += deletedCount;
          totalAddedCount += addedCount;

          console.log(
            `Cron job completed: ${totalDeletedCount} tokens deleted, ${totalAddedCount} tokens added on network ${networkId}`,
          );
        } catch (e) {
          break;
        }
      }

      // ищем токены на networkId = 56
      for (let i = 1; i <= 6; i++) {
        try {
          const networkId = 56;
          const { deletedCount, addedCount } =
            await this.definedTokensService.handleTokens(i, networkId);

          totalDeletedCount += deletedCount;
          totalAddedCount += addedCount;

          console.log(
            `Cron job completed: ${totalAddedCount} tokens added on both networks`,
          );
        } catch (e) {
          break;
        }
      }
    });

    await this.definedTokensService.handleTokenWatch();

    await this.handleRetry(async () => {
      if (currentHour === 0) {
        await this.holdersService.handleHolders(0);
      }
      if (currentHour !== 0) {
        await this.holdersService.handleHolders(currentHour);
      }

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

    if (currentPstHour === 3) {
      await this.solveScoreService.solveTtmsByHours('3am');
      console.log(`Current ttms has beet copied to the column 3am`);
      const sendedMessagesCount =
        await this.signalBotService.sendMessageToAllUsers();
      console.log(`sendedMessagesCount = ${sendedMessagesCount}`);
    }

    if (currentPstHour === 9) {
      await this.solveScoreService.solveTtmsByHours('9am');
      console.log(`Current ttms has beet copied to the column 9am`);
      const sendedMessagesCount =
        await this.signalBotService.sendMessageToAllUsers();
      console.log(`sendedMessagesCount = ${sendedMessagesCount}`);
    }

    if (currentPstHour === 15) {
      await this.solveScoreService.solveTtmsByHours('3pm');
      console.log(`Current ttms has beet copied to the column 3pm`);
      const sendedMessagesCount =
        await this.signalBotService.sendMessageToAllUsers();
      console.log(`sendedMessagesCount = ${sendedMessagesCount}`);
    }

    if (currentPstHour === 21) {
      await this.solveScoreService.solveTtmsByHours('9pm');
      console.log(`Current ttms has beet copied to the column 9pm`);
      const sendedMessagesCount =
        await this.signalBotService.sendMessageToAllUsers();
      console.log(`sendedMessagesCount = ${sendedMessagesCount}`);
    }
    await this.ttmsPortfolioService.handleTtmsPortfolio(currentPstHour);

    await this.airdropsService.checkAirdropRequirementsCron('airdrop1');
    await this.airdropsService.checkAirdropRequirementsCron('airdrop2');
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
      const result = await this.votesService.handleAutoVoting();
      console.log(`autoVotingCron job completed with result: ${result}`);
    });

    await this.handleRetry(async () => {
      await this.solveScoreService.solveScores();
      console.log(`solveScoresCron job completed`);
    });

    await this.handleRetry(async () => {
      const { deletedCount, addedCount } =
        await this.holdersService.handleHoldersScore();

      console.log('deletedCount', deletedCount);
      console.log('addedCount', addedCount);

      console.log(`handleHoldersScore job completed'`);
    });
  }
}
