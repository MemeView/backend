import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { DefinedTokensService } from './defined-tokens.service';

@Controller('api/defined-tokens-sync')
export class DefinedTokensController {
  constructor(private readonly definedTokensService: DefinedTokensService) {}

  @Get()
  async getDefinedTokens(@Res() response: Response) {
    try {
      const { deletedCount, addedCount } =
        await this.definedTokensService.handleTokens();
      response.status(200).json({ deletedCount, addedCount });
    } catch (e) {
      console.error('Error', e);
      response.status(400).json({ error: e.message });
    }
  }
}
