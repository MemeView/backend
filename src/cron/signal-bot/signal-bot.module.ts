import { MiddlewareConsumer, Module } from '@nestjs/common';
import { SignalBotService } from './signal-bot.service';
import { SignalBotController } from './signal-bot.controller';
import { RefreshMiddleware } from 'src/auth/refresh-jwt.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Module({
  providers: [
    SignalBotService,
    AuthService,
    JwtService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  controllers: [SignalBotController],
  exports: [SignalBotService],
})
export class SignalBotModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RefreshMiddleware)
      .forRoutes(
        'api/check-subscription-to-channel',
        'api/check-user-has-voted',
      );
  }
}
