import { UTCDate } from '@date-fns/utc';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getDate, getMonth, getYear, startOfDay, subDays } from 'date-fns';

type IntervalType = 24 | 48;

@Injectable()
export class TtmsPortfolioService {
  constructor(private readonly prisma: PrismaClient) {}

  async convertFromScientificNotation(numberString: string): Promise<string> {
    if (numberString.includes('e')) {
      const [base, exponent] = numberString.split('e');
      const parsedNumber = parseFloat(base) * Math.pow(10, parseInt(exponent));
      return parsedNumber.toFixed(20).replace(/0+$/, '').replace(/\.+$/, '');
    } else {
      return numberString;
    }
  }

  async handleTtmsPortfolio(hour: number) {
    try {
      const utcDate = new UTCDate();
      const todayStartOfDay = startOfDay(utcDate);
      const monthAgo = subDays(utcDate, 30);
      const yesterday = subDays(utcDate, 1);

      if (hour === 9) {
        const oldPortfolio = await this.prisma.ttmsPortfolio.findMany({
          where: {
            AND: [
              { startedAt: '9am' },
              {
                OR: [
                  { interval: 24 },
                  { AND: [{ interval: 48 }, { intervalCheck: 1 }] },
                ],
              },
            ],
          },
        });

        if (oldPortfolio.length > 0) {
          oldPortfolio.forEach((portfolio) => {
            if (!portfolio.currentPrice) {
              portfolio.currentPrice = portfolio.priceUSD;
            }

            if (portfolio.dailyPriceChange095 === null) {
              const priceRatio =
                (parseFloat(portfolio.currentPrice) -
                  parseFloat(portfolio.priceUSD)) /
                (parseFloat(portfolio.priceUSD) / 100);

              portfolio.dailyPriceChange095 = priceRatio.toFixed(2);
              portfolio.exitPrice = portfolio.currentPrice;
            }
          });

          const oldPortfolio24 = oldPortfolio.filter(
            (item) => item.interval === 24,
          );

          const oldPortfolio48 = oldPortfolio.filter(
            (item) => item.interval === 48 && item.intervalCheck === 1,
          );

          await this.prisma.last24SolvedTtmsPortfolio.deleteMany({
            where: {
              startedAt: '9am',
            },
          });

          await this.prisma.last24SolvedTtmsPortfolio.create({
            data: {
              portfolio: oldPortfolio24,
              interval: 24,
              startedAt: '9am',
            },
          });

          await this.prisma.last24SolvedTtmsPortfolio.create({
            data: {
              portfolio: oldPortfolio48,
              interval: 48,
              startedAt: '9am',
            },
          });

          const totalDailyPriceChange095By24h = JSON.stringify(
            oldPortfolio24.reduce((acc, portfolio) => {
              return acc + parseFloat(portfolio.dailyPriceChange095);
            }, 0) / 30,
          );

          const totalDailyPriceChange095By48h = JSON.stringify(
            oldPortfolio48.reduce((acc, portfolio) => {
              return acc + parseFloat(portfolio.dailyPriceChange095);
            }, 0) / 30,
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
              average24Result: totalDailyPriceChange095By24h,
              average48Result: totalDailyPriceChange095By48h,
              startedAt: '9am',
            },
          });
        }

        await this.prisma.ttmsPortfolio.deleteMany({
          where: {
            AND: [
              { startedAt: '9am' },
              {
                OR: [
                  { interval: 24 },
                  { AND: [{ interval: 48 }, { intervalCheck: 1 }] },
                ],
              },
            ],
          },
        });

        await this.prisma.ttmsPortfolio.updateMany({
          where: {
            AND: [{ intervalCheck: null }, { startedAt: '9am' }],
          },
          data: {
            intervalCheck: 1,
          },
        });

        const ttmsTop30At9am = await this.prisma.ttmsByHours.findFirst({
          where: {
            score9am: { not: null },
          },
          select: {
            score9am: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const ttmsPortfolio9amData24 = Object.entries(
          ttmsTop30At9am.score9am,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          symbol: value.symbol,
          pairAddress: value.pairAddress,
          quoteToken: value.quoteToken,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          networkId: value.networkId,
          image: value.image,
          liquidityTokenSymbol: value.liquidityTokenSymbol,
          liquidityTokenAddress: value.liquidityTokenAddress,
          interval: 24,
          startedAt: '9am',
        }));

        const ttmsPortfolio9amData48 = Object.entries(
          ttmsTop30At9am.score9am,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          symbol: value.symbol,
          pairAddress: value.pairAddress,
          quoteToken: value.quoteToken,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          networkId: value.networkId,
          image: value.image,
          liquidityTokenSymbol: value.liquidityTokenSymbol,
          liquidityTokenAddress: value.liquidityTokenAddress,
          interval: 48,
          startedAt: '9am',
        }));

        const ttmsPortfolio9amData = ttmsPortfolio9amData24.concat(
          ttmsPortfolio9amData48,
        );

