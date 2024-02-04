import { HoldersInput } from '@definedfi/sdk/dist/resources/graphql';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { endOfDay, startOfDay, startOfHour, subDays, subHours } from 'date-fns';
import { GraphqlService } from 'src/graphql/graphql.service';
import { holdersQuery } from 'src/graphql/holdersQuery';
import { SolveScoreService } from '../solve-score-sync/solve-score.service';
import { UTCDate } from '@date-fns/utc';

type holdersScore = {
  tokenAddress: string;
  tokenScore: number;
};

type holders = {
  holders: { count: number; __typename: string };
};

@Injectable()
export class HoldersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly graphqlService: GraphqlService,
    private readonly solveScoreService: SolveScoreService,
  ) {}

  public async handleHolders(currentHour: number) {
    const utcDate = new UTCDate();

    const startOfCurrentHour = startOfHour(utcDate);
    const startOfHourOneDayAgo = startOfHour(subHours(utcDate, 24));

    try {
      const tokenAddresses = await this.prisma.tokens.findMany({
        where: { liquidity: { gte: '10000' } },
        select: {
          address: true,
          networkId: true,
        },
      });

      // const chunkSize = tokenAddresses.length / 200 + 1;

      // разбиваю наш большой массив, на мелкие с максимальным количеством элементов 200, чтобы потом параллельно их обрабатывать.
      const subarrays = await this.chunk(tokenAddresses, 200);

      // удаляю всех холдеров которые уже были созданы за этот час или старые значения, старше 24 часов.
      // Сделано на случай, если крон будет запускаться чаще, чем раз в час и чтобы не получилось,
      // что за один час у токена есть два значения по холдерам
      await this.prisma.holders.deleteMany({
        where: {
          OR: [
            { createdAt: { lt: startOfHourOneDayAgo } },
            { createdAt: { gte: startOfCurrentHour } },
          ],
        },
      });

      // обрабатываем тот случай, когда мы находим холдеров не по всем токенам, а по тем,
      // у которых volume вырос на 1000 и выше
      if (currentHour !== 0) {
        const utcDate = new UTCDate();
        const today = startOfDay(utcDate);
        const yesterday = startOfDay(subDays(utcDate, 1));
        const twoDaysAgo = startOfDay(subDays(utcDate, 2));

        // возвращает volume за позавчера
        const volumeTwoDaysAgo = await this.prisma.volume.findMany({
          where: {
            AND: [
              { volumeCreatedAt: { gte: twoDaysAgo } },
              { volumeCreatedAt: { lt: yesterday } },
            ],
          },
        });

        // возвращает volume за вчера
        const volumeYesterday = await this.prisma.volume.findMany({
          where: {
            AND: [
              { volumeCreatedAt: { gte: yesterday } },
              { volumeCreatedAt: { lt: today } },
            ],
          },
        });

        const allHolders = await Promise.all(
          subarrays.map(async (subarray) => {
            const holders = await this.processTokenAddresses(
              subarray,
              currentHour,
              volumeTwoDaysAgo,
              volumeYesterday,
            );

            return holders;
          }),
        );

        const flattenedHolders = allHolders.flat();

        const { count: createdCount } = await this.prisma.holders.createMany({
          data: flattenedHolders,
        });
        console.log(`Для ${createdCount} токенов найдены холдеры`);
      } else {
        const allHolders = await Promise.all(
          subarrays.map(async (subarray) => {
            const holders = await this.processTokenAddresses(
              subarray,
              currentHour,
            );

            return holders;
          }),
        );

        const flattenedHolders = allHolders.flat();

        const { count: createdCount } = await this.prisma.holders.createMany({
          data: flattenedHolders,
        });
        console.log(`Для ${createdCount} токенов найдены холдеры`);
      }

      return 'ok';
    } catch (error) {
      return error;
    }
  }

  public async processTokenAddresses(
    tokenAddresses,
    currentHour: number,
    volumeTwoDaysAgo?,
    volumeYesterday?,
  ) {
    const holders = [];

    for (const token of tokenAddresses) {
      // console.log(token.address + ':1');
      // Ищем холдеров для всех токенов на networkId = 1. Это условие срабатывает только раз в сутки
      if (token.networkId === 1 && currentHour === 0) {
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

      // Ищем холдеров для токенов на networkId = 1 и, у которых объем продаж вырос на 1000 или более
      if (token.networkId === 1 && currentHour !== 0) {
        const volumeCountTwoDaysAgo = volumeTwoDaysAgo.find(
          (volume) => volume.address === token.address,
        );

        const volumeCountYesterday = volumeYesterday.find(
          (volume) => (volume.address = token.address),
        );

        if (
          volumeCountTwoDaysAgo &&
          volumeCountYesterday &&
          parseFloat(volumeCountTwoDaysAgo.volume24) -
            parseFloat(volumeCountYesterday.volume24) >=
            1000
        ) {
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
      }

      if (token.networkId !== 1) {
        holders.push({
          tokenAddress: token.address,
          holdersCount: -1,
        });
      }
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

          // баллы для токенов, у которых networkId не 1
          if (token.holdersCount === -1) {
            tokenScore += 16;
          }

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
      let mergedArray = Object.keys(mergedScores).map((key) => ({
        tokenAddress: key,
        tokenScore: mergedScores[key].tokenScore as number,
        liquidity: mergedScores[key].liquidity as string,
      }));

      mergedArray = mergedArray.filter((item) => item.tokenScore > 0);

      const { count: deletedCount } = await this.prisma.score.deleteMany();
      const { count: addedCount } = await this.prisma.score.createMany({
        data: mergedArray,
      });

      console.log('deletedCount', deletedCount);
      console.log('addedCount', addedCount);

      await this.solveScoreService.handleScoreByHours(mergedArray);

      // console.log(oldScore.length);
      // console.log(holdersScore.length);
      // console.log(mergedArray.length);

      return { deletedCount, addedCount };
    } catch (error) {
      return error;
    }
  }
}
