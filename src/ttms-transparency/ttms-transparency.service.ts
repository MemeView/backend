import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { portfolio, resultToken } from './interfaces';
import { UTCDate } from '@date-fns/utc';
import { subHours } from 'date-fns';

@Injectable()
export class TtmsTransparencyService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleTtmsTransparency(
    interval: string,
    snapshot: string,
    blockchain: string,
  ) {
    let blockchainNumber = 0;
    if (blockchain) {
      if (blockchain === 'eth') {
        blockchainNumber = 1;
      }
      if (blockchain === 'bsc') {
        blockchainNumber = 56;
      }
    }
    if (!snapshot) {
      snapshot = '0';
    }
    if (!interval) {
      interval = '0';
    }

    let score = await this.prisma.score.findMany();

    if (snapshot !== '0' && interval !== '0') {
      const portfolioRaw =
        await this.prisma.last24SolvedTtmsPortfolio.findFirst({
          where: {
            AND: [{ startedAt: snapshot }, { interval: parseFloat(interval) }],
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
        const token = score.find(
          (token) => token.tokenAddress === portfolio.tokenAddress,
        );

        if (token) {
          return {
            tokenAddress: portfolio.tokenAddress,
            ttms: token.tokenScore,
            startPrice: portfolio.priceUSD,
            exitPrice: portfolio.exitPrice,
            resultPercentage: portfolio.dailyPriceChange095,
            priceGrowthPercentageFor24h: token.change24,
            priceGrowthPercentageFor24hScore: token.scoreFromChange24,
            votesFor24: token.votesCount24,
            votesFor24Score: token.scoreFromVotesFor24h,
            votersPercentageFor24: token.votersPercentageFor24h,
            votersPercentageFor24Score: token.scoreFromVotersPercentageFor24h,
            votesPercentageFor24: token.votesPercentageFor24h,
            votesPercentageFor24Score: token.scoreFromVotesPercentageFor24h,
            votesPercentageFor7days: token.votesPercentageFor7d,
            votesPercentageFor7daysScore: token.scoreFromVotesPercentageFor7d,
            holders: token.holders,
            holdersCountScore: token.holdersCountScore,
            holdersGrowthPercentageFor1h: token.holdersGrowthPercentage1h,
            holdersGrowthPercentageFor1hScore:
              token.scoreHoldersGrowthPercentage1h,
            holdersGrowthPercentageFor24h: token.holdersGrowthPercentage24h,
            holdersGrowthPercentageFor24hScore:
              token.scoreHoldersGrowthPercentage24h,
            volumeChangePercentage: token.volumeChangePercentage,
            scoreFromVolumePercentage: token.scoreFromVolumePercentage,
            liquidity: token.liquidity,
            liquidityScore: token.liquidityScore,
            tokenAge: token.createdAt,
            tokenAgeScore: token.tokenAgeScore,
            volumeTwoDaysAgo: token.volumeTwoDaysAgo,
            scoreFromVolumeTwoDaysAgo: token.scoreFromVolumeTwoDaysAgo,
            txnCount24: token.txnCount24,
            txnCount24Score: token.txnCount24Score,
            aiScore: token.aiScore,
            chain: token.liquidityTokenSymbol,
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
        ttms: element.tokenScore,
        startPrice: null,
        exitPrice: null,
        resultPercentage: null,
        priceGrowthPercentageFor24h: element.change24,
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
        tokenAge: element.createdAt,
        tokenAgeScore: element.tokenAgeScore,
        volumeTwoDaysAgo: element.volumeTwoDaysAgo,
        scoreFromVolumeTwoDaysAgo: element.scoreFromVolumeTwoDaysAgo,
        txnCount24: element.txnCount24,
        txnCount24Score: element.txnCount24Score,
        aiScore: element.aiScore,
        chain: element.liquidityTokenSymbol,
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
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]} ${startYear}, 9am PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]} ${endYear}, 9am PST`;

        return {
          snapshotType: 'portfolio',
          portfolioInterval: portfolio.interval,
          portfolioSnapShot: portfolio.startedAt,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }

      if (portfolio.startedAt === '9pm') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]} ${startYear}, 9pm PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]} ${endYear}, 9pm PST`;

        return {
          snapshotType: 'portfolio',
          portfolioInterval: portfolio.interval,
          portfolioSnapShot: portfolio.startedAt,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
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
      snapshotType: 'current',
      portfolioInterval: null,
      portfolioSnapShot: null,
      cycleStart: `${nowPstDay} ${months[nowPstMonth]} ${nowPstYear}, ${nowPstHourFormatted}${nowPstAmPm} PST`,
      cycleEnd: `${nowPstDay} ${months[nowPstMonth]} ${nowPstYear}, ${nowPstHourFormatted}${nowPstAmPm} PST`,
    });

    return result;
  }
}
