import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DefinedTokensService } from '../defined-tokens/defined-tokens.service';

@Injectable()
export class CronService {
  constructor(private readonly definedTokensService: DefinedTokensService) {}

  @Cron('0 * * * *') // начало каждого часа
  async handleCron() {
    try {
      const { deletedCount, addedCount } =
        await this.definedTokensService.handleTokens();
      console.log(
        `Cron job completed: ${deletedCount} tokens deleted, ${addedCount} tokens added.`,
      );
    } catch (error) {
      console.error('Cron job failed:', error);
    }
  }
}
