import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { portfolio, resultToken } from './interfaces';
import { UTCDate } from '@date-fns/utc';
import { subHours } from 'date-fns';
import { SnapshotEnum, ChainEnum } from './interfaces';

@Injectable()
export class TtmsTransparencyService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleTtmsTransparency(snapshot: SnapshotEnum, blockchain: ChainEnum) {
    const utcDate = new UTCDate();
    const currentTimestampInSeconds: number = Math.floor(
      utcDate.getTime() / 1000,
    );
    let blockchainNumber = 0;
    let interval = '24';
    let snapshotSymbol = '9am';
    if (blockchain) {
      if (blockchain === ChainEnum.eth) {
        blockchainNumber = 1;
      }
      if (blockchain === ChainEnum.bsc) {
        blockchainNumber = 56;
      }
    }
    if (
      snapshot !== SnapshotEnum.amCurrent &&
      snapshot !== SnapshotEnum.pmCurrent
    ) {
      snapshotSymbol = '9' + snapshot.slice(0, 2);
      interval = snapshot.slice(2);
    }
    if (
      snapshot === SnapshotEnum.amCurrent ||
      snapshot === SnapshotEnum.pmCurrent
    ) {
      snapshotSymbol = 'current';
    }

    let score = await this.prisma.score.findMany();
    const tokens = await this.prisma.tokens.findMany();

    if (snapshotSymbol !== 'current') {
      const portfolioRaw =
        await this.prisma.last24SolvedTtmsPortfolio.findFirst({
          where: {
            AND: [
              { startedAt: snapshotSymbol },
              { interval: parseFloat(interval) },
            ],
          },
        });

      const portfolio: portfolio[] = Object.entries(portfolioRaw.portfolio).map(
        ([key, value]) => {
          return {
            id: value.id,
            tokenAddress: value.tokenAddress,
            symbol: value.symbol,
            priceUSD: value.priceUSD,
            startedAt: value.startedAt,
            ATH: value.ATH,
            ATL: value.ATL,
            dailyPriceChange095: value.dailyPriceChange095,
            currentPrice: value.currentPrice,
            exitPrice: value.exitPrice,
            quoteToken: value.quoteToken,
            pairAddress: value.pairAddress,
            networkId: value.networkId,
            image: value.image,
            liquidityTokenSymbol: value.liquidityTokenSymbol,
            liquidityTokenAddress: value.liquidityTokenAddress,
            stopLoss: value.stopLoss,
            interval: value.interval,
            intervalCheck: value.intervalCheck,
          };
        },
      );

      let resultTokens: resultToken[] = portfolio.map((portfolio) => {
        const tokenScore = score.find(
          (token) => token.tokenAddress === portfolio.tokenAddress,
        );

        const tokenData = tokens.find(
          (token) => token.address === portfolio.tokenAddress,
        );

        if (tokenScore && tokenData) {
          return {
            tokenAddress: portfolio.tokenAddress,
            symbol: tokenData.symbol,
            ttms: tokenScore.tokenScore,
            startPrice: portfolio.priceUSD,
            exitPrice: portfolio.exitPrice,
            resultPercentage: portfolio.dailyPriceChange095,
            priceGrowthPercentageFor24h: JSON.stringify(
              parseFloat(tokenData.change24) * 100,
            ),
            priceGrowthPercentageFor24hScore: tokenScore.scoreFromChange24,
            votesFor24: tokenScore.votesCount24,
            votesFor24Score: tokenScore.scoreFromVotesFor24h,
            votersPercentageFor24: tokenScore.votersPercentageFor24h,
            votersPercentageFor24Score:
              tokenScore.scoreFromVotersPercentageFor24h,
            votesPercentageFor24: tokenScore.votesPercentageFor24h,
            votesPercentageFor24Score:
              tokenScore.scoreFromVotesPercentageFor24h,
            votesPercentageFor7days: tokenScore.votesPercentageFor7d,
            votesPercentageFor7daysScore:
              tokenScore.scoreFromVotesPercentageFor7d,
            holders: tokenScore.holders,
            holdersCountScore: tokenScore.holdersCountScore,
            holdersGrowthPercentageFor1h: tokenScore.holdersGrowthPercentage1h,
            holdersGrowthPercentageFor1hScore:
              tokenScore.scoreHoldersGrowthPercentage1h,
            holdersGrowthPercentageFor24h:
              tokenScore.holdersGrowthPercentage24h,
            holdersGrowthPercentageFor24hScore:
              tokenScore.scoreHoldersGrowthPercentage24h,
            volumeChangePercentage: tokenScore.volumeChangePercentage,
            scoreFromVolumePercentage: tokenScore.scoreFromVolumePercentage,
            liquidity: tokenData.liquidity,
            liquidityScore: tokenScore.liquidityScore,
            tokenAge: (currentTimestampInSeconds - tokenData.createdAt) / 3600,
            tokenAgeScore: tokenScore.tokenAgeScore,
            volumeTwoDaysAgo: tokenScore.volumeTwoDaysAgo,
            scoreFromVolumeTwoDaysAgo: tokenScore.scoreFromVolumeTwoDaysAgo,
            txnCount24: tokenData.txnCount24,
            txnCount24Score: tokenScore.txnCount24Score,
            aiScore: tokenScore.aiScore,
            image: tokenData.image,
            liquidityTokenSymbol: tokenData.liquidityTokenSymbol,
            networkId: portfolio.networkId,
          };
        }
      });

      resultTokens = resultTokens.filter((element) => {
        return element;
      });

      if (blockchainNumber !== 0) {
        resultTokens = resultTokens.filter((element) => {
          return element.networkId && element.networkId === blockchainNumber;
        });
      }

      resultTokens.sort((a, b) => {
        return b.ttms - a.ttms;
      });

      return resultTokens;
    }

