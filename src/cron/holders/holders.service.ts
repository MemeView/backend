import { HoldersInput } from '@definedfi/sdk/dist/resources/graphql';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { startOfDay, startOfHour, subDays, subHours } from 'date-fns';
import { GraphqlService } from 'src/graphql/graphql.service';
import { holdersQuery } from 'src/graphql/holdersQuery';

type holdersScore = {
  tokenAddress: string;
  tokenScore: number;
};

type holders = {
  holders: { count: number; __typename: string };
};

@Injectable()
export class HoldersService {
  private readonly prisma: PrismaClient;
  private readonly graphqlService: GraphqlService;

  constructor() {
    this.prisma = new PrismaClient();
    this.graphqlService = new GraphqlService();
  }

  public async handleHolders() {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = subDays(startOfDay(now), 1);
    const twoDaysAgo = subDays(startOfDay(now), 2);
    const sevenDaysAgo = subDays(now, 7);
    const twentyFourHoursAgo = subHours(now, 24);
    const startOfHourOneDayAgo = startOfHour(subHours(now, 24));
    const oneWeekAgo = subHours(now, 168);

    try {
      const tokenAddresses = await this.prisma.tokens.findMany({
        select: {
          address: true,
        },
      });

      // const chunkSize = tokenAddresses.length / 200 + 1;

      const subarrays = await this.chunk(tokenAddresses, 200);

      await this.prisma.holders.deleteMany({
        where: {
          createdAt: { lt: startOfHourOneDayAgo },
        },
      });

      const allHolders = await Promise.all(
        subarrays.map(async (subarray) => {
          const holders = await this.processTokenAddresses(subarray);
          return holders;
        }),
      );

      const flattenedHolders = allHolders.flat();

      await this.prisma.holders.createMany({
        data: flattenedHolders,
      });

      return 'ok';
    } catch (error) {
      return error;
    }
  }

  public async processTokenAddresses(tokenAddresses) {
    const holders = [];

    for (const token of tokenAddresses) {
      // console.log(token.address + ':1');
      const result: holders = await this.graphqlService.makeQuery(
        holdersQuery(token.address + ':1'),
        {
          cursor: null,
          tokenId: token.address + ':1',
        },
      );

      holders.push({
        tokenAddress: token.address,
        holdersCount: result.holders.count,
      });
    }

    console.log(tokenAddresses.length);

    return holders;
  }

  public async chunk(array, size) {
    const chunkedArray = [];
    let index = 0;

    while (index < array.length) {
      chunkedArray.push(array.slice(index, index + size));
      index += size;
    }

    return chunkedArray;
  }

