import { Module } from '@nestjs/common';
import { VotesSyncController } from './votes-sync.controller';
import { VotesSyncService } from './votes-sync.service';

@Module({
  controllers: [VotesSyncController],
  providers: [VotesSyncService],
})
export class VotesSyncModule {}
