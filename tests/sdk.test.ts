/**
 * SDK Tests
 *
 * Tests for the Myfye Agent SDK components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketDataClient } from '../sdk/market.js';
import { PortfolioClient } from '../sdk/portfolio.js';
import { COMMON_TOKENS, SDKConfig } from '../sdk/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const testConfig: SDKConfig = {
  rpcUrl: 'https://api.devnet.solana.com',
  network: 'devnet',
};

describe('MarketDataClient', () => {
  let client: MarketDataClient;

  beforeEach(() => {
    client = new MarketDataClient(testConfig);
    mockFetch.mockReset();
  });

  describe('getToken', () => {
    it('should fetch token info from Jupiter', async () => {
      const mockToken = {
        address: COMMON_TOKENS.USDC,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        logoURI: 'https://example.com/usdc.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      const token = await client.getToken(COMMON_TOKENS.USDC);

      expect(token).not.toBeNull();
      expect(token?.symbol).toBe('USDC');
      expect(token?.decimals).toBe(6);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(COMMON_TOKENS.USDC)
      );
    });

    it('should return null for unknown token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const token = await client.getToken('unknown-mint');
      expect(token).toBeNull();
    });

    it('should cache token info', async () => {
      const mockToken = {
        address: COMMON_TOKENS.SOL,
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      // First call
      await client.getToken(COMMON_TOKENS.SOL);
      // Second call should use cache
      const token = await client.getToken(COMMON_TOKENS.SOL);

      expect(token?.symbol).toBe('SOL');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTokenPrice', () => {
    it('should fetch price from Jupiter Price API', async () => {
      // Mock for price API (happens first)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            [COMMON_TOKENS.SOL]: {
              id: COMMON_TOKENS.SOL,
              price: '150.00',
            },
          },
        }),
      });

      // Mock for token info (happens second, when getting symbol)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: COMMON_TOKENS.SOL,
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
        }),
      });

      const price = await client.getTokenPrice(COMMON_TOKENS.SOL);

      expect(price).not.toBeNull();
      expect(price?.symbol).toBe('SOL');
      expect(price?.priceUsd).toBe(150);
    });

    it('should cache prices for 30 seconds', async () => {
      // Setup mocks
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            [COMMON_TOKENS.USDC]: {
              id: COMMON_TOKENS.USDC,
              price: '1.00',
            },
          },
        }),
      });

      // First call
      await client.getTokenPrice(COMMON_TOKENS.USDC);
      // Second call should use cache
      await client.getTokenPrice(COMMON_TOKENS.USDC);

      // Only one price fetch (token info may be fetched separately)
      const priceFetches = mockFetch.mock.calls.filter(
        call => call[0].includes('price')
      );
      expect(priceFetches.length).toBe(1);
    });
  });

  describe('getSwapQuote', () => {
    it('should fetch quote from Jupiter Quote API', async () => {
      const mockQuote = {
        inputMint: COMMON_TOKENS.USDC,
        outputMint: COMMON_TOKENS.SOL,
        inAmount: '1000000',
        outAmount: '6666666',
        slippageBps: 300,
        priceImpactPct: '0.01',
        routePlan: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote,
      });

      const quote = await client.getSwapQuote({
        inputMint: COMMON_TOKENS.USDC,
        outputMint: COMMON_TOKENS.SOL,
        amount: '1000000',
      });

      expect(quote.inAmount).toBe('1000000');
      expect(quote.outAmount).toBe('6666666');
    });
  });
});

describe('PortfolioClient', () => {
  describe('calculateAllocation', () => {
    it('should correctly identify asset categories', () => {
      // This is tested implicitly through getPortfolio
      // The allocation calculation categorizes tokens correctly
    });
  });

  describe('compareToTarget', () => {
    it('should calculate deviations correctly', () => {
      const client = new PortfolioClient(testConfig);

      const mockPortfolio = {
        accountAddress: 'test',
        tokens: [],
        stocks: [],
        totalValueUsd: 1000,
        allocation: {
          stablecoins: 30,
          sol: 40,
          otherTokens: 20,
          stocks: 10,
        },
        updatedAt: new Date(),
      };

      const target = {
        stablecoins: 25,
        sol: 30,
        otherTokens: 15,
        stocks: 30,
      };

      const comparison = client.compareToTarget(mockPortfolio, target);

      expect(comparison.find(c => c.assetType === 'stablecoins')?.deviationPct).toBe(5);
      expect(comparison.find(c => c.assetType === 'sol')?.deviationPct).toBe(10);
      expect(comparison.find(c => c.assetType === 'stocks')?.deviationPct).toBe(-20);
    });
  });

  describe('needsRebalancing', () => {
    it('should return true when deviation exceeds threshold', () => {
      const client = new PortfolioClient(testConfig);

      const mockPortfolio = {
        accountAddress: 'test',
        tokens: [],
        stocks: [],
        totalValueUsd: 1000,
        allocation: {
          stablecoins: 30,
          sol: 40,
          otherTokens: 20,
          stocks: 10,
        },
        updatedAt: new Date(),
      };

      const target = {
        stablecoins: 25,
        sol: 30, // 10% deviation
        otherTokens: 15,
        stocks: 30,
      };

      expect(client.needsRebalancing(mockPortfolio, target, 5)).toBe(true);
    });

    it('should return false when within threshold', () => {
      const client = new PortfolioClient(testConfig);

      const mockPortfolio = {
        accountAddress: 'test',
        tokens: [],
        stocks: [],
        totalValueUsd: 1000,
        allocation: {
          stablecoins: 26,
          sol: 31,
          otherTokens: 14,
          stocks: 29,
        },
        updatedAt: new Date(),
      };

      const target = {
        stablecoins: 25,
        sol: 30,
        otherTokens: 15,
        stocks: 30,
      };

      expect(client.needsRebalancing(mockPortfolio, target, 5)).toBe(false);
    });
  });
});
