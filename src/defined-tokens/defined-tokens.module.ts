import { Module } from '@nestjs/common';
import { DefinedTokensController } from './defined-tokens.controller';
import { DefinedTokensService } from './defined-tokens.service';

@Module({
  controllers: [DefinedTokensController],
  providers: [DefinedTokensService],
})
export class DefinedTokensModule {}
