import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class BlackListService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  public async addTokenToBlacklist(tokenAddress: string): Promise<void> {
    try {
      await this.prisma.blacklist.create({
        data: {
          tokenAddress,
        },
      });
    } catch (error) {
      if (
        await this.prisma.blacklist.findUnique({
          where: { tokenAddress },
        })
      ) {
        throw new InternalServerErrorException(
          'TokenAdress already in blacklist',
        );
      }
      throw new InternalServerErrorException(error);
    }
  }

  public async deleteTokenFromBlacklist(tokenAddress: string): Promise<void> {
    try {
      await this.prisma.blacklist.delete({
        where: {
          tokenAddress,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(error);
    }
  }
}
