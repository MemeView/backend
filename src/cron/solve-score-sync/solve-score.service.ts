import { Injectable } from '@nestjs/common';
import { PrismaClient, ScoreByHours } from '@prisma/client';
import { subDays, subHours, startOfDay } from 'date-fns';
import { IntRange } from '../../common.type';
import { UTCDate } from '@date-fns/utc';

type QueryResult = {
  tokenAddress: string;
  _count: number;
};

interface finalResults {
  tokenAddress: string;
  tokenScore: number;
  liquidity: string;
}

interface Result {
  tokenAddress: string;
  scoreFromVotes?: number;
  scoreFromChange24?: number;
  scoreFromVolume?: number;
}

interface Token {
  address: string;
  change24: string;
  symbol?: string;
}

interface Volume {
  tokenAddress: string;
  scoreFromVolume: number | null;
  scoreFromVotes?: number;
  scoreFromChange24?: number;
}

type ColumnName =
  | 'tokenScore0h'
  | 'tokenScore1h'
  | 'tokenScore2h'
  | 'tokenScore3h'
  | 'tokenScore4h'
  | 'tokenScore5h'
  | 'tokenScore6h'
  | 'tokenScore7h'
  | 'tokenScore8h'
  | 'tokenScore9h'
  | 'tokenScore10h'
  | 'tokenScore11h'
  | 'tokenScore12h'
  | 'tokenScore13h'
  | 'tokenScore14h'
  | 'tokenScore15h'
  | 'tokenScore16h'
  | 'tokenScore17h'
  | 'tokenScore18h'
  | 'tokenScore19h'
  | 'tokenScore20h'
  | 'tokenScore21h'
  | 'tokenScore22h'
  | 'tokenScore23h';

@Injectable()
export class SolveScoreService {
  constructor(private prisma: PrismaClient) {}

  // Функция для вычисления балла на основе изменения цены за 24 часа
  async calculateScore(change24: string) {
    const factor = parseFloat(change24) * 100;

    if (factor < -50) {
      return -15;
    }

    if (factor >= -50 && factor < -30) {
      // такая формула получилась из (factor - -50) * ((0 - -15) / (-30 - -50)) + -15
      return (factor + 50) * (15 / 20) - 15;
    }

    if (factor >= -30 && factor < 0) {
      return 0;
    }

    if (factor >= 0 && factor < 15) {
      return factor;
    }

    if (factor >= 15 && factor < 50) {
      return 15;
    }

    // формула строится из (Исходное значение - 50) * ((0 - 15) / (100 - 50)) + 15
    if (factor >= 50 && factor < 100) {
      return (factor - 50) * (-15 / 50) + 15;
    }

    if (factor >= 100 && factor < 400) {
      return (factor - 100) * (-15 / 300);
    }

    if (factor >= 400) {
      return -15;
    }
  }