        await this.prisma.ttmsPortfolio.createMany({
          data: ttmsPortfolio9amData,
        });
      }

      if (hour === 21) {
        const oldPortfolio = await this.prisma.ttmsPortfolio.findMany({
          where: {
            AND: [
              { startedAt: '9pm' },
              {
                OR: [
                  { interval: 24 },
                  { AND: [{ interval: 48 }, { intervalCheck: 1 }] },
                ],
              },
            ],
          },
        });

        if (oldPortfolio.length > 0) {
          oldPortfolio.forEach((portfolio) => {
            if (!portfolio.currentPrice) {
              portfolio.currentPrice = portfolio.priceUSD;
            }

            if (portfolio.dailyPriceChange095 === null) {
              const priceRatio =
                (parseFloat(portfolio.currentPrice) -
                  parseFloat(portfolio.priceUSD)) /
                (parseFloat(portfolio.priceUSD) / 100);

              portfolio.dailyPriceChange095 = priceRatio.toFixed(2);
              portfolio.exitPrice = portfolio.currentPrice;
            }
          });

          const oldPortfolio24 = oldPortfolio.filter(
            (item) => item.interval === 24,
          );

          const oldPortfolio48 = oldPortfolio.filter(
            (item) => item.interval === 48 && item.intervalCheck === 1,
          );

          await this.prisma.last24SolvedTtmsPortfolio.deleteMany({
            where: {
              startedAt: '9pm',
            },
          });

          await this.prisma.last24SolvedTtmsPortfolio.create({
            data: {
              portfolio: oldPortfolio24,
              interval: 24,
              startedAt: '9pm',
            },
          });

          await this.prisma.last24SolvedTtmsPortfolio.create({
            data: {
              portfolio: oldPortfolio48,
              interval: 48,
              startedAt: '9pm',
            },
          });

          const totalDailyPriceChange095By24h = JSON.stringify(
            oldPortfolio24.reduce((acc, portfolio) => {
              return acc + parseFloat(portfolio.dailyPriceChange095);
            }, 0) / 30,
          );

          const totalDailyPriceChange095By48h = JSON.stringify(
            oldPortfolio48.reduce((acc, portfolio) => {
              return acc + parseFloat(portfolio.dailyPriceChange095);
            }, 0) / 30,
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
              average24Result: totalDailyPriceChange095By24h,
              average48Result: totalDailyPriceChange095By48h,
              startedAt: '9pm',
            },
          });
        }

        await this.prisma.ttmsPortfolio.deleteMany({
          where: {
            AND: [
              { startedAt: '9pm' },
              {
                OR: [
                  { interval: 24 },
                  { AND: [{ interval: 48 }, { intervalCheck: 1 }] },
                ],
              },
            ],
          },
        });

        await this.prisma.ttmsPortfolio.updateMany({
          where: {
            AND: [{ intervalCheck: null }, { startedAt: '9pm' }],
          },
          data: {
            intervalCheck: 1,
          },
        });

        const ttmsTop30At9pm = await this.prisma.ttmsByHours.findFirst({
          where: {
            score9pm: { not: null },
          },
          select: {
            score9pm: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const ttmsPortfolio9pmData24 = Object.entries(
          ttmsTop30At9pm.score9pm,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          symbol: value.symbol,
          pairAddress: value.pairAddress,
          quoteToken: value.quoteToken,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          networkId: value.networkId,
          image: value.image,
          liquidityTokenSymbol: value.liquidityTokenSymbol,
          liquidityTokenAddress: value.liquidityTokenAddress,
          interval: 24,
          startedAt: '9pm',
        }));

        const ttmsPortfolio9pmData48 = Object.entries(
          ttmsTop30At9pm.score9pm,
        ).map(([key, value]) => ({
          tokenAddress: value.address,
          symbol: value.symbol,
          pairAddress: value.pairAddress,
          quoteToken: value.quoteToken,
          priceUSD: value.priceUSD,
          ATH: value.priceUSD,
          ATL: value.priceUSD,
          currentPrice: value.currentPrice,
          networkId: value.networkId,
          image: value.image,
          liquidityTokenSymbol: value.liquidityTokenSymbol,
          liquidityTokenAddress: value.liquidityTokenAddress,
          interval: 48,
          startedAt: '9pm',
        }));

        const ttmsPortfolio9pmData = ttmsPortfolio9pmData24.concat(
          ttmsPortfolio9pmData48,
        );

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
            parseFloat(freshToken.priceUSD) > parseFloat(portfolio.priceUSD)
          ) {
            // если с момента A0 цена начала расти, то фиксируем stopLoss на -5% на будущее
            if (portfolio.stopLoss === null) {
              portfolio.stopLoss = '-5';
            }
            // Новая цена Больше ATH ?
            if (parseFloat(freshToken.priceUSD) > parseFloat(portfolio.ATH)) {
              portfolio.ATH = freshToken.priceUSD;
            } else {
              const stopLoss = (100 + parseFloat(portfolio.stopLoss)) / 100;
              // Новая цена меньше, чем ATH * stopLoss ?
              if (
                parseFloat(freshToken.priceUSD) <=
                parseFloat(portfolio.ATH) * stopLoss
              ) {
                const dailyPercentage = JSON.stringify(
                  (parseFloat(portfolio.ATH) * stopLoss -
                    parseFloat(portfolio.priceUSD)) /
                    (parseFloat(portfolio.priceUSD) / 100),
                );
                portfolio.dailyPriceChange095 = dailyPercentage;
                portfolio.exitPrice = JSON.stringify(
                  parseFloat(portfolio.ATH) * stopLoss,
                );
                // мы вышли
              }
            }
          } else {
            // если с момента A0 цена начала падать, то фиксируем stopLoss на -3% на будущее
            if (portfolio.stopLoss === null) {
              portfolio.stopLoss = '-3';
            }

            const stopLoss = (100 + parseFloat(portfolio.stopLoss)) / 100;

            // Новая цена <= Цены на старте 24 часового цикла * stopLoss ?
            if (
              parseFloat(freshToken.priceUSD) <=
              parseFloat(portfolio.priceUSD) * stopLoss
            ) {
              if (parseFloat(freshToken.priceUSD) < parseFloat(portfolio.ATL)) {
                portfolio.ATL = JSON.stringify(
                  parseFloat(portfolio.priceUSD) * stopLoss,
                );
              }
              portfolio.dailyPriceChange095 = portfolio.stopLoss;
              portfolio.exitPrice = JSON.stringify(
                parseFloat(portfolio.priceUSD) * stopLoss,
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
