import { Injectable } from '@nestjs/common';
import { TwitterApi } from 'twitter-api-v2';

@Injectable()
export class TwitterService {
  private readonly twitterClient;

  constructor() {
    this.twitterClient = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });
  }

  async retweetTweet(tweetId: string) {
    try {
      const response = await this.twitterClient.v1.post(
        `statuses/retweet/${tweetId}.json`,
      );
      return response.data;
    } catch (error) {
      if (error.errors && error.errors[0].code === 327) {
        // Код 327 указывает на то, что твит уже был ретвитнут
        console.log('Твит уже был ретвитнут');
        return null;
      } else {
        console.error('Ошибка при ретвите:', error);
        throw new Error('Ошибка при ретвите');
      }
    }
  }
}