  async solveScores() {
    const totalCount = await this.prisma.votes.count();

    // переменные для дат и времени
    const utcDate = new UTCDate();
    const today = startOfDay(utcDate);
    const yesterday = subDays(startOfDay(utcDate), 1);
    const twoDaysAgo = subDays(startOfDay(utcDate), 2);
    const sevenDaysAgo = subDays(utcDate, 7);
    const twentyFourHoursAgo = subHours(utcDate, 24);
    const currentTimestampInSeconds: number = Math.floor(
      utcDate.getTime() / 1000,
    );

    // возвращает голоса за 24 часа
    const resultToday = await this.prisma.votes.groupBy({
      by: ['tokenAddress'],
      where: { date: { gte: twentyFourHoursAgo } },
      _count: true,
    });

    // возвращает голоса от уникальных пользователей по каждому токену
    const resultTodayByVotersRaw = await this.prisma.votes.findMany({
      where: { date: { gte: twentyFourHoursAgo } },
      distinct: ['tokenAddress', 'walletAddress'],
      select: { tokenAddress: true, walletAddress: true },
    });

    // Группировка голосов за последние 24 часа по токенам и подсчет количества голосов от уникальных адресов
    const tokenCountsMap = resultTodayByVotersRaw.reduce((map, vote) => {
      const currentTokenAddress = vote.tokenAddress;
      const _count = map.get(currentTokenAddress) || 0;
      map.set(currentTokenAddress, _count + 1);
      return map;
    }, new Map());

    const resultTodayByVoters = Array.from(tokenCountsMap.entries()).map(
      ([currentTokenAddress, _count]) => ({
        tokenAddress: currentTokenAddress,
        _count,
      }),
    );

    // возвращает количество голосов за каждый токен за 7 дней.
    const resultSevenDays = await this.prisma.votes.groupBy({
      by: ['tokenAddress'],
      where: { date: { gte: sevenDaysAgo } },
      _count: true,
    });

    // возвращает volume за позавчера
    const resultTwoDaysAgo = await this.prisma.volume.findMany({
      where: {
        AND: [
          { volumeCreatedAt: { gte: twoDaysAgo } },
          { volumeCreatedAt: { lt: yesterday } },
        ],
      },
    });

    // возвращает volume за вчера
    const resultYesterday = await this.prisma.volume.findMany({
      where: {
        AND: [
          { volumeCreatedAt: { gte: yesterday } },
          { volumeCreatedAt: { lt: today } },
        ],
      },
    });

    const resultFromVolume: Array<Volume> = [];

    // Проходим по каждому токену, рассчитываем его объемы и добавляем в массив результатов
    resultTwoDaysAgo.forEach((tokenTwoDaysAgo) => {
      // Находим соответствующий токен за вчерашний день
      const tokenYesterday = resultYesterday.find(
        (token) => token.address === tokenTwoDaysAgo.address,
      );

      if (tokenYesterday) {
        const change24Percentage = parseFloat(tokenYesterday.change24) * 100;
        let volumeScore = 0;
        let volumePercentage = 0;

        if (
          parseFloat(tokenYesterday.volume24) >
          parseFloat(tokenTwoDaysAgo.volume24)
        ) {
          const volumeRatio =
            parseFloat(tokenYesterday.volume24) /
            parseFloat(tokenTwoDaysAgo.volume24);

          volumePercentage = volumeRatio * 100;
        }

        if (
          parseFloat(tokenYesterday.volume24) <
          parseFloat(tokenTwoDaysAgo.volume24)
        ) {
          const volumeRatio =
            parseFloat(tokenTwoDaysAgo.volume24) /
            parseFloat(tokenYesterday.volume24);

          volumePercentage = 0 - volumeRatio * 100;
        }

        if (change24Percentage >= -50) {
          if (volumePercentage < -50) {
            volumeScore -= 10;
          }

          if (volumePercentage >= -50 && volumePercentage < 0) {
            volumeScore += 3 - (0 - volumePercentage) * (3 / 50);
          }

          if (volumePercentage >= 0 && volumePercentage < 100) {
            volumeScore += 3 + volumePercentage * (7 / 100);
          }

          if (volumePercentage >= 100 && volumePercentage < 200) {
            volumeScore += 10;
          }

          if (volumePercentage >= 200 && volumePercentage < 300) {
            volumeScore += 10 - (volumePercentage - 200) * (10 / 100);
          }

          if (volumePercentage > 900) {
            volumeScore -= 10;
          }
        }

        if (change24Percentage < -50) {
          if (volumePercentage >= -50 && volumePercentage < 100) {
            volumeScore += 0 - (volumePercentage + 50) * (10 / 150);
          }

          if (volumePercentage >= 100) {
            volumeScore -= 10;
          }
        }
        resultFromVolume.push({
          tokenAddress: tokenTwoDaysAgo.address,
          scoreFromVolume: volumeScore,
        });
      }

      // ////////////////
      // if (tokenYesterday) {
      //   if (
      //     tokenYesterday &&
      //     tokenYesterday.volume24 !== null &&
      //     tokenTwoDaysAgo.volume24 !== null &&
      //     parseFloat(tokenYesterday.volume24) !== 0 &&
      //     parseFloat(tokenTwoDaysAgo.volume24) !== 0
      //   ) {
      //     let volumeRatio: number;
      //     // Рассчитываем отношение объема за два дня назад к объему за вчера
      //     if (
      //       parseFloat(tokenTwoDaysAgo.volume24) >
      //       parseFloat(tokenYesterday.volume24)
      //     ) {
      //       volumeRatio =
      //         parseFloat(tokenTwoDaysAgo.volume24) /
      //         parseFloat(tokenYesterday.volume24);
      //       const volumeScore =
      //         volumeRatio >= 4 ? 0 : (1 - volumeRatio / 4) * 10;
      //       if (tokenTwoDaysAgo.address != null && volumeScore !== 0) {
      //         // Добавляем результаты в массив
      //         resultFromVolume.push({
      //           tokenAddress: tokenTwoDaysAgo.address,
      //           scoreFromVolume: volumeScore,
      //         });
      //       }
      //     } else {
      //       if (
      //         parseFloat(tokenTwoDaysAgo.volume24) !=
      //         parseFloat(tokenYesterday.volume24)
      //       ) {
      //         // Рассчитываем отношение объема за вчера к объему за два дня назад
      //         volumeRatio =
      //           parseFloat(tokenYesterday.volume24) /
      //           parseFloat(tokenTwoDaysAgo.volume24);
      //         let volumeScore = volumeRatio >= 4 ? 10 : (volumeRatio / 4) * 10;
      //         volumeScore += 10;
      //         if (tokenTwoDaysAgo.address != null) {
      //           // Добавляем результаты в массив
      //           resultFromVolume.push({
      //             tokenAddress: tokenTwoDaysAgo.address,
      //             scoreFromVolume: volumeScore,
      //           });
      //         }
      //       } else {
      //         if (tokenTwoDaysAgo.address != null) {
      //           // Добавляем результаты в массив
      //           resultFromVolume.push({
      //             tokenAddress: tokenTwoDaysAgo.address,
      //             scoreFromVolume: 1,
      //           });
      //         }
      //       }
      //     }
      //   }
      //   // случай, когда токен имел нулевой объем, а потом вырос
      //   if (
      //     tokenYesterday &&
      //     tokenYesterday.volume24 !== null &&
      //     tokenTwoDaysAgo.volume24 !== null &&
      //     parseFloat(tokenYesterday.volume24) !== 0 &&
      //     parseFloat(tokenTwoDaysAgo.volume24) === 0
      //   ) {
      //     if (tokenTwoDaysAgo.address != null) {
      //       resultFromVolume.push({
      //         tokenAddress: tokenTwoDaysAgo.address,
      //         scoreFromVolume: 20,
      //       });
      //     }
      //   }
      // }
    });

    // Определяем количество воутеров за сегодня
    const uniqueVotersCountToday = new Set(
      resultTodayByVotersRaw.map((result) => result.walletAddress),
    ).size;

    // Вычисляем общее количество голосов за текущий день
    const totalCountToday = resultToday.reduce(
      (acc, row) => acc + row._count,
      0,
    );

    // Создаем объект для хранения количества голосов по каждому токену за текущий день
    const resultTodayObj: { [key: string]: number } = {};
    resultToday.forEach((r) => {
      resultTodayObj[r.tokenAddress] = r._count;
    });

    // Массивы для хранения результатов голосования за сегодня и за последние 7 дней
    const resultsFromVotesToday: Result[] = [];
    const resultsFromVotesSevenDays: Result[] = [];

    // Первый цикл - используется для вычисления сегодняшнего значения
    // Мы проходимся по массиву за 7 дней, потому что он самый полный
    resultSevenDays.forEach((row: QueryResult) => {
      let scoreForCurrentToken = 0;
      let uniqueVotersRatio = 0;
      const rowAddress = row.tokenAddress;
      // Находим информацию о голосовавших за текущий токен сегодня.
      const foundElement = resultTodayByVoters.find(
        (e) => e.tokenAddress === rowAddress,
      );

      if (uniqueVotersCountToday > 0 && foundElement) {
        // Вычисляем отношение уникальных воутеров к общему числу уникальных воутеров
        const uniqueVotersForCurrentToken = foundElement._count || 0;
        uniqueVotersRatio =
          (uniqueVotersForCurrentToken / uniqueVotersCountToday) * 100;
      }

      // Вычисляем баллы за воутеров за 1 день
      const votersScore =
        uniqueVotersRatio >= 8 ? 6 : (6 * uniqueVotersRatio) / 100;
      scoreForCurrentToken += votersScore;

      // Получаем количество голосов в целом за текущий токен за сегодня
      const countToday = resultTodayObj[row.tokenAddress] || 0;

      if (countToday >= 100) {
        // Вычисляем баллы от количества голосов за 1 день
        scoreForCurrentToken += 3;
      } else {
        scoreForCurrentToken += 3 * (countToday / 100);
      }

      const todayPercentage = totalCountToday
        ? (countToday / totalCountToday) * 100
        : 0;
      // Вычисляем баллы от общего количества голосов за 1 день
      if (todayPercentage >= 10) {
        scoreForCurrentToken += 6;
      } else {
        scoreForCurrentToken += (6 * todayPercentage) / 10;
      }

      // Добавляем результаты в массив для результатов сегодняшнего дня
      resultsFromVotesToday.push({
        tokenAddress: row.tokenAddress,
        scoreFromVotes: scoreForCurrentToken,
      });
    });

    // Второй цикл - используется для вычисления недельного значения
    resultSevenDays.forEach((row: QueryResult) => {
      let scoreForCurrentToken = 0;

      const countSevenDays = row._count;

      const sevenDaysPercentage = totalCount
        ? (countSevenDays / totalCount) * 100
        : 0;
      // Вычисляем баллы от общего количества голосов за последние 7 дней
      if (sevenDaysPercentage >= 5) {
        scoreForCurrentToken += 3;
      } else {
        scoreForCurrentToken += (3 * sevenDaysPercentage) / 5;
      }

      // Добавляем результаты в массив для последних 7 дней
      resultsFromVotesSevenDays.push({
        tokenAddress: row.tokenAddress,
        scoreFromVotes: scoreForCurrentToken,
      });
    });

    // Объединяем результаты голосования за сегодня и за последние 7 дней
    const combinedResultsFromVotes: Result[] = [
      ...resultsFromVotesToday,
      ...resultsFromVotesSevenDays,
    ];

    // Группируем результаты по адресам токенов
    const groupedResults: { [address: string]: Result } =
      combinedResultsFromVotes.reduce(
        (previous: { [address: string]: Result }, current) => {
          const found = previous[current.tokenAddress];

          if (found) {
            found.scoreFromVotes =
              (found.scoreFromVotes ?? 0) + (current.scoreFromVotes ?? 0);
          } else {
            previous[current.tokenAddress] = current;
            current.scoreFromVotes = current.scoreFromVotes ?? 0;
          }

          return previous;
        },
        {},
      );

    // Получаем окончательные результаты голосования
    const resultsFromVotes: Result[] = Object.values(groupedResults);

    // Получаем информацию о токенах с изменением цены за последние 24 часа
    const resultsFromChange24Raw = await this.prisma.tokens.findMany({
      select: {
        address: true,
        change24: true,
      },
      orderBy: {
        change24: 'desc',
      },
    });

    // Рассчитываем баллы для изменения цены за последние 24 часа
    const resultsFromChange24Promises = (resultsFromChange24Raw as Token[]).map(
      async (item) => {
        const score = await this.calculateScore(item.change24);
        const result: Result = {
          tokenAddress: item.address,
          scoreFromChange24: score || 0,
        };
        return result;
      },
    );

    const resultsFromChange24 = await Promise.all(resultsFromChange24Promises);

    const uniqueResultFromVolume = resultFromVolume.reduce<Result[]>(
      (unique, item) => {
        // Проверяем, есть ли уже такой tokenAddress в уникальном массиве
        const score =
          item.scoreFromVolume === null ? undefined : item.scoreFromVolume;

        const resultItem: Result = { ...item, scoreFromVolume: score };

        const exists = unique.some(
          (elem) => elem.tokenAddress === item.tokenAddress,
        );

        // Если tokenAddress на данный момент не существует в уникальном массиве,
        // добавляем и текущий элемент к уникальному массиву
        if (!exists) {
          unique.push(resultItem);
        }

        return unique;
      },
      [],
    );

    const uniqueResultFromChange24 = resultsFromChange24.reduce<Result[]>(
      (unique, item) => {
        // Проверяем, есть ли уже такой tokenAddress в уникальном массиве
        const score =
          item.scoreFromVolume === null ? undefined : item.scoreFromVolume;

        const resultItem: Result = { ...item, scoreFromVolume: score };

        const exists = unique.some(
          (elem) => elem.tokenAddress === item.tokenAddress,
        );

        // Если tokenAddress на данный момент не существует в уникальном массиве,
        // добавляем и текущий элемент к уникальному массиву
        if (!exists) {
          unique.push(resultItem);
        }

        return unique;
      },
      [],
    );

    const uniqueResultFromVotes = resultsFromVotes.reduce<Result[]>(
      (unique, item) => {
        // Проверяем, есть ли уже такой tokenAddress в уникальном массиве
        const score =
          item.scoreFromVolume === null ? undefined : item.scoreFromVolume;

        const resultItem: Result = { ...item, scoreFromVolume: score };

        const exists = unique.some(
          (elem) => elem.tokenAddress === item.tokenAddress,
        );

        // Если tokenAddress на данный момент не существует в уникальном массиве,
        // добавляем и текущий элемент к уникальному массиву
        if (!exists) {
          unique.push(resultItem);
        }

        return unique;
      },
      [],
    );

    // Объединяем результаты голосования, изменения цены и объема токенов
    const combinedResults = [
      ...uniqueResultFromVotes,
      ...uniqueResultFromChange24,
      ...uniqueResultFromVolume,
    ].reduce<{
      [key: string]: { score: number };
    }>((acc, val) => {
      if (!acc[val.tokenAddress]) {
        acc[val.tokenAddress] = { score: 0 };
      }

      acc[val.tokenAddress].score += val.scoreFromVotes
        ? val.scoreFromVotes
        : 0;
      acc[val.tokenAddress].score += val.scoreFromChange24
        ? val.scoreFromChange24
        : 0;
      acc[val.tokenAddress].score += val.scoreFromVolume
        ? val.scoreFromVolume
        : 0;

      return acc;
    }, {});

    // Преобразуем объединенные результаты в окончательные результаты
    let scoreFinalResults = Object.entries(combinedResults).map(
      ([tokenAddress, { score }]) => ({
        tokenAddress,
        tokenScore: score + 20, // +20 за 2theMoon
        liquidity: '',
      }),
    );

    // Получаем адреса токенов из окончательных результатов
    const finalResultsAddresses = scoreFinalResults.map(
      (item) => item.tokenAddress,
    );

    // Получаем информацию о токенах из базы данных, используя адреса из finalResultsAddresses
    const rawTokens = await this.prisma.tokens.findMany({
      where: { address: { in: finalResultsAddresses } },
      select: { address: true, liquidity: true, createdAt: true },
    });

    // Обновляем баллы для токенов в зависимости от их ликвидности
    scoreFinalResults.forEach((result) => {
      // Находим информацию о текущем токене в rawTokens
      const token = rawTokens.find(
        (item) => item.address === result.tokenAddress,
      );

      result.liquidity = token?.liquidity ?? '0';

      if (token && parseFloat(token.liquidity!) < 5000) {
        // Уменьшаем баллы для токенов с низкой ликвидностью
        result.tokenScore -= 99;
      }

      if (
        token &&
        parseFloat(token.liquidity!) >= 5000 &&
        parseFloat(token.liquidity!) < 10000
      ) {
        result.tokenScore += 1;
      }

      if (
        token &&
        parseFloat(token.liquidity!) >= 10000 &&
        parseFloat(token.liquidity!) < 50000
      ) {
        // Увеличиваем баллы для токенов с ликвидностью от 10000 до 50000
        result.tokenScore += 10;
      }

      if (
        token &&
        parseFloat(token.liquidity!) >= 50000 &&
        parseFloat(token.liquidity!) < 500000
      ) {
        // Увеличиваем баллы для токенов с ликвидностью от 50000 до 500000, учитывая изменение по формуле
        result.tokenScore +=
          10 - ((parseFloat(token.liquidity!) - 50000) * 9) / 450000;
      }

      if (token && parseFloat(token.liquidity!) >= 500000) {
        // Увеличиваем баллы для токенов с высокой ликвидностью (больше или равно 500000)
        result.tokenScore += 1;
      }

      // Уменьшаю баллы, если токену меньше 24 часов. Число 86400 это 24 часа в секундах
      if (token && currentTimestampInSeconds - token.createdAt < 86400) {
        result.tokenScore -= 40;
      }

      // Уменьшаю баллы, если токен был создан в промежутке между 24 часов и 48 часов.
      if (
        token &&
        currentTimestampInSeconds - token.createdAt >= 86400 &&
        currentTimestampInSeconds - token.createdAt < 172800
      ) {
        result.tokenScore -= 20;
      }

      // Уменьшаю баллы, если токен был создан в промежутке между 48 часов и 72 часов.
      if (
        token &&
        currentTimestampInSeconds - token.createdAt >= 172800 &&
        currentTimestampInSeconds - token.createdAt < 259200
      ) {
        result.tokenScore -= 10;
      }
    });

    // Фильтруем токены, оставляя только те, у которых баллы больше 0
    scoreFinalResults = scoreFinalResults.filter((item) => item.tokenScore > 0);

    // Объяснение, как я вывел формулу:

    // x1 = минимальное значение (30 000)
    // x2 = максимальное значение (300 000)
    // y1 = баллы, при минимальном значении (10)
    // y2 = баллы, при максимальном значении (1)
    // x3 = входное значение (к примеру, 150 000)

    // можем найти коэффицент наклона = (y2 - y1) / (x2 - x1)
    // и получим:

    // y3 = ((y2 - y1) / (x2 - x1)) * (x3 - x1) + y1
    // то есть, получаем:
    // y3 = ((1 - 10) / (300 000 - 30 000)) * (150 000 - 30 000) + 10
    // ответ: y3 = 6

    // чтобы код не ругался, что я делю на ноль, я чуть изменил формулу:
    // y = 10 - ((x - 30 000) * 9) / 270 000
    // при x = 150 000 получим 6 баллов

    // Очищаем таблицу с предыдущими результатами
    await this.prisma.score.deleteMany();
    // Записываем новые результаты в таблицу
    await this.prisma.score.createMany({ data: scoreFinalResults });

    return { scoreFinalResults };
  }

