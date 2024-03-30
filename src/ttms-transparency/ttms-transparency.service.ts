import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

interface portfolio {
  id: number;
  tokenAddress: string;
  symbol: string;
  priceUSD: string;
  startedAt: string;
  ATH?: string;
  ATL?: string;
  dailyPriceChange095?: string;
  currentPrice?: string;
  exitPrice?: string;
  quoteToken?: string;
  pairAddress?: string;
  networkId?: number;
  image?: string;
  liquidityTokenSymbol?: string;
  liquidityTokenAddress?: string;
  stopLoss?: string;
  interval?: number;
  intervalCheck?: number;
}

@Injectable()
export class TtmsTransparencyService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleTtmsTransparency(
    interval: string,
    snapshot: string,
    blockchain: string,
  ) {
    const score = await this.prisma.score.findMany();

    if (snapshot && interval) {
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

      const tokenAddresses = portfolio.map((portfolio) => {
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
          };
        }
      });

      return tokenAddresses;
    }

    return 0;
  }
}
