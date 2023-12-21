import { Query, Controller, Get } from '@nestjs/common';
import { ExcelService } from './excel.service';

@Controller('api')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Get('/excel')
  public async writeToExcel(@Query('date') dateStr: string): Promise<string> {
    try {
      await this.excelService.getAllTokens(dateStr);

      return 'Ok';
    } catch (error) {
      return error;
    }
  }
}