  public async handleScoreByHours(scoreFinalResults: finalResults[]) {
    const utcDate = new UTCDate();

    const currentHour = utcDate.getHours() as IntRange<0, 23>;

    const key: ColumnName = `tokenScore${currentHour}h`;

    console.log(`Копируем текущий TTMS в колонку ${key}`);

    const scoreByHoursTable = await this.prisma.scoreByHours.findMany();

    const scoreByHoursTableMap = new Map<string, Partial<ScoreByHours>>(
      scoreByHoursTable.map((item) => [item.tokenAddress, item]),
    );

    const ttmsScoreMap = new Map(
      scoreFinalResults.map((item) => [item.tokenAddress, item]),
    );

    ttmsScoreMap.forEach((updateItem: finalResults) => {
      if (scoreByHoursTableMap.has(updateItem.tokenAddress)) {
        scoreByHoursTableMap.set(updateItem.tokenAddress, {
          ...scoreByHoursTableMap.get(updateItem.tokenAddress),
          [key]: updateItem.tokenScore,
        });
      }

      if (!scoreByHoursTableMap.has(updateItem.tokenAddress)) {
        scoreByHoursTableMap.set(updateItem.tokenAddress, {
          tokenAddress: updateItem.tokenAddress,
          [key]: updateItem.tokenScore,
        });
      }
    });

    const tableArray = Array.from(scoreByHoursTableMap.entries()).map(
      ([tokenAddress, item]) => ({ tokenAddress, ...item }),
    );

    await this.prisma.scoreByHours.deleteMany();

    await this.prisma.scoreByHours.createMany({ data: tableArray });
  }

