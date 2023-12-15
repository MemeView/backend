import { gql } from '@apollo/client';

export const GET_TOKEN = gql`
  query GetTokenInfo($input: TokenInput!) {
    token(input: $input) {
      id
      address
      cmcId
      decimals
      name
      symbol
      totalSupply
      exchanges {
        name
        exchangeVersion
        tradeUrl
        iconUrl
      }
      socialLinks {
        telegram
        twitch
        twitter
        youtube
        instagram
        email
        facebook
        website
        coinmarketcap
      }
      info {
        circulatingSupply
        imageThumbUrl
        imageLargeUrl
        totalSupply
        address
      }
      explorerData {
        blueCheckmark
        description
        tokenType
      }
    }
  }
`;
