import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AirdropsService } from './airdrops.service';
import { AirdropsController } from './airdrops.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { RefreshMiddleware } from 'src/auth/refresh-jwt.middleware';

@Module({
  providers: [AirdropsService, AuthService, JwtService],
  controllers: [AirdropsController],
})
export class AirdropsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RefreshMiddleware)
      .forRoutes(
        'api/check-participation-in-airdrop',
        'api/participate-in-airdrop',
        'api/check-airdrop-requirements',
        'api/airdrop-progress',
        'api/airdrop',
      );
  }
}
