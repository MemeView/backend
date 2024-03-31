export interface portfolio {
  id: number;
  tokenAddress: string;
  symbol: string;
  priceUSD: string;
  startedAt: string;
  ATH?: string;
  ATL?: string;
  dailyPriceChange095?: string;
  currentPrice?: string;
  exitPrice?: string;
  quoteToken?: string;
  pairAddress?: string;
  networkId?: number;
  image?: string;
  liquidityTokenSymbol?: string;
  liquidityTokenAddress?: string;
  stopLoss?: string;
  interval?: number;
  intervalCheck?: number;
}

export interface resultToken {
  tokenAddress: string;
  ttms: number;
  startPrice: string;
  exitPrice: string;
  resultPercentage: string;
  priceGrowthPercentageFor24h: string;
  priceGrowthPercentageFor24hScore: number;
  votesFor24: number;
  votesFor24Score: number;
  votersPercentageFor24: number;
  votersPercentageFor24Score: number;
  votesPercentageFor24: number;
  votesPercentageFor24Score: number;
  votesPercentageFor7days: number;
  votesPercentageFor7daysScore: number;
  holders: number;
  holdersCountScore: number;
  holdersGrowthPercentageFor1h: number;
  holdersGrowthPercentageFor1hScore: number;
  holdersGrowthPercentageFor24h: number;
  holdersGrowthPercentageFor24hScore: number;
  volumeChangePercentage: number;
  scoreFromVolumePercentage: number;
  liquidity: string;
  liquidityScore: number;
  tokenAge: number;
  tokenAgeScore: number;
  volumeTwoDaysAgo: string;
  scoreFromVolumeTwoDaysAgo: number;
  txnCount24: number;
  txnCount24Score: number;
  aiScore: number;
  chain: string;
  networkId: number;
}
