export interface UserWithoutRefreshToken {
  walletAddress: string;
  telegramId: number;
  votes: number;
  updatedAt: Date;
  freeTrialWasTaken: boolean;
  ownRefId: string;
  registrationRefId: string;
  holdingTWAmount: string;
  holdingTWAmountUSDT: string;
  subscriptionLevel: string;
  trialCreatedAt: Date;
}
