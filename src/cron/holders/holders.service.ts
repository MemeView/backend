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
  holders?: number;
  holdersCountScore?: number;
  holdersGrowthPercentage1h?: number;
  scoreHoldersGrowthPercentage1h?: number;
  holdersGrowthPercentage24h?: number;
  scoreHoldersGrowthPercentage24h?: number;
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

  async handleTwHolders() {
    try {
      const tokenWatch = await this.prisma.tokenWatch.findFirst();

      const result: holders = await this.graphqlService.makeQuery(
        holdersQuery(tokenWatch.address + ':1'),
        {
          cursor: null,
          tokenId: tokenWatch.address + ':1',
        },
      );

      tokenWatch.holders = result.holders.count;

      await this.prisma.tokenWatch.deleteMany();
      await this.prisma.tokenWatch.create({ data: tokenWatch });

      return tokenWatch;
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
            { createdAt: { gte: startOfHourOneDayAgo } },
            { createdAt: { lt: startOfHourOneDayAgoPlusOneHour } },
          ],
        },
      });

      const holdersScore: holdersScore[] = [];

      await Promise.allSettled(
        holdersNowRaw.map(async (token) => {
          let tokenScore = 0;
          const holders: number = token.holdersCount;
          let holdersCountScore = 0;
          let holdersGrowthPercentage1h: number = null;
          let scoreHoldersGrowthPercentage1h: number = null;
          let holdersGrowthPercentage24h: number = null;
          let scoreHoldersGrowthPercentage24h: number = null;

          // баллы для токенов, у которых networkId не 1
          if (token.holdersCount === -1) {
            tokenScore += 10;
            holdersCountScore += 10;
          }

          // баллы за количество холдеров
          if (token.holdersCount >= 50 && token.holdersCount <= 200) {
            tokenScore += (token.holdersCount - 50) * (12 / 150);
            holdersCountScore += (token.holdersCount - 50) * (12 / 150);
          }

          if (token.holdersCount > 200 && token.holdersCount <= 3000) {
            tokenScore += 12;
            holdersCountScore += 12;
          }

          if (token.holdersCount > 3000 && token.holdersCount <= 10000) {
            tokenScore +=
              (token.holdersCount - 3001) * ((1 - 12) / (10000 - 3001)) + 12;
            holdersCountScore +=
              (token.holdersCount - 3001) * ((1 - 12) / (10000 - 3001)) + 12;
          }

          if (token.holdersCount > 10000) {
            tokenScore += 1;
            holdersCountScore += 1;
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

            holdersGrowthPercentage1h = holdersPercentage;

            if (holdersPercentage >= 0 && holdersPercentage < 50) {
              tokenScore += holdersPercentage * (18 / 50);
              scoreHoldersGrowthPercentage1h = holdersPercentage * (18 / 50);
            }

            if (holdersPercentage >= 50 && holdersPercentage < 100) {
              tokenScore += 18;
              scoreHoldersGrowthPercentage1h = 18;
            }

            if (holdersPercentage >= 100 && holdersPercentage < 200) {
              tokenScore += 18 - (holdersPercentage - 100) * (18 / 100);
              scoreHoldersGrowthPercentage1h =
                18 - (holdersPercentage - 100) * (18 / 100);
            }

            if (holdersPercentage >= 200 && holdersPercentage < 300) {
              tokenScore += (holdersPercentage - 200) * (-18 / 100);
              scoreHoldersGrowthPercentage1h =
                (holdersPercentage - 200) * (-18 / 100);
            }

            if (holdersPercentage >= 300) {
              tokenScore += -18;
              scoreHoldersGrowthPercentage1h = -18;
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

            holdersGrowthPercentage24h = holdersPercentage;

            if (holdersPercentage >= 0 && holdersPercentage < 50) {
              tokenScore += holdersPercentage * (12 / 50);
              scoreHoldersGrowthPercentage24h = holdersPercentage * (12 / 50);
            }

            if (holdersPercentage >= 50 && holdersPercentage < 100) {
              tokenScore += 12;
              scoreHoldersGrowthPercentage24h = 12;
            }

            if (holdersPercentage >= 100 && holdersPercentage < 200) {
              tokenScore += 12 - (holdersPercentage - 100) * (12 / 100);
              scoreHoldersGrowthPercentage24h =
                12 - (holdersPercentage - 100) * (12 / 100);
            }

            if (holdersPercentage >= 200 && holdersPercentage < 300) {
              tokenScore += 0 - (holdersPercentage - 200) * (12 / 100);
              scoreHoldersGrowthPercentage24h =
                0 - (holdersPercentage - 200) * (12 / 100);
            }

            if (holdersPercentage >= 300) {
              tokenScore += -12;
              scoreHoldersGrowthPercentage24h = -12;
            }
          }

          await holdersScore.push({
            tokenAddress: token.tokenAddress,
            holders,
            holdersCountScore,
            holdersGrowthPercentage1h,
            scoreHoldersGrowthPercentage1h,
            holdersGrowthPercentage24h,
            scoreHoldersGrowthPercentage24h,
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
          mergedScores[item.tokenAddress] = item.holdersCountScore;
          mergedScores[item.tokenAddress] = item.holdersGrowthPercentage1h;
          mergedScores[item.tokenAddress] = item.scoreHoldersGrowthPercentage1h;
          mergedScores[item.tokenAddress] = item.holdersGrowthPercentage24h;
          mergedScores[item.tokenAddress] =
            item.scoreHoldersGrowthPercentage24h;
        } else {
          mergedScores[item.tokenAddress] = {
            tokenScore: item.tokenScore,
            holders: item.holders,
            holdersCountScore: item.holdersCountScore,
            holdersGrowthPercentage1h: item.holdersGrowthPercentage1h,
            scoreHoldersGrowthPercentage1h: item.scoreHoldersGrowthPercentage1h,
            holdersGrowthPercentage24h: item.holdersGrowthPercentage24h,
            scoreHoldersGrowthPercentage24h:
              item.scoreHoldersGrowthPercentage24h,
            liquidity: null as string, // Добавляем liquidity с начальным значением null
            liquidityScore: null as number,
            scoreFromVolume: null as number,
            votesCount24: null,
            scoreFromVotesFor24h: null,
            scoreFromVotes: null,
            votersPercentageFor24h: null,
            scoreFromVotersPercentageFor24h: null,
            votesPercentageFor24h: null,
            scoreFromVotesPercentageFor24h: null as number,
            scoreFromVotesPercentageFor7d: null as number,
            votesPercentageFor7d: null,
            change24: null,
            scoreFromChange24: null as number,
            volume: null,
            volumeChangePercentage: null,
            createdAt: null as number,
            txnCount24: null as number,
            liquidityTokenSymbol: null,
            networkId: null as number,
            volumeTwoDaysAgo: null as string,
            scoreFromVolumePercentage: null as number,
            scoreFromVolumeTwoDaysAgo: null as number,
            aiScore: null as number,
            symbol: null as string,
            image: null as string,
          };
        }
      });

      // Суммируем баллы из массива oldScore
      oldScore.forEach((item) => {
        if (mergedScores[item.tokenAddress]) {
          mergedScores[item.tokenAddress].tokenScore += item.tokenScore;
          mergedScores[item.tokenAddress].liquidity = item.liquidity;
          mergedScores[item.tokenAddress].scoreFromVolume +=
            item.scoreFromVolume;
          mergedScores[item.tokenAddress].votesCount24 = item.votesCount24;
          mergedScores[item.tokenAddress].scoreFromVotesFor24h +=
            item.scoreFromVotesFor24h;
          mergedScores[item.tokenAddress].scoreFromVotes += item.scoreFromVotes;
          mergedScores[item.tokenAddress].votersPercentageFor24h =
            item.votersPercentageFor24h;
          mergedScores[item.tokenAddress].scoreFromVotersPercentageFor24h +=
            item.scoreFromVotersPercentageFor24h;
          mergedScores[item.tokenAddress].votesPercentageFor24h =
            item.votesPercentageFor24h;
          mergedScores[item.tokenAddress].scoreFromVotesPercentageFor24h +=
            item.scoreFromVotesPercentageFor24h;
          mergedScores[item.tokenAddress].scoreFromVotesPercentageFor7d +=
            item.scoreFromVotesPercentageFor7d;
          mergedScores[item.tokenAddress].votesPercentageFor7d =
            item.votesPercentageFor7d;
          mergedScores[item.tokenAddress].change24 = item.change24;
          mergedScores[item.tokenAddress].scoreFromChange24 +=
            item.scoreFromChange24;
          mergedScores[item.tokenAddress].volume = item.volume;
          mergedScores[item.tokenAddress].volumeChangePercentage =
            item.volumeChangePercentage;
          mergedScores[item.tokenAddress].createdAt = item.createdAt;
          mergedScores[item.tokenAddress].txnCount24 = item.txnCount24;
          mergedScores[item.tokenAddress].txnCount24Score +=
            item.txnCount24Score;
          mergedScores[item.tokenAddress].liquidityScore += item.liquidityScore;
          mergedScores[item.tokenAddress].tokenAgeScore += item.tokenAgeScore;
          mergedScores[item.tokenAddress].aiScore += item.aiScore;
          mergedScores[item.tokenAddress].liquidityTokenSymbol =
            item.liquidityTokenSymbol;
          mergedScores[item.tokenAddress].networkId = item.networkId;
          mergedScores[item.tokenAddress].holdersCountScore +=
            item.holdersCountScore;
          mergedScores[item.tokenAddress].holdersGrowthPercentage1h +=
            item.holdersGrowthPercentage1h;
          mergedScores[item.tokenAddress].scoreHoldersGrowthPercentage1h +=
            item.scoreHoldersGrowthPercentage1h;
          mergedScores[item.tokenAddress].holdersGrowthPercentage24h +=
            item.holdersGrowthPercentage24h;
          mergedScores[item.tokenAddress].scoreHoldersGrowthPercentage24h +=
            item.scoreHoldersGrowthPercentage24h;
          mergedScores[item.tokenAddress].volumeTwoDaysAgo =
            item.volumeTwoDaysAgo;
          mergedScores[item.tokenAddress].scoreFromVolumePercentage +=
            item.scoreFromVolumePercentage;
          mergedScores[item.tokenAddress].scoreFromVolumeTwoDaysAgo +=
            item.scoreFromVolumeTwoDaysAgo;
          mergedScores[item.tokenAddress].symbol = item.symbol;
          mergedScores[item.tokenAddress].image = item.image;
        } else {
          mergedScores[item.tokenAddress] = {
            tokenScore: item.tokenScore,
            holders: null,
            holdersCountScore: null,
            holdersGrowthPercentage1h: null,
            scoreHoldersGrowthPercentage1h: null,
            holdersGrowthPercentage24h: null,
            scoreHoldersGrowthPercentage24h: null,
            liquidity: item.liquidity,
            scoreFromVolume: item.scoreFromVolume,
            votesCount24: item.votesCount24,
            scoreFromVotesFor24h: item.scoreFromVotesFor24h,
            scoreFromVotes: item.scoreFromVotes,
            votersPercentageFor24h: item.votersPercentageFor24h,
            scoreFromVotersPercentageFor24h:
              item.scoreFromVotersPercentageFor24h,
            votesPercentageFor24h: item.votesPercentageFor24h,
            scoreFromVotesPercentageFor24h: item.scoreFromVotesPercentageFor24h,
            scoreFromVotesPercentageFor7d: item.scoreFromVotesPercentageFor7d,
            votesPercentageFor7d: item.votesPercentageFor7d,
            change24: item.change24,
            scoreFromChange24: item.scoreFromChange24,
            volume: item.volume,
            volumeChangePercentage: item.volumeChangePercentage,
            createdAt: item.createdAt,
            txnCount24: item.txnCount24,
            txnCount24Score: item.txnCount24Score,
            liquidityScore: item.liquidityScore,
            tokenAgeScore: item.tokenAgeScore,
            aiScore: item.aiScore,
            liquidityTokenSymbol: item.liquidityTokenSymbol,
            networkId: item.networkId,
            volumeTwoDaysAgo: item.volumeTwoDaysAgo,
            scoreFromVolumePercentage: item.scoreFromVolumePercentage,
            scoreFromVolumeTwoDaysAgo: item.scoreFromVolumeTwoDaysAgo,
            symbol: item.symbol,
            image: item.image,
          };
        }
      });

      // Преобразуем объект в массив нужного типа
      let mergedArray = Object.keys(mergedScores).map((key) => ({
        tokenAddress: key,
        tokenScore: mergedScores[key].tokenScore as number,
        liquidity: mergedScores[key].liquidity as string,

        holders: mergedScores[key].holders as number,
        holdersCountScore: mergedScores[key].holdersCountScore as number,
        holdersGrowthPercentage1h: mergedScores[key]
          .holdersGrowthPercentage1h as number,
        scoreHoldersGrowthPercentage1h: mergedScores[key]
          .scoreHoldersGrowthPercentage1h as number,
        holdersGrowthPercentage24h: mergedScores[key]
          .holdersGrowthPercentage24h as number,
        scoreHoldersGrowthPercentage24h: mergedScores[key]
          .scoreHoldersGrowthPercentage24h as number,
        scoreFromVolume: mergedScores[key].scoreFromVolume as number,
        votesCount24: mergedScores[key].votesCount24 as number,
        scoreFromVotesFor24h: mergedScores[key].scoreFromVotesFor24h as number,
        scoreFromVotes: mergedScores[key].scoreFromVotes as number,
        votersPercentageFor24h: mergedScores[key]
          .votersPercentageFor24h as number,
        scoreFromVotersPercentageFor24h: mergedScores[key]
          .scoreFromVotersPercentageFor24h as number,
        votesPercentageFor24h: mergedScores[key]
          .votesPercentageFor24h as number,
        scoreFromVotesPercentageFor24h: mergedScores[key]
          .scoreFromVotesPercentageFor24h as number,
        scoreFromVotesPercentageFor7d: mergedScores[key]
          .scoreFromVotesPercentageFor7d as number,
        votesPercentageFor7d: mergedScores[key].votesPercentageFor7d as number,
        change24: mergedScores[key].change24 as string,
        scoreFromChange24: mergedScores[key].scoreFromChange24 as number,
        volume: mergedScores[key].volume as string,
        volumeChangePercentage: mergedScores[key]
          .volumeChangePercentage as number,
        createdAt: mergedScores[key].createdAt as number,
        txnCount24: mergedScores[key].txnCount24 as number,
        txnCount24Score: mergedScores[key].txnCount24Score as number,
        liquidityScore: mergedScores[key].liquidityScore as number,
        tokenAgeScore: mergedScores[key].tokenAgeScore as number,
        aiScore: mergedScores[key].aiScore as number,
        liquidityTokenSymbol: mergedScores[key].liquidityTokenSymbol as string,
        networkId: mergedScores[key].networkId as number,
        volumeTwoDaysAgo: mergedScores[key].volumeTwoDaysAgo as string,
        scoreFromVolumePercentage: mergedScores[key]
          .scoreFromVolumePercentage as number,
        scoreFromVolumeTwoDaysAgo: mergedScores[key]
          .scoreFromVolumeTwoDaysAgo as number,
        symbol: mergedScores[key].symbol as string,
        image: mergedScores[key].image as string,
      }));

      mergedArray = mergedArray.filter((item) => item.tokenScore > 0);

      mergedArray = mergedArray.filter((item) =>
        oldScore.some((oldItem) => oldItem.tokenAddress === item.tokenAddress),
      );

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