  async updateDailyScores() {
    const allScores = await this.prisma.scoreByHours.findMany();

    const averages = allScores
      .map((tokenData) => {
        const scores = [];
        for (let i = 0; i < 24; i++) {
          const score = tokenData[`tokenScore${i}h`];
          if (typeof score === 'number') {
            scores.push(score);
          }
        }

        if (scores.length >= 2) {
          const sum = scores.reduce((acc, curr) => acc + curr, 0);
          const averageScore = sum / scores.length;

          return {
            tokenAddress: tokenData.tokenAddress,
            averageScore: averageScore,
          };
        }

        return null;
      })
      .filter(Boolean);

    const chunkSize = 5;
    const chunks = [];
    for (let i = 0; i < averages.length; i += chunkSize) {
      const chunk = averages.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    const updateChunk = async (chunk) => {
      const updates = chunk.map(async (avgData) => {
        const { tokenAddress, averageScore } = avgData;

        const currentScores = await this.prisma.dailyScore.findUnique({
          where: { tokenAddress },
          select: {
            averageScore24Ago: true,
            averageScoreToday: true,
          },
        });

        if (!currentScores) {
          return this.prisma.dailyScore.create({
            data: {
              tokenAddress,
              averageScoreToday: averageScore,
              averageScore24Ago: null,
              averageScore48Ago: null,
            },
          });
        } else {
          return this.prisma.dailyScore.update({
            where: { tokenAddress },
            data: {
              averageScore48Ago: currentScores.averageScore24Ago, // предыдущее значение для 24Ago стало 48Ago
              averageScore24Ago: currentScores.averageScoreToday, // предыдущее значение для Today стало 24Ago
              averageScoreToday: averageScore, // новое значение
            },
          });
        }
      });

      const results = await Promise.all(updates);
      return results;
    };

    const chunkResults = [];
    for (const chunk of chunks) {
      const results = await updateChunk(chunk);
      chunkResults.push(results);
    }

    return 'ok';
  }
}