  public async handleHoldersScore() {
    const now = new Date();
    // начало текущего часа
    const startOfCurrentHour = startOfHour(now);
    // начало прошлого часа
    const startOfPreviousHour = startOfHour(subHours(now, 1));
    // начало часа 23 часа назад
    const startOfHourOneDayAgoPlusOneHour = startOfHour(subHours(now, 23));
    // начало часа 24 часа назад
    const startOfHourOneDayAgo = startOfHour(subHours(now, 24));
    // начало часа неделю назад минус 1 час
    const startOfPreviousWeekMinusOneHour = startOfHour(subHours(now, 167));
    // начало часа неделю назад
    const startOfPreviousWeekHour = startOfHour(subHours(now, 168));

    try {
      // Все холдеры сейчас
      const holdersNowRaw = await this.prisma.holders.findMany({
        where: {
          createdAt: { gte: startOfCurrentHour },
        },
      });

      // Все холдеры 1 час назад
      const holdersOneHourAgoRaw = await this.prisma.holders.findMany({
        where: {
          AND: [
            { createdAt: { gte: startOfPreviousHour } },
            { createdAt: { lt: startOfCurrentHour } },
          ],
        },
      });

      // Все холдеры 1 день назад
      const holdersOneDayAgoRaw = await this.prisma.holders.findMany({
        where: {
          AND: [
            { createdAt: { gte: startOfHourOneDayAgoPlusOneHour } },
            { createdAt: { lt: startOfHourOneDayAgo } },
          ],
        },
      });

      const holdersScore: { tokenAddress: string; tokenScore: number }[] = [];

      await Promise.allSettled(
        holdersNowRaw.map(async (token) => {
          let tokenScore = 0;

          // баллы за количество холдеров
          if (token.holdersCount >= 50 && token.holdersCount <= 200) {
            tokenScore += (token.holdersCount - 50) * (12 / 150);
          }

          if (token.holdersCount > 200 && token.holdersCount <= 3000) {
            tokenScore += 12;
          }

          if (token.holdersCount > 3000 && token.holdersCount <= 10000) {
            tokenScore +=
              (token.holdersCount - 3001) * ((1 - 12) / (10000 - 3001)) + 12;
          }

          if (token.holdersCount > 10000) {
            tokenScore += 1;
          }

          // находим количество холдеров для этого токена 1 час назад
          const holdersOneHourAgo = holdersOneHourAgoRaw.find(
            (holder) => holder.tokenAddress === token.tokenAddress,
          );

          // находим количество холдеров для этого токена 1 день назад
          const holdersOneDayAgo = holdersOneDayAgoRaw.find(
            (holder) => holder.tokenAddress === token.tokenAddress,
          );

          // баллы за прирост % холдеров за 1 час
          if (
            holdersOneHourAgo &&
            token.holdersCount != null &&
            holdersOneHourAgo.holdersCount != null &&
            token.holdersCount > holdersOneHourAgo.holdersCount
          ) {
            //коэффицент во сколько раз увеличилось количество холдеров
            const holdersRatio =
              token.holdersCount / holdersOneHourAgo.holdersCount;

            // на сколько процентов увеличилось количество холдеров
            const holdersPercentage = holdersRatio * 100 - 100;

            if (holdersPercentage >= 0 && holdersPercentage < 50) {
              tokenScore += holdersPercentage * (18 / 50);
            }

            if (holdersPercentage >= 50 && holdersPercentage < 100) {
              tokenScore += 18;
            }

            if (holdersPercentage >= 100 && holdersPercentage < 200) {
              tokenScore += 18 - (holdersPercentage - 100) * (18 / 100);
            }

            if (holdersPercentage >= 200 && holdersPercentage < 300) {
              tokenScore += (holdersPercentage - 200) * (-18 / 100);
            }

            if (holdersPercentage >= 300) {
              tokenScore += -18;
            }
          }

          // баллы за прирост % холдеров за 1 день
          if (
            holdersOneDayAgo &&
            token.holdersCount != null &&
            holdersOneDayAgo.holdersCount != null &&
            token.holdersCount > holdersOneDayAgo.holdersCount
          ) {
            const holdersRatio =
              token.holdersCount / holdersOneDayAgo.holdersCount;

            const holdersPercentage = holdersRatio * 100 - 100;

            if (holdersPercentage >= 0 && holdersPercentage < 50) {
              tokenScore += holdersPercentage * (12 / 50);
            }

            if (holdersPercentage >= 50 && holdersPercentage < 100) {
              tokenScore += 12;
            }

            if (holdersPercentage >= 100 && holdersPercentage < 200) {
              tokenScore += 12 - (holdersPercentage - 100) * (12 / 100);
            }

            if (holdersPercentage >= 200 && holdersPercentage < 300) {
              tokenScore += 0 - (holdersPercentage - 200) * (12 / 100);
            }

            if (holdersPercentage >= 300) {
              tokenScore += -12;
            }
          }

          await holdersScore.push({
            tokenAddress: token.tokenAddress,
            tokenScore,
          });
        }),
      );

      const oldScore = await this.prisma.score.findMany();

      const mergedScores = {};

      // Суммируем баллы из массива holdersScore
      holdersScore.forEach((item) => {
        if (mergedScores[item.tokenAddress]) {
          mergedScores[item.tokenAddress] += item.tokenScore;
        } else {
          mergedScores[item.tokenAddress] = {
            tokenScore: item.tokenScore,
            liquidity: null, // Добавляем liquidity с начальным значением null
          };
        }
      });

      // Суммируем баллы из массива oldScore
      oldScore.forEach((item) => {
        if (mergedScores[item.tokenAddress]) {
          mergedScores[item.tokenAddress].tokenScore += item.tokenScore;
          mergedScores[item.tokenAddress].liquidity = item.liquidity;
        } else {
          mergedScores[item.tokenAddress] = {
            tokenScore: item.tokenScore,
            liquidity: item.liquidity,
          };
        }
      });

      // Преобразуем объект в массив нужного типа
      const mergedArray = Object.keys(mergedScores).map((key) => ({
        tokenAddress: key,
        tokenScore: mergedScores[key].tokenScore as number,
        liquidity: mergedScores[key].liquidity as string,
      }));

      const { count: deletedCount } = await this.prisma.score.deleteMany();
      const { count: addedCount } = await this.prisma.score.createMany({
        data: mergedArray,
      });

      console.log('deletedCount', deletedCount);
      console.log('addedCount', addedCount);

      // console.log(oldScore.length);
      // console.log(holdersScore.length);
      // console.log(mergedArray.length);

      return { deletedCount, addedCount };
    } catch (error) {
      return error;
    }
  }
}
