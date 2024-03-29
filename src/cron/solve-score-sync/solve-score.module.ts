import { MiddlewareConsumer, Module } from '@nestjs/common';
import { SolveScoreController } from './solve-score.controller';
import { SolveScoreService } from './solve-score.service';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RefreshMiddleware } from 'src/auth/refresh-jwt.middleware';
import { SignalBotService } from '../signal-bot/signal-bot.service';
import { SignalBotModule } from '../signal-bot/signal-bot.module';

@Module({
  controllers: [SolveScoreController],
  providers: [
    SolveScoreService,
    AuthService,
    JwtService,
    JwtAuthGuard,
    // SignalBotService,
  ],
  imports: [SignalBotModule],
})
export class SolveScoreModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RefreshMiddleware).forRoutes('api/ttms-by-hours');
  }
}
