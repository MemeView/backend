import { UTCDate } from '@date-fns/utc';
import { HttpException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';
import { ttmsByHours } from './interfaces';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaClient) {}

  async ttmsForPartners(user: string, chainId: string) {
    const utcDate = new UTCDate();
    const pstDate = subHours(utcDate, 7);
    const currentHour = utcDate.getUTCHours();
    const currentPstHour = pstDate.getUTCHours();

    let pstInterval = 'score9am';

    if ((currentHour >= 0 && currentHour < 9) || currentHour >= 21) {
      pstInterval = 'score9pm';
    }

    if (chainId !== '0' && chainId !== '1' && chainId !== '2') {
      throw new HttpException('incorrect chain', 400);
    }

    if (chainId === '2') {
      chainId = '56';
    }

    const partner = await this.prisma.partners.findUnique({
      where: {
        partnerLogin: user,
      },
    });

    if (!partner) {
      throw new HttpException('partner does not exist', 400);
    }

    // let score = await this.prisma.score.findMany();
    const score = await this.prisma.ttmsByHours.findFirst({
      where: {
        [pstInterval]: { not: null },
      },
      select: {
        [pstInterval]: true,
        createdAt: true,
      },
    });

    let scoreResult = Object.values(score[pstInterval]).map(
      (value: {
        address: string;
        networkId: number;
        pairAddress: string;
        absoluteScore: number;
      }) => {
        return {
          tokenAddress: value.address,
          networkId: value.networkId,
          pairAddress: value.pairAddress,
          tokenScore: value.absoluteScore,
        };
      },
    );

    const tokens = await this.prisma.tokens.findMany();

    if (chainId !== '0') {
      scoreResult = scoreResult.filter(
        (e) => e.networkId === parseFloat(chainId),
      );
    }

    let ttms = await Promise.all(
      scoreResult.map(async (score) => {
        const token = await tokens.find(
          (token) => token.address === score.tokenAddress,
        );

        if (token) {
          if (token.networkId === 1) {
            chainId = '1';
          }
          if (token.networkId === 56) {
            chainId = '2';
          }
          return {
            address: token.address,
            pair: token.pairAddress,
            chainId: chainId,
            score: score.tokenScore,
            liquidity: token.liquidity,
          };
        }
      }),
    );

    ttms = ttms.filter((e) => e);

    if (chainId === '56') {
      chainId = '2';
    }

    const tokensResult = await ttms
      .sort((a, b) => {
        if (a.score === b.score) {
          return parseFloat(b.liquidity) - parseFloat(a.liquidity);
        } else {
          return b.score - a.score;
        }
      })
      .map((token) => {
        return {
          address: token.address,
          pair: token.pair,
          chainId: token.chainId,
        };
      });

    return {
      tokens: tokensResult.slice(0, 30),
      date: score.createdAt,
    };
  }
}