    score.sort((a, b) => {
      if (a.tokenScore === b.tokenScore) {
        return parseFloat(b.liquidity) - parseFloat(a.liquidity);
      } else {
        return b.tokenScore - a.tokenScore;
      }
    });

    if (blockchainNumber !== 0) {
      score = score.filter((element) => {
        return element.networkId && element.networkId === blockchainNumber;
      });
    }

    return score.slice(0, 30).map((element) => {
      return {
        tokenAddress: element.tokenAddress,
        symbol: element.symbol,
        ttms: element.tokenScore,
        startPrice: null,
        exitPrice: null,
        resultPercentage: null,
        priceGrowthPercentageFor24h: JSON.stringify(
          parseFloat(element.change24) * 100,
        ),
        priceGrowthPercentageFor24hScore: element.scoreFromChange24,
        votesFor24: element.votesCount24,
        votesFor24Score: element.scoreFromVotesFor24h,
        votersPercentageFor24: element.votersPercentageFor24h,
        votersPercentageFor24Score: element.scoreFromVotersPercentageFor24h,
        votesPercentageFor24: element.votesPercentageFor24h,
        votesPercentageFor24Score: element.scoreFromVotesPercentageFor24h,
        votesPercentageFor7days: element.votesPercentageFor7d,
        votesPercentageFor7daysScore: element.scoreFromVotesPercentageFor7d,
        holders: element.holders,
        holdersCountScore: element.holdersCountScore,
        holdersGrowthPercentageFor1h: element.holdersGrowthPercentage1h,
        holdersGrowthPercentageFor1hScore:
          element.scoreHoldersGrowthPercentage1h,
        holdersGrowthPercentageFor24h: element.holdersGrowthPercentage24h,
        holdersGrowthPercentageFor24hScore:
          element.scoreHoldersGrowthPercentage24h,
        volumeChangePercentage: element.volumeChangePercentage,
        scoreFromVolumePercentage: element.scoreFromVolumePercentage,
        liquidity: element.liquidity,
        liquidityScore: element.liquidityScore,
        tokenAge: (currentTimestampInSeconds - element.createdAt) / 3600,
        tokenAgeScore: element.tokenAgeScore,
        volumeTwoDaysAgo: element.volumeTwoDaysAgo,
        scoreFromVolumeTwoDaysAgo: element.scoreFromVolumeTwoDaysAgo,
        txnCount24: element.txnCount24,
        txnCount24Score: element.txnCount24Score,
        aiScore: element.aiScore,
        image: element.image,
        liquidityTokenSymbol: element.liquidityTokenSymbol,
        networkId: element.networkId,
      };
    });
  }

  async ttmsTransparencyDates() {
    const portfolios = await this.prisma.last24SolvedTtmsPortfolio.findMany();

    let result = [];

    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    result = await portfolios.map((portfolio) => {
      const portfolioCalculatedAt = portfolio.createdAt;
      const portfolioCalculatedAtPst = subHours(portfolioCalculatedAt, 8);
      const portfolioCalculationStartedAt = subHours(
        portfolioCalculatedAtPst,
        portfolio.interval,
      );

      const portfolioCalculationStartedAtUtc = new Date(
        portfolioCalculationStartedAt,
      );
      const portfolioCalculationEndedAtUtc = new Date(portfolioCalculatedAtPst);

      const portfolioCalculationStartedDay =
        portfolioCalculationStartedAtUtc.getUTCDate();
      const portfolioCalculationEndedDay =
        portfolioCalculationEndedAtUtc.getUTCDate();
      const startMonth = portfolioCalculationStartedAtUtc.getUTCMonth();
      const endMonth = portfolioCalculationEndedAtUtc.getUTCMonth();
      const startYear = portfolioCalculationStartedAtUtc.getUTCFullYear();
      const endYear = portfolioCalculationEndedAtUtc.getUTCFullYear();

      if (portfolio.startedAt === '9am') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]}, 9am PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]}, 9am PST`;

        const key = `${portfolio.startedAt}${portfolio.interval}`;

        return {
          [key]: {
            portfolioInterval: portfolio.interval,
            portfolioSnapShot: portfolio.startedAt,
            cycleStart: cycleStart,
            cycleEnd: cycleEnd,
          },
        };
      }

      if (portfolio.startedAt === '9pm') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]}, 9pm PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]}, 9pm PST`;

        const key = `${portfolio.startedAt}${portfolio.interval}`;

        return {
          [key]: {
            portfolioInterval: portfolio.interval,
            portfolioSnapShot: portfolio.startedAt,
            cycleStart: cycleStart,
            cycleEnd: cycleEnd,
          },
        };
      }
    });

    const utcDate = new UTCDate();
    const utcDate7HoursAgo = subHours(utcDate, 7);
    const pstDate = new Date(utcDate7HoursAgo);
    const nowPstDay = pstDate.getUTCDate();
    const nowPstMonth = pstDate.getUTCMonth();
    const nowPstYear = pstDate.getUTCFullYear();
    const nowPstHour = pstDate.getUTCHours();
    const nowPstMinute = pstDate.getUTCMinutes();
    const nowPstAmPm = nowPstHour >= 12 ? 'pm' : 'am';
    const nowPstHourFormatted = nowPstHour % 12 || 12;

    await result.push({
      current: {
        portfolioInterval: null,
        portfolioSnapShot: null,
        cycleStart: `${nowPstDay} ${months[nowPstMonth]}, ${nowPstHourFormatted}${nowPstAmPm} PST`,
        cycleEnd: `${nowPstDay} ${months[nowPstMonth]}, ${nowPstHourFormatted}${nowPstAmPm} PST`,
      },
    });

    const resultObject = Object.fromEntries(
      result.map((item) => [Object.keys(item)[0], item[Object.keys(item)[0]]]),
    );

    return resultObject;
  }
}
