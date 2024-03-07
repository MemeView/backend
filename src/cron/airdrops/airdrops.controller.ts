import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AirdropsService } from './airdrops.service';
import { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as jwt from 'jsonwebtoken';
import { UTCDate } from '@date-fns/utc';
import { differenceInDays, parseISO } from 'date-fns';

interface airdropResult {
  id: number;
  airdropName: string;
  usersLimit: number;
  currentProgress: number;
  status: string;
  participates: boolean;
  daysLeftTillCompletion: number;
  airdropAchieved: boolean;
}

@Controller('/api')
export class AirdropsController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly airdropsService: AirdropsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/participate-in-airdrop')
  async participateInAirdrop(
    @Req() request: Request,
    @Res() response: Response,
    @Body('airdropName') airdropName: string,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const participates = await this.prisma.airdropsParticipants.findUnique({
        where: {
          walletAddress_airdropName: {
            walletAddress,
            airdropName,
          },
        },
      });

      if (participates) {
        return response.status(409).json({
          error: 'You are already participating in this airdrop',
        });
      }

      const airdrop = await this.prisma.airdrops.findUnique({
        where: {
          airdropName,
        },
      });

      if (!airdrop) {
        return response.status(404).json({
          error: 'Airdrop not found',
        });
      }

      if (
        airdrop &&
        (airdrop.status === 'completed' ||
          airdrop.currentProgress >= airdrop.usersLimit)
      ) {
        return response.status(400).json({
          error:
            'Error. This airdrop has been finished. You can’t participate in it',
        });
      }

      const participant = await this.prisma.airdropsParticipants.create({
        data: {
          walletAddress,
          airdropName,
        },
      });

      const result = await this.airdropsService.participateInAirdrop(
        walletAddress,
        airdropName,
        response,
        participant,
      );

      return response.status(200).json({
        participant: result,
      });
    } catch (error) {
      // ошибка, если пользователь пытается повторно участвовать в аирдропе
      if (error.message.includes('Unique constraint failed')) {
        return response.status(409).json({
          error: 'You are already participating in this airdrop',
        });
      }
      // Другие ошибки
      return response.status(400).json({
        error: error.message,
      });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/check-participation-in-airdrop')
  async checkSubscriptionToChannel(
    @Req() request: Request,
    @Res() response: Response,
    @Query('airdropName') airdropName: string,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const result = await this.airdropsService.checkParticipationInAirdrop(
        walletAddress,
        airdropName,
      );

      return response.status(200).json({
        airdropName,
        participant: result,
      });
    } catch (e) {
      return response.status(400).json({
        error: e.message,
      });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/check-airdrop-requirements')
  async checkAirdropRequirements(
    @Req() request: Request,
    @Res() response: Response,
    @Query('airdropName') airdropName: string,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const participant = await this.prisma.airdropsParticipants.findUnique({
        where: {
          walletAddress_airdropName: {
            walletAddress,
            airdropName,
          },
        },
      });

      const result =
        await this.airdropsService.checkAirdropRequirementsByParticipant(
          walletAddress,
          airdropName,
          response,
          participant,
        );

      const {
        airdropName: participantAirdropName,
        airdropAchievedAt,
        ...resultWithoutAirdropName
      } = result;

      return response.status(200).json({
        airdropName: participantAirdropName,
        airdropRequirements: resultWithoutAirdropName,
      });
    } catch (e) {
      return response.status(400).json({
        error: e.message,
      });
    }
  }

  @Get('/check-airdrop-requirements-cron')
  async checkAirdropRequirementsCron(
    @Req() request: Request,
    @Res() response: Response,
    @Query('airdropName') airdropName: string,
  ) {
    try {
      const result = await this.airdropsService.checkAirdropRequirementsCron(
        airdropName,
      );

      return response.status(200).json({
        result,
      });
    } catch (e) {
      return response.status(400).json({
        error: e.message,
      });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/airdrop')
  async checkAirdropsList(
    @Req() request: Request,
    @Res() response: Response,
    @Query('airdropName') airdropName: string,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const airdrops = await this.prisma.airdrops.findMany({
        orderBy: {
          id: 'asc',
        },
      });

      airdrops.forEach(async (airdrop) => {
        const currentProgress = await this.prisma.airdropsParticipants.findMany(
          {
            where: {
              AND: [{ airdropName }, { airdropAchievedAt: { not: null } }],
            },
          },
        );

        if (currentProgress.length >= airdrop.usersLimit) {
          if (airdrop.status !== 'completed') {
            await this.prisma.airdrops.update({
              where: {
                airdropName,
              },
              data: {
                currentProgress: currentProgress.length,
                status: 'completed',
              },
            });
          }
        }
      });
      const participantAirdrops =
        await this.prisma.airdropsParticipants.findMany({
          where: { walletAddress },
        });

      const utcDate = new UTCDate();
      const currentDate = new Date(utcDate);

      if (airdropName) {
        const participant = participantAirdrops.find(
          (e) => e.airdropName === airdropName,
        );
        const airdrop = airdrops.find((e) => e.airdropName === airdropName);

        if (!airdrop) {
          return response.status(400).json({
            error: 'Airdrop not found',
          });
        }

        if (participant && airdrop) {
          let daysLeftTillCompletion = 30;
          if (participant.planActivatedAt !== null) {
            const planActivationDate = new Date(participant.planActivatedAt);

            const daysPassedTillCompletion = differenceInDays(
              parseISO(currentDate.toISOString()),
              parseISO(planActivationDate.toISOString()),
            );

            daysLeftTillCompletion = 30 - daysPassedTillCompletion;

            if (daysLeftTillCompletion <= 0) {
              daysLeftTillCompletion = 0;
            }
          }

          if (participant.airdropAchievedAt) {
            return response.status(200).json({
              ...airdrop,
              participates: true,
              daysLeftTillCompletion: 0,
              airdropAchieved: true,
            });
          } else {
            return response.status(200).json({
              ...airdrop,
              participates: true,
              daysLeftTillCompletion,
              airdropAchieved: false,
            });
          }
        }
        return response.status(200).json({
          ...airdrop,
          participates: false,
          daysLeftTillCompletion: 30,
          airdropAchieved: false,
        });
      }

      const airdropsResult: airdropResult[] = [];

      airdrops.forEach((airdrop) => {
        const currentAirdrop = participantAirdrops.find(
          (participant) => participant.airdropName === airdrop.airdropName,
        );

        if (currentAirdrop) {
          let daysLeftTillCompletion = 30;
          if (currentAirdrop.planActivatedAt !== null) {
            const planActivationDate = new Date(currentAirdrop.planActivatedAt);

            const daysPassedTillCompletion = differenceInDays(
              parseISO(currentDate.toISOString()),
              parseISO(planActivationDate.toISOString()),
            );

            daysLeftTillCompletion = 30 - daysPassedTillCompletion;

            if (daysLeftTillCompletion <= 0) {
              daysLeftTillCompletion = 0;
            }
          }

          if (currentAirdrop.airdropAchievedAt !== null) {
            airdropsResult.push({
              ...airdrop,
              participates: true,
              daysLeftTillCompletion: 0,
              airdropAchieved: true,
            });
          }
          if (currentAirdrop.airdropAchievedAt === null) {
            airdropsResult.push({
              ...airdrop,
              participates: true,
              daysLeftTillCompletion,
              airdropAchieved: false,
            });
          }
        }

        if (!currentAirdrop) {
          airdropsResult.push({
            ...airdrop,
            participates: false,
            daysLeftTillCompletion: 30,
            airdropAchieved: false,
          });
        }
      });

      return response.status(200).json({
        airdropsResult,
      });
    } catch (e) {
      return response.status(400).json({
        error: e.message,
      });
    }
  }
}
