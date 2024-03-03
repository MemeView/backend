import { TokenFilterResult } from '@definedfi/sdk/dist/resources/graphql';

export const getNameOfTheSecondPair = (
  quoteToken: TokenFilterResult['quoteToken'],
  pair: TokenFilterResult['pair'],
) => {
  const quoteTokenNumber = Number(quoteToken?.replace(/\D/g, ''));
  const pairTokenNumber = quoteTokenNumber === 0 ? 1 : 0;

  return pair?.[`token${pairTokenNumber}Data`]?.symbol || '???';
};
