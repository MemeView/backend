-- CreateTable
CREATE TABLE "Tokens" (
    "id" SERIAL NOT NULL,
    "address" TEXT,
    "createdAt" INTEGER,
    "name" TEXT,
    "symbol" TEXT,
    "quoteToken" TEXT,
    "buyCount1" INTEGER,
    "buyCount12" INTEGER,
    "buyCount24" INTEGER,
    "buyCount4" INTEGER,
    "uniqueBuys1" INTEGER,
    "uniqueBuys12" INTEGER,
    "uniqueBuys24" INTEGER,
    "uniqueBuys4" INTEGER,
    "change1" TEXT,
    "change12" TEXT,
    "change24" TEXT,
    "change4" TEXT,
    "high1" TEXT,
    "high12" TEXT,
    "high24" TEXT,
    "high4" TEXT,
    "lastTransaction" INTEGER,
    "liquidity" TEXT,
    "low1" TEXT,
    "low12" TEXT,
    "low24" TEXT,
    "low4" TEXT,
    "marketCap" TEXT,
    "priceUSD" TEXT,
    "sellCount1" INTEGER,
    "sellCount12" INTEGER,
    "sellCount24" INTEGER,
    "sellCount4" INTEGER,
    "uniqueSells1" INTEGER,
    "uniqueSells12" INTEGER,
    "uniqueSells24" INTEGER,
    "uniqueSells4" INTEGER,
    "txnCount1" INTEGER,
    "txnCount12" INTEGER,
    "txnCount24" INTEGER,
    "txnCount4" INTEGER,
    "uniqueTransactions1" INTEGER,
    "uniqueTransactions12" INTEGER,
    "uniqueTransactions24" INTEGER,
    "uniqueTransactions4" INTEGER,
    "volume1" TEXT,
    "volume12" TEXT,
    "volume24" TEXT,
    "volume4" TEXT,
    "token" JSONB,
    "pair" JSONB,
    "exchanges" JSONB,
    "cronCount" INTEGER,

    CONSTRAINT "Tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Votes" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenAddress" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,

    CONSTRAINT "Votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "tokenAddress" TEXT NOT NULL,
    "tokenScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("tokenAddress")
);

-- CreateTable
CREATE TABLE "Gainers" (
    "id" SERIAL NOT NULL,
    "address" TEXT,
    "createdAt" INTEGER,
    "name" TEXT,
    "symbol" TEXT,
    "quoteToken" TEXT,
    "buyCount1" INTEGER,
    "buyCount12" INTEGER,
    "buyCount24" INTEGER,
    "buyCount4" INTEGER,
    "uniqueBuys1" INTEGER,
    "uniqueBuys12" INTEGER,
    "uniqueBuys24" INTEGER,
    "uniqueBuys4" INTEGER,
    "change1" TEXT,
    "change12" TEXT,
    "change24" TEXT,
    "change4" TEXT,
    "high1" TEXT,
    "high12" TEXT,
    "high24" TEXT,
    "high4" TEXT,
    "lastTransaction" INTEGER,
    "liquidity" TEXT,
    "low1" TEXT,
    "low12" TEXT,
    "low24" TEXT,
    "low4" TEXT,
    "marketCap" TEXT,
    "priceUSD" TEXT,
    "sellCount1" INTEGER,
    "sellCount12" INTEGER,
    "sellCount24" INTEGER,
    "sellCount4" INTEGER,
    "uniqueSells1" INTEGER,
    "uniqueSells12" INTEGER,
    "uniqueSells24" INTEGER,
    "uniqueSells4" INTEGER,
    "txnCount1" INTEGER,
    "txnCount12" INTEGER,
    "txnCount24" INTEGER,
    "txnCount4" INTEGER,
    "uniqueTransactions1" INTEGER,
    "uniqueTransactions12" INTEGER,
    "uniqueTransactions24" INTEGER,
    "uniqueTransactions4" INTEGER,
    "volume1" TEXT,
    "volume12" TEXT,
    "volume24" TEXT,
    "volume4" TEXT,
    "token" JSONB,
    "pair" JSONB,
    "exchanges" JSONB,
    "cronCount" INTEGER,

    CONSTRAINT "Gainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Losers" (
    "id" SERIAL NOT NULL,
    "address" TEXT,
    "createdAt" INTEGER,
    "name" TEXT,
    "symbol" TEXT,
    "quoteToken" TEXT,
    "buyCount1" INTEGER,
    "buyCount12" INTEGER,
    "buyCount24" INTEGER,
    "buyCount4" INTEGER,
    "uniqueBuys1" INTEGER,
    "uniqueBuys12" INTEGER,
    "uniqueBuys24" INTEGER,
    "uniqueBuys4" INTEGER,
    "change1" TEXT,
    "change12" TEXT,
    "change24" TEXT,
    "change4" TEXT,
    "high1" TEXT,
    "high12" TEXT,
    "high24" TEXT,
    "high4" TEXT,
    "lastTransaction" INTEGER,
    "liquidity" TEXT,
    "low1" TEXT,
    "low12" TEXT,
    "low24" TEXT,
    "low4" TEXT,
    "marketCap" TEXT,
    "priceUSD" TEXT,
    "sellCount1" INTEGER,
    "sellCount12" INTEGER,
    "sellCount24" INTEGER,
    "sellCount4" INTEGER,
    "uniqueSells1" INTEGER,
    "uniqueSells12" INTEGER,
    "uniqueSells24" INTEGER,
    "uniqueSells4" INTEGER,
    "txnCount1" INTEGER,
    "txnCount12" INTEGER,
    "txnCount24" INTEGER,
    "txnCount4" INTEGER,
    "uniqueTransactions1" INTEGER,
    "uniqueTransactions12" INTEGER,
    "uniqueTransactions24" INTEGER,
    "uniqueTransactions4" INTEGER,
    "volume1" TEXT,
    "volume12" TEXT,
    "volume24" TEXT,
    "volume4" TEXT,
    "token" JSONB,
    "pair" JSONB,
    "exchanges" JSONB,
    "cronCount" INTEGER,

    CONSTRAINT "Losers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "walletAddress" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshToken" TEXT,
    "refreshTokenCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "Volume" (
    "id" SERIAL NOT NULL,
    "address" TEXT,
    "volumeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "volume24" TEXT,

    CONSTRAINT "Volume_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tokens_address_key" ON "Tokens"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Score_tokenAddress_key" ON "Score"("tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Gainers_address_key" ON "Gainers"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Losers_address_key" ON "Losers"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Users_walletAddress_key" ON "Users"("walletAddress");
