import { Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { DefinedTokensService } from './defined-tokens.service';
import { GraphqlService } from '../../graphql/graphql.service';

@Controller('api')
export class DefinedTokensController {
  constructor(private readonly definedTokensService: DefinedTokensService) {}

  @Get()
  async getDefinedTokens(@Res() response: Response) {
    try {
      let totalDeletedCount = 0;
      let totalAddedCount = 0;

      for (let i = 1; i <= 6; i++) {
        const networkId = 1;
        const { deletedCount, addedCount } =
          await this.definedTokensService.handleTokens(i, networkId);
        totalDeletedCount += deletedCount;
        totalAddedCount += addedCount;
      }
      response.status(200).json({ totalDeletedCount, totalAddedCount });
    } catch (e) {
      console.error('Error', e);
      response.status(400).json({ error: e.message });
    }
  }

  @Post('/defined-tokenwatch')
  async handleTokenWatch() {
    const result = await this.definedTokensService.handleTokenWatch();

    return result;
  }
}
