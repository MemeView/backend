import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';

@Injectable()
export class RefreshMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly authService: AuthService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const accessToken = req.cookies['accessToken'];

    if (!accessToken) {
      throw new UnauthorizedException('Access token not found');
    }

    const utcDate = new Date();

    try {
      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const accessTokenExpirationDate = new Date(decodedAccessToken.exp * 1000);

      if (accessTokenExpirationDate < utcDate) {
        const refreshToken = await this.prisma.users.findUnique({
          where: {
            walletAddress: decodedAccessToken.walletAddress,
          },
          select: {
            refreshToken: true,
            refreshTokenCreatedAt: true,
          },
        });

        if (!refreshToken) {
          throw new UnauthorizedException('Refresh token not found');
        }

        const decodedRefreshToken = jwt.verify(
          refreshToken.refreshToken,
          process.env.JWT_SECRET,
        ) as {
          walletAddress: string;
          exp: number;
        };

        const refreshTokenExpirationDate = new Date(
          decodedRefreshToken.exp * 1000,
        );

        if (refreshTokenExpirationDate < utcDate) {
          throw new UnauthorizedException('Refresh token expired');
        }

        // Обновление токенов
        const refreshedTokens = await this.authService.refreshTokens(
          refreshToken.refreshToken,
          res,
        );

        // Получение нового access token
        const newAccessToken = refreshedTokens.accessToken;
        const newRefreshToken = refreshedTokens.refreshToken;

        await this.prisma.users.update({
          where: {
            walletAddress: decodedAccessToken.walletAddress,
          },
          data: {
            refreshToken: newRefreshToken,
          },
        });

        // Устанавливаем новый access token в заголовке авторизации
        req.headers['authorization'] = `Bearer ${newAccessToken}`;

        res.cookie('accessToken', newAccessToken, {
          httpOnly: true,
        });

        req.cookies['accessToken'] = newAccessToken;
      }
    } catch (error) {
      throw new UnauthorizedException();
    }

    next();
  }
}
