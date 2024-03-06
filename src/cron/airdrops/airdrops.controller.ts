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

      const result = await this.airdropsService.participateInAirdrop(
        walletAddress,
        airdropName,
        response,
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

      const result =
        await this.airdropsService.checkAirdropRequirementsByParticipant(
          walletAddress,
          airdropName,
          response,
        );

      const {
        airdropName: participantAirdropName,
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

      const airdrops = await this.prisma.airdrops.findMany();
      const participantAirdrops =
        await this.prisma.airdropsParticipants.findMany({
          where: { walletAddress },
        });

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
          if (participant.airdropAchievedAt) {
            return response.status(200).json({
              ...airdrop,
              airdropAchieved: true,
            });
          } else {
            return response.status(200).json({
              ...airdrop,
              airdropAchieved: false,
            });
          }
        }
        return response.status(200).json({
          ...airdrop,
          airdropAchieved: false,
        });
      }

      const airdropsResult: airdropResult[] = [];

      airdrops.forEach((airdrop) => {
        const currentAirdrop = participantAirdrops.find(
          (participant) => participant.airdropName === airdrop.airdropName,
        );

        if (currentAirdrop && currentAirdrop.airdropAchievedAt !== null) {
          airdropsResult.push({
            ...airdrop,
            airdropAchieved: true,
          });
        } else {
          airdropsResult.push({
            ...airdrop,
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
