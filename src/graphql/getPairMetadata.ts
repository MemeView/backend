import { gql } from '@apollo/client';

export const GET_PAIR_METADATA_QUERY = gql`
  query GetPairMetadata($pairId: String!, $quoteToken: QuoteToken) {
    pairMetadata(pairId: $pairId, quoteToken: $quoteToken) {
      id
      pairAddress
      liquidity
      volume1
      quoteToken
      liquidityToken
      nonLiquidityToken
      exchangeId
      price
      liquidity
      priceChange24
      volume24
      networkId
      lowPrice24
      token0 {
        name
        symbol
        address
        pooled
        price
        decimals
      }
      token1 {
        name
        symbol
        address
        pooled
        price
        decimals
      }
    }
  }
`;
