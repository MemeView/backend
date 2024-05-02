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

    if ((currentPstHour >= 0 && currentPstHour < 9) || currentPstHour >= 21) {
      pstInterval = 'score9pm';
    }

    if (
      chainId !== '0' &&
      chainId !== '1' &&
      chainId !== '56' &&
      chainId !== '8453' &&
      chainId !== '10' &&
      chainId !== '42161' &&
      chainId !== '43114' &&
      chainId !== '137' &&
      chainId !== '1399811149'
    ) {
      throw new HttpException('incorrect chain', 400);
    }

    const partner = await this.prisma.partners.findUnique({
      where: {
        partnerLogin: user,
      },
    });

    if (!partner) {
      throw new HttpException('partner does not exist', 400);
    }

    let scoreResult: {
      tokenAddress: string;
      networkId: number;
      pairAddress: string;
      tokenScore: number;
    }[];

    let score: any;
    if (
      partner.partnerAccess === 'plan1' ||
      partner.partnerAccess === 'plan2'
    ) {
      // let score = await this.prisma.score.findMany();
      score = await this.prisma.ttmsByHours.findFirst({
        where: {
          [pstInterval]: { not: null },
        },
        select: {
          [pstInterval]: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      scoreResult = Object.values(score[pstInterval]).map(
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
    }

    if (partner.partnerAccess === 'all') {
      score = await this.prisma.score.findMany();

      scoreResult = await score.map((token) => {
        return {
          tokenAddress: token.tokenAddress,
          networkId: token.networkId,
          pairAddress: token.pairAddress,
          tokenScore: token.tokenScore,
        };
      });
    }

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
            chainId = '56';
          }
          if (token.networkId === 8453) {
            chainId = '8453';
          }
          if (token.networkId === 10) {
            chainId = '10';
          }
          if (token.networkId === 42161) {
            chainId = '42161';
          }
          if (token.networkId === 43114) {
            chainId = '43114';
          }
          if (token.networkId === 137) {
            chainId = '137';
          }
          if (token.networkId === 1399811149) {
            chainId = '1399811149';
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

    let date = utcDate;
    if (partner.partnerAccess !== 'all') {
      date = score.createdAt;
    }

    return {
      tokens: tokensResult.slice(0, 30),
      date,
    };
  }
}
