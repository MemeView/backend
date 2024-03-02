import { UTCDate } from '@date-fns/utc';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { startOfDay, subDays } from 'date-fns';

@Injectable()
export class TtmsPortfolioService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleTtmsPortfolio(hour: number) {
    try {
      const utcDate = new UTCDate();
      const todayStartOfDay = startOfDay(utcDate);
      const monthAgo = subDays(utcDate, 30);
      if (hour === 9) {
        const oldPortfolio = await this.prisma.ttmsPortfolio.findMany({
          where: {
            startedAt: '9am',
          },
        });

        oldPortfolio.forEach((portfolio) => {
          if (portfolio.dailyPriceChange095 === null) {
            const priceRatio =
              (parseFloat(portfolio.priceUSD) -
                parseFloat(portfolio.currentPrice) * 0.95) /
              (parseFloat(portfolio.priceUSD) / 100);

            if (
              parseFloat(portfolio.priceUSD) >=
              parseFloat(portfolio.currentPrice)
            ) {
              portfolio.dailyPriceChange095 = `+${priceRatio}`;
              portfolio.exitPrice = JSON.stringify(
                parseFloat(portfolio.currentPrice) * 0.95,
              );
            } else {
              portfolio.dailyPriceChange095 = `-${priceRatio}`;
              portfolio.exitPrice = JSON.stringify(
                parseFloat(portfolio.priceUSD) * 0.95,
              );
            }
          }
        });

        await this.prisma.last24SolvedTtmsPortfolio.deleteMany({
          where: {
            startedAt: '9am',
          },
        });

        await this.prisma.last24SolvedTtmsPortfolio.create({
          data: {
            portfolio: oldPortfolio,
            startedAt: '9am',
          },
        });

        const totalDailyPriceChange095 = JSON.stringify(
          oldPortfolio.reduce((acc, portfolio) => {
            return acc + parseFloat(portfolio.dailyPriceChange095);
          }, 0) / oldPortfolio.length,
        );

        await this.prisma.averageTtmsPortfolioResults.deleteMany({
          where: {
            AND: [
              {
                OR: [
                  { createdAt: { gte: todayStartOfDay } },
                  { createdAt: { lt: monthAgo } },
                ],
              },
              {
                startedAt: '9am',
              },
            ],
          },
        });

        await this.prisma.averageTtmsPortfolioResults.create({
          data: {
            average24Result: totalDailyPriceChange095,
            startedAt: '9am',
          },
        });

        await this.prisma.ttmsPortfolio.deleteMany({
          where: {
            startedAt: '9am',
          },
        });

        const ttmsTop30At9am = await this.prisma.ttmsByHours.findFirst({
          where: {
            score9am: { not: null },
          },
          select: {
            score9am: true,
          },
        });

        const ttmsPortfolio9amData = Object.entries(
          ttmsTop30At9am.score9am,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          startedAt: '9am',
        }));

