import { Defined } from '@definedfi/sdk';
import { TokenFilterConnection } from '@definedfi/sdk/src/resources/graphql';

console.log(
  'NEXT_PUBLIC_DEFINE_API_KEY',
  process.env.NEXT_PUBLIC_DEFINE_API_KEY,
);
export const definedSDK = new Defined(
  process.env.NEXT_PUBLIC_DEFINE_API_KEY || '',
);

//--------------------------------------------------------------------------------------------------

export const getTokens = async (tokenIds: string[]) => {
  const result = await definedSDK.send<{ filterTokens: TokenFilterConnection }>(
    `query FilterTokens($ids: [String!]) {
    filterTokens(tokens: $ids) {
      count
      results {
        quoteToken
        buyCount1
        buyCount12
        buyCount24
        buyCount4
        uniqueBuys1
        uniqueBuys12
        uniqueBuys24
        uniqueBuys4
        change1
        change12
        change24
        change4
        pair {
          address
          token0Data {
            name
            info {
              imageLargeUrl
              address
              circulatingSupply
              cmcId
              id
              imageSmallUrl
              imageThumbUrl
              isScam
              name
              networkId
              symbol
              totalSupply
            }
            address
            cmcId
            decimals
            exchanges {
              address
              color
              exchangeVersion
              iconUrl
              id
              name
              networkId
              tradeUrl
            }
            id
            isScam
            networkId
            socialLinks {
              bitcointalk
              blog
              coingecko
              coinmarketcap
              discord
              email
              facebook
              github
              instagram
              linkedin
              reddit
              slack
              telegram
              twitch
              twitter
              website
              wechat
              whitepaper
              youtube
            }
            symbol
            totalSupply
          }
          token1Data {
            name
            address
            cmcId
            decimals
            exchanges {
              address
              color
              exchangeVersion
              iconUrl
              id
              name
              networkId
              tradeUrl
            }
            explorerData {
              blueCheckmark
              description
              divisor
              id
              tokenPriceUSD
              tokenType
            }
            id
            info {
              address
              circulatingSupply
              cmcId
              id
              imageLargeUrl
              imageSmallUrl
              imageThumbUrl
              isScam
              name
              networkId
              symbol
              totalSupply
            }
            isScam
            networkId
            symbol
            totalSupply
          }
          exchangeHash
          fee
          id
          networkId
          tickSpacing
          token0
          token1
        }
        exchanges {
          address
          color
          exchangeVersion
          id
          name
          networkId
          tradeUrl
          iconUrl
        }
        high1
        high12
        high24
        high4
        lastTransaction
        liquidity
        low1
        low12
        low24
        low4
        marketCap
        priceUSD
        quoteToken
        sellCount1
        sellCount12
        sellCount24
        sellCount4
        uniqueSells1
        uniqueSells12
        uniqueSells24
        uniqueSells4
        txnCount1
        txnCount12
        txnCount24
        txnCount4
        uniqueTransactions1
        uniqueTransactions12
        uniqueTransactions24
        uniqueTransactions4
        volume1
        volume12
        volume24
        volume4
        token {
          totalSupply
          networkId
          address
          decimals
          id
          name
          info {
            circulatingSupply
            imageLargeUrl
            imageSmallUrl
          }
          networkId
          isScam
          symbol
        }
        pair {
          address
          token0Data {
            name
            info {
              imageLargeUrl
              address
              circulatingSupply
              cmcId
              id
              imageSmallUrl
              imageThumbUrl
              isScam
              name
              networkId
              symbol
              totalSupply
            }
            address
            cmcId
            decimals
            exchanges {
              address
              color
              exchangeVersion
              iconUrl
              id
              name
              networkId
              tradeUrl
            }
            id
            isScam
            networkId
            socialLinks {
              bitcointalk
              blog
              coingecko
              coinmarketcap
              discord
              email
              facebook
              github
              instagram
              linkedin
              reddit
              slack
              telegram
              twitch
              twitter
              website
              wechat
              whitepaper
              youtube
            }
            symbol
            totalSupply
          }
          token1Data {
            name
            address
            circulatingSupply
            cmcId
            decimals
            exchanges {
              address
              color
              exchangeVersion
              iconUrl
              id
              name
              networkId
              tradeUrl
            }
            explorerData {
              blueCheckmark
              description
              divisor
              id
              tokenPriceUSD
              tokenType
            }
            id
            info {
              address
              circulatingSupply
              cmcId
              id
              imageLargeUrl
              imageSmallUrl
              imageThumbUrl
              isScam
              name
              networkId
              symbol
              totalSupply
            }
            isScam
            networkId
            symbol
            totalSupply
          }
          exchangeHash
          fee
          id
          networkId
          tickSpacing
          token0
          token1
        }
      }
    }
  }`,
    { ids: tokenIds },
  );

  return result;
};
