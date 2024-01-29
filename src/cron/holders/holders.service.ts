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
          createdAt: { lte: oneWeekAgo },
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
    const oneHourAgo = subHours(now, 1);
    const startOfCurrentHour = startOfHour(now);
    const twentyThreeHoursAgo = subHours(now, 23);
    const twentyFourHoursAgo = subHours(now, 24);
    const oneWeekAgo = subHours(now, 167);

    try {
      // const tokensRaw = await this.prisma.tokens.findMany({
      //   select: {
      //     address: true,
      //   },
      // });

      const holders = await this.prisma.holders.findMany({
        where: {
          createdAt: { gte: startOfCurrentHour },
        },
      });

      // console.log(startOfCurrentHour);

      // return holders;

      // console.log(holdersRaw);

      const holdersScore: { tokenAddress: string; tokenScore: number }[] = [];

      if (holders) {
        const chunkedTokens = await this.chunk(holders, 8);
        for (const tokensChunk of chunkedTokens) {
          const promises = tokensChunk.map(async (token) => {
            let tokenScore = 0;
            // console.log(token);

            // баллы за количество холдеров
            if (token.holdersCount <= 3000) {
              tokenScore += 12;

              // holdersScore.push({ tokenAddress: token.address, tokenScore });
            } else if (token.holdersCount >= 100000) {
              tokenScore += 1;

              // holdersScore.push({ tokenAddress: token.address, tokenScore });
            } else {
              tokenScore += 12 - ((token.holdersCount - 3000) / 97000) * 5;

              // holdersScore.push({ tokenAddress: token.address, tokenScore });
            }

            const holdersCountNow = token.holdersCount;

            const holdersCountOneHourAgo = await this.prisma.holders.findFirst({
              where: {
                AND: [
                  { tokenAddress: token.tokenAddress },
                  { createdAt: { lt: startOfCurrentHour } },
                ],
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

            // баллы за прирост % холдеров за 1 час
            if (
              holdersCountNow != null &&
              holdersCountOneHourAgo != null &&
              holdersCountNow > holdersCountOneHourAgo.holdersCount
            ) {
              const holdersRatio =
                holdersCountNow / holdersCountOneHourAgo.holdersCount;

              if (holdersRatio >= 5) {
                tokenScore += 15;
              } else {
                tokenScore += 15 * (holdersRatio / (5 / 100) / 100);
              }
            }

            const holdersCountTwentyFourHoursAgo =
              await this.prisma.holders.findFirst({
                where: {
                  AND: [
                    { tokenAddress: token.tokenAddress },
                    { createdAt: { gte: twentyFourHoursAgo } },
                    { createdAt: { lte: twentyThreeHoursAgo } },
                  ],
                },
                orderBy: {
                  createdAt: 'desc',
                },
              });

            // баллы за прирост % холдеров за 24 часа
            if (
              holdersCountNow != null &&
              holdersCountTwentyFourHoursAgo != null &&
              holdersCountNow > holdersCountTwentyFourHoursAgo.holdersCount
            ) {
              const holdersRatio =
                holdersCountNow / holdersCountTwentyFourHoursAgo.holdersCount;

              if (holdersRatio >= 2) {
                tokenScore += 8;
              } else {
                tokenScore += 8 * (holdersRatio / (2 / 100) / 100);
              }
            }

            const holdersCountOneWeekAgo = await this.prisma.holders.findFirst({
              where: {
                AND: [
                  { tokenAddress: token.tokenAddress },
                  { createdAt: { lte: oneWeekAgo } },
                ],
              },
            });

            // баллы за % прироста холдеров за 7 дней
            if (
              holdersCountNow != null &&
              holdersCountOneWeekAgo != null &&
              holdersCountNow > holdersCountOneWeekAgo.holdersCount
            ) {
              const holdersRatio =
                holdersCountNow / holdersCountOneWeekAgo.holdersCount;
              if (holdersRatio >= 1.5) {
                tokenScore += 2;
              } else {
                tokenScore += 2 * (holdersRatio / (1.5 / 100) / 100);
              }
            }

            holdersScore.push({ tokenAddress: token.tokenAddress, tokenScore });
            // console.log(holdersScore);
          });
          await Promise.all(promises);
        }
      }

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
