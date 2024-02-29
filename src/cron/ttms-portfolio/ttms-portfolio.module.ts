import { Module } from '@nestjs/common';
import { TtmsPortfolioService } from './ttms-portfolio.service';
import { TtmsPortfolioController } from './ttms-portfolio.controller';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from 'src/auth/jwt.strategy';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Module({
  providers: [
    TtmsPortfolioService,
    AuthService,
    JwtService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  controllers: [TtmsPortfolioController],
})
export class TtmsPortfolioModule {}
