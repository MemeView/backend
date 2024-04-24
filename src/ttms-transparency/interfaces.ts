export interface portfolio {
  id: number;
  tokenAddress: string;
  score?: number;
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
  liquidity?: string;
  liquidityScore?: number;
  scoreFromVolume?: number;
  votesCount24?: number;
  scoreFromVotesFor24h?: number;
  scoreFromVotes?: number;
  votersPercentageFor24h?: number;
  scoreFromVotersPercentageFor24h?: number;
  votesPercentageFor24h?: number;
  scoreFromVotesPercentageFor24h?: number;
  scoreFromVotesPercentageFor7d?: number;
  votesPercentageFor7d?: number;
  change24?: string;
  scoreFromChange24?: number;
  volume?: string;
  volumeTwoDaysAgo?: string;
  scoreFromVolumeTwoDaysAgo?: number;
  volumeChangePercentage?: number;
  scoreFromVolumePercentage?: number;
  createdAt?: number;
  txnCount24?: number;
  txnCount24Score?: number;
  holders?: number;
  holdersCountScore?: number;
  holdersGrowthPercentage1h?: number;
  scoreHoldersGrowthPercentage1h?: number;
  holdersGrowthPercentage24h?: number;
  scoreHoldersGrowthPercentage24h?: number;
  aiScore?: number;
  tokenAgeScore?: number;
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
  liquidityTokenSymbol: string;
  networkId: number;
}

export enum SnapshotEnum {
  amCurrent = 'amCurrent',
  am24 = 'am24',
  am48 = 'am48',
  pmCurrent = 'pmCurrent',
  pm24 = 'pm24',
  pm48 = 'pm48',
}

export enum ChainEnum {
  all = 'all',
  bsc = 'bsc',
  eth = 'eth',
  base = 'base',
  op = 'op',
  arb = 'arb',
}
