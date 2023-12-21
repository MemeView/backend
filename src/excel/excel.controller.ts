import { Query, Controller, Get, StreamableFile, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExcelService } from './excel.service';

@Controller('api')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Get('/excel')
  public async writeToExcel(
    @Query('date') dateStr: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    try {
      const buffer = await this.excelService.getExcelTokens(dateStr);

      response.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tokens.xlsx"`,
      });

      return new StreamableFile(buffer);
    } catch (error) {
      return error;
    }
  }
}
