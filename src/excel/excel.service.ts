import {
  Injectable,
  InternalServerErrorException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as moment from 'moment';

@Injectable()
export class ExcelService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  public async getExcelTokens(dateStr?: string): Promise<Buffer> {
    try {
      let lastTokenId = 0;
      let hasMore = true;

      const tokensData = [];

      const dateFilterStart = dateStr
        ? +moment(dateStr, 'DD.MM.YYYY').startOf('day').format('X')
        : undefined;
      const dateFilterEnd = +moment(dateStr, 'DD.MM.YYYY')
        .add(1, 'day')
        .startOf('day')
        .format('X');

      if (dateFilterStart === undefined) {
        throw new InternalServerErrorException('date is not found');
      }

      while (hasMore) {
        const batch = await this.prisma.tokens.findMany({
          where: {
            AND: [
              { createdAt: { gte: dateFilterStart } },
              { createdAt: { lt: dateFilterEnd } },
              { id: { gt: lastTokenId } },
            ],
          },
          select: {
            id: true,
            address: true,
            createdAt: true,
            symbol: true,
          },
          take: 200,
          orderBy: {
            id: 'asc',
          },
        });

        if (batch.length > 0) {
          tokensData.push(...batch);
          lastTokenId = batch[batch.length - 1].id;
        }

        hasMore = batch.length === 200;
      }

      return this.writeToExcel(tokensData);
    } catch (error) {
      throw new InternalServerErrorException(
        'error: data need to be in 21.12.2023 format',
      );
    }
  }

  private async writeToExcel(tokensData: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tokens');

    sheet.addRow(['Address', 'CreatedAt', 'Symbol']);

    tokensData.forEach((token) => {
      sheet.addRow([token.address, token.createdAt, token.symbol]);
    });

    const filePath = './src/excel/';
    console.log(`Данные успешно записаны`);

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }
}
