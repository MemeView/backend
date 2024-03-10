import { MiddlewareConsumer, Module } from '@nestjs/common';
import { EventTrackerService } from './event-tracker.service';
import { EventTrackerController } from './event-tracker.controller';
import { RefreshMiddleware } from 'src/auth/refresh-jwt.middleware';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [EventTrackerService, AuthService, JwtService],
  controllers: [EventTrackerController],
})
export class EventTrackerModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RefreshMiddleware).forRoutes('api/event-tracker');
  }
}