        await this.prisma.ttmsPortfolio.createMany({
          data: ttmsPortfolio9amData,
        });
      }

      if (hour === 21) {
        const oldPortfolio = await this.prisma.ttmsPortfolio.findMany({
          where: {
            startedAt: '9pm',
          },
        });

        oldPortfolio.forEach((portfolio) => {
          if (portfolio.dailyPriceChange095 === null) {
            const priceRatio =
              (parseFloat(portfolio.priceUSD) -
                parseFloat(portfolio.currentPrice) * 0.95) /
              (parseFloat(portfolio.priceUSD) / 100);

            if (
              parseFloat(portfolio.priceUSD) >=
              parseFloat(portfolio.currentPrice)
            ) {
              portfolio.dailyPriceChange095 = `+${priceRatio}`;
            } else {
              portfolio.dailyPriceChange095 = `-${priceRatio}`;
            }
          }
        });

        await this.prisma.last24SolvedTtmsPortfolio.deleteMany({
          where: {
            startedAt: '9pm',
          },
        });

        await this.prisma.last24SolvedTtmsPortfolio.create({
          data: {
            portfolio: oldPortfolio,
            startedAt: '9pm',
          },
        });

        const totalDailyPriceChange095 = JSON.stringify(
          oldPortfolio.reduce((acc, portfolio) => {
            return acc + parseFloat(portfolio.dailyPriceChange095);
          }, 0) / oldPortfolio.length,
        );

        await this.prisma.averageTtmsPortfolioResults.deleteMany({
          where: {
            AND: [
              {
                OR: [
                  { createdAt: { gte: todayStartOfDay } },
                  { createdAt: { lt: monthAgo } },
                ],
              },
              {
                startedAt: '9pm',
              },
            ],
          },
        });

        await this.prisma.averageTtmsPortfolioResults.create({
          data: {
            average24Result: totalDailyPriceChange095,
            startedAt: '9pm',
          },
        });

        await this.prisma.ttmsPortfolio.deleteMany({
          where: {
            startedAt: '9pm',
          },
        });

        const ttmsTop30At9pm = await this.prisma.ttmsByHours.findFirst({
          where: {
            score9pm: { not: null },
          },
          select: {
            score9pm: true,
          },
        });

        const ttmsPortfolio9pmData = Object.entries(
          ttmsTop30At9pm.score9pm,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          startedAt: '9pm',
        }));

        await this.prisma.ttmsPortfolio.createMany({
          data: ttmsPortfolio9pmData,
        });
      }

      const ttmsPortfolio = await this.prisma.ttmsPortfolio.findMany();

      // получаю адреса токенов, без повторений
      const tokenAddresses = [
        ...new Set(ttmsPortfolio.map((portfolio) => portfolio.tokenAddress)),
      ];

      const freshTokens = await this.prisma.tokens.findMany({
        where: {
          address: {
            in: tokenAddresses,
          },
        },
      });

      const updatedPortfolio = ttmsPortfolio.map((portfolio) => {
        const freshToken = freshTokens.find(
          (token) => token.address === portfolio.tokenAddress,
        );

        // производим вычисления по тем токенам, для которых мы еще не зафиксировали цену выхода
        if (freshToken && portfolio.dailyPriceChange095 === null) {
          portfolio.currentPrice = freshToken.priceUSD;
          // Новая цена больше той, с которой мы начали вычисления ?
          if (
            parseFloat(freshToken.priceUSD) >= parseFloat(portfolio.priceUSD)
          ) {
            // Новая цена Больше ATH ?
            if (parseFloat(freshToken.priceUSD) > parseFloat(portfolio.ATH)) {
              portfolio.ATH = freshToken.priceUSD;
            } else {
              // Новая цена меньше, чем ATH * 0,95 ?
              if (
                parseFloat(freshToken.priceUSD) <=
                parseFloat(portfolio.ATH) * 0.95
              ) {
                const dailyPercentage = JSON.stringify(
                  (parseFloat(portfolio.ATH) * 0.95 -
                    parseFloat(portfolio.priceUSD)) /
                    (parseFloat(portfolio.priceUSD) / 100),
                );
                portfolio.dailyPriceChange095 = `+${dailyPercentage}%`;
                portfolio.exitPrice = JSON.stringify(
                  parseFloat(portfolio.ATH) * 0.95,
                );
                // мы вышли
              }
            }
          } else {
            // Новая цена <= Цены на старте 24 часового цикла * 0,95 ?
            if (
              parseFloat(freshToken.priceUSD) <=
              parseFloat(portfolio.priceUSD) * 0.95
            ) {
              if (parseFloat(freshToken.priceUSD) < parseFloat(portfolio.ATL)) {
                portfolio.ATL = JSON.stringify(
                  parseFloat(portfolio.priceUSD) * 0.95,
                );
              }
              portfolio.dailyPriceChange095 = '-5%';
              portfolio.exitPrice = JSON.stringify(
                parseFloat(portfolio.priceUSD) * 0.95,
              );
              // мы вышли
            } else {
              if (parseFloat(freshToken.priceUSD) < parseFloat(portfolio.ATL)) {
                portfolio.ATL = freshToken.priceUSD;
              }
            }
          }
        }
        const { id, ...portfolioWithoutId } = portfolio;

        return portfolioWithoutId;
      });

      const { count: deletedCount } =
        await this.prisma.ttmsPortfolio.deleteMany();

      const { count: addedCount } = await this.prisma.ttmsPortfolio.createMany({
        data: updatedPortfolio,
      });

      return { deletedCount, addedCount };
    } catch (error) {
      return error;
    }
  }
}
