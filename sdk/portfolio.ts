/**
 * Myfye Agent SDK - Portfolio Module
 * Reads and tracks portfolio state from on-chain data
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Portfolio,
  PortfolioAllocation,
  TokenBalance,
  StockBalance,
  SDKConfig,
  COMMON_TOKENS,
} from './types.js';
import { MarketDataClient } from './market.js';

/**
 * Portfolio client for reading and tracking portfolio state
 */
export class PortfolioClient {
  private config: SDKConfig;
  private connection: Connection;
  private marketClient: MarketDataClient;

  constructor(config: SDKConfig, marketClient?: MarketDataClient) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.marketClient = marketClient || new MarketDataClient(config);
  }

  /**
   * Get the full portfolio for an account
   */
  async getPortfolio(accountAddress: string): Promise<Portfolio> {
    const publicKey = new PublicKey(accountAddress);

    // Fetch token balances and SOL balance in parallel
    const [tokenBalances, solBalance] = await Promise.all([
      this.getTokenBalances(accountAddress),
      this.connection.getBalance(publicKey),
    ]);

    // Add SOL to token balances
    const solPrice = await this.marketClient.getTokenPrice(COMMON_TOKENS.SOL);
    const solBalanceFormatted = solBalance / 1e9;
    const solValueUsd = solPrice ? solBalanceFormatted * solPrice.priceUsd : 0;

    const allTokenBalances: TokenBalance[] = [
      {
        mint: COMMON_TOKENS.SOL,
        symbol: 'SOL',
        rawBalance: BigInt(solBalance),
        balance: solBalanceFormatted,
        valueUsd: solValueUsd,
      },
      ...tokenBalances,
    ];

    // Fetch stock balances (if Dinari is configured)
    let stockBalances: StockBalance[] = [];
    if (this.config.dinari) {
      try {
        stockBalances = await this.getStockBalances(accountAddress);
      } catch (error) {
        console.warn('Could not fetch stock balances:', error);
      }
    }

    // Calculate totals and allocation
    const totalTokenValue = allTokenBalances.reduce((sum, t) => sum + t.valueUsd, 0);
    const totalStockValue = stockBalances.reduce((sum, s) => sum + s.valueUsd, 0);
    const totalValueUsd = totalTokenValue + totalStockValue;

    const allocation = this.calculateAllocation(allTokenBalances, stockBalances, totalValueUsd);

    return {
      accountAddress,
      tokens: allTokenBalances,
      stocks: stockBalances,
      totalValueUsd,
      allocation,
      updatedAt: new Date(),
    };
  }

  /**
   * Get all SPL token balances for an account
   */
  async getTokenBalances(accountAddress: string): Promise<TokenBalance[]> {
    const publicKey = new PublicKey(accountAddress);

    try {
      // Get all token accounts owned by this address
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const balances: TokenBalance[] = [];

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed?.info;
        if (!parsedInfo) continue;

        const mint = parsedInfo.mint as string;
        const rawBalance = BigInt(parsedInfo.tokenAmount.amount);
        const decimals = parsedInfo.tokenAmount.decimals as number;
        const balance = Number(rawBalance) / Math.pow(10, decimals);

        // Skip zero balances
        if (balance === 0) continue;

        // Get token info and price
        const [tokenInfo, priceInfo] = await Promise.all([
          this.marketClient.getToken(mint),
          this.marketClient.getTokenPrice(mint),
        ]);

        const valueUsd = priceInfo ? balance * priceInfo.priceUsd : 0;

        balances.push({
          mint,
          symbol: tokenInfo?.symbol || 'UNKNOWN',
          rawBalance,
          balance,
          valueUsd,
        });
      }

      // Sort by value descending
      return balances.sort((a, b) => b.valueUsd - a.valueUsd);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }

  /**
   * Get a specific token balance
   */
  async getTokenBalance(accountAddress: string, mint: string): Promise<TokenBalance | null> {
    try {
      const publicKey = new PublicKey(accountAddress);
      const mintPublicKey = new PublicKey(mint);

      // Get the associated token address
      const ata = await getAssociatedTokenAddress(mintPublicKey, publicKey);

      try {
        const tokenAccount = await getAccount(this.connection, ata);
        const tokenInfo = await this.marketClient.getToken(mint);
        const priceInfo = await this.marketClient.getTokenPrice(mint);

        const decimals = tokenInfo?.decimals || 9;
        const balance = Number(tokenAccount.amount) / Math.pow(10, decimals);
        const valueUsd = priceInfo ? balance * priceInfo.priceUsd : 0;

        return {
          mint,
          symbol: tokenInfo?.symbol || 'UNKNOWN',
          rawBalance: tokenAccount.amount,
          balance,
          valueUsd,
        };
      } catch {
        // Token account doesn't exist
        return {
          mint,
          symbol: 'UNKNOWN',
          rawBalance: BigInt(0),
          balance: 0,
          valueUsd: 0,
        };
      }
    } catch (error) {
      console.error(`Error fetching token balance for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Get stock balances from Dinari
   * Note: This requires Dinari account ID, not Solana address
   */
  async getStockBalances(_accountAddress: string): Promise<StockBalance[]> {
    if (!this.config.dinari) {
      return [];
    }

    // Note: Dinari uses its own account system, not Solana addresses directly
    // This would need the Dinari account ID mapped from the Solana address
    // For now, return empty array - full implementation requires Dinari account mapping

    return [];
  }

  /**
   * Calculate portfolio allocation percentages
   */
  private calculateAllocation(
    tokens: TokenBalance[],
    stocks: StockBalance[],
    totalValueUsd: number
  ): PortfolioAllocation {
    if (totalValueUsd === 0) {
      return {
        stablecoins: 0,
        sol: 0,
        otherTokens: 0,
        stocks: 0,
      };
    }

    // Calculate stablecoin value
    const stablecoinMints: string[] = [COMMON_TOKENS.USDC, COMMON_TOKENS.USDT];
    const stablecoinValue = tokens
      .filter(t => stablecoinMints.includes(t.mint))
      .reduce((sum, t) => sum + t.valueUsd, 0);

    // Calculate SOL value
    const solValue = tokens
      .filter(t => t.mint === COMMON_TOKENS.SOL)
      .reduce((sum, t) => sum + t.valueUsd, 0);

    // Calculate other token value
    const otherTokenValue = tokens
      .filter(t => !stablecoinMints.includes(t.mint) && t.mint !== COMMON_TOKENS.SOL)
      .reduce((sum, t) => sum + t.valueUsd, 0);

    // Calculate stock value
    const stockValue = stocks.reduce((sum, s) => sum + s.valueUsd, 0);

    return {
      stablecoins: (stablecoinValue / totalValueUsd) * 100,
      sol: (solValue / totalValueUsd) * 100,
      otherTokens: (otherTokenValue / totalValueUsd) * 100,
      stocks: (stockValue / totalValueUsd) * 100,
    };
  }

  /**
   * Compare current allocation to target allocation
   */
  compareToTarget(
    portfolio: Portfolio,
    targetAllocations: { stablecoins: number; sol: number; otherTokens: number; stocks: number }
  ): Array<{ assetType: string; targetPct: number; actualPct: number; deviationPct: number }> {
    const { allocation } = portfolio;

    return [
      {
        assetType: 'stablecoins',
        targetPct: targetAllocations.stablecoins,
        actualPct: allocation.stablecoins,
        deviationPct: allocation.stablecoins - targetAllocations.stablecoins,
      },
      {
        assetType: 'sol',
        targetPct: targetAllocations.sol,
        actualPct: allocation.sol,
        deviationPct: allocation.sol - targetAllocations.sol,
      },
      {
        assetType: 'otherTokens',
        targetPct: targetAllocations.otherTokens,
        actualPct: allocation.otherTokens,
        deviationPct: allocation.otherTokens - targetAllocations.otherTokens,
      },
      {
        assetType: 'stocks',
        targetPct: targetAllocations.stocks,
        actualPct: allocation.stocks,
        deviationPct: allocation.stocks - targetAllocations.stocks,
      },
    ];
  }

  /**
   * Check if portfolio needs rebalancing
   * Returns true if any allocation deviates more than threshold from target
   */
  needsRebalancing(
    portfolio: Portfolio,
    targetAllocations: { stablecoins: number; sol: number; otherTokens: number; stocks: number },
    thresholdPct: number = 5
  ): boolean {
    const comparison = this.compareToTarget(portfolio, targetAllocations);
    return comparison.some(c => Math.abs(c.deviationPct) > thresholdPct);
  }

  /**
   * Get SOL balance in USD
   */
  async getSolValueUsd(accountAddress: string): Promise<number> {
    const publicKey = new PublicKey(accountAddress);
    const balance = await this.connection.getBalance(publicKey);
    const solPrice = await this.marketClient.getTokenPrice(COMMON_TOKENS.SOL);

    if (!solPrice) {
      throw new Error('Could not get SOL price');
    }

    return (balance / 1e9) * solPrice.priceUsd;
  }

  /**
   * Get total portfolio value in USD
   */
  async getTotalValueUsd(accountAddress: string): Promise<number> {
    const portfolio = await this.getPortfolio(accountAddress);
    return portfolio.totalValueUsd;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PortfolioClient instance
 */
export function createPortfolioClient(config: SDKConfig, marketClient?: MarketDataClient): PortfolioClient {
  return new PortfolioClient(config, marketClient);
}
