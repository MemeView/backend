import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';
import { Request, Response } from 'express';

@Injectable()
export class EventTrackerService {
  constructor(private readonly prisma: PrismaClient) {}

  async eventTracker(walletAddress: string, track: string) {
    const now = new Date();
    const EightHoursAgo = subHours(now, 8);

    if (walletAddress && track === 'visit') {
      const user = await this.prisma.users.findFirst({
        where: {
          AND: [{ walletAddress }, { updatedAt: { lte: EightHoursAgo } }],
        },
      });

      if (user) {
        await this.prisma.users.update({
          where: { walletAddress },
          data: { updatedAt: now, votes: { increment: 5 } },
        });

        return {
          success: true,
          message: `User have successfully updated the number of votes`,
        };
      }

      return {
        success: true,
        message: 'Ok',
      };
    }

    return {
      success: false,
      message: `walletAddress is not provided or track status is wrong`,
    };
  }
}
