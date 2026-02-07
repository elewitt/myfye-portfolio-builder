/**
 * Agent Tests
 *
 * Tests for the Portfolio Builder Agent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PortfolioBuilderAgent } from '../agent/portfolio-builder.js';
import { UserProfile } from '../agent/types.js';
import { conservativeStrategy, moderateStrategy, aggressiveStrategy } from '../agent/strategies/index.js';
import { SDKConfig } from '../sdk/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const testConfig: SDKConfig = {
  rpcUrl: 'https://api.devnet.solana.com',
  network: 'devnet',
};

describe('PortfolioBuilderAgent', () => {
  let agent: PortfolioBuilderAgent;

  beforeEach(() => {
    agent = new PortfolioBuilderAgent(testConfig, { dryRun: true });
    mockFetch.mockReset();
  });

  describe('analyzeProfile', () => {
    it('should return conservative strategy for conservative profile', () => {
      const profile: UserProfile = {
        riskTolerance: 'conservative',
        investmentGoals: ['preservation'],
        timeHorizon: 'short',
        totalInvestment: 1000,
      };

      const strategy = agent.analyzeProfile(profile);

      expect(strategy.riskLevel).toBe('conservative');
      expect(strategy.allocations.stablecoins).toBeGreaterThanOrEqual(45);
    });

    it('should return moderate strategy for moderate profile', () => {
      const profile: UserProfile = {
        riskTolerance: 'moderate',
        investmentGoals: ['growth'],
        timeHorizon: 'medium',
        totalInvestment: 1000,
      };

      const strategy = agent.analyzeProfile(profile);

      expect(strategy.riskLevel).toBe('moderate');
    });

    it('should return aggressive strategy for aggressive profile', () => {
      const profile: UserProfile = {
        riskTolerance: 'aggressive',
        investmentGoals: ['speculation'],
        timeHorizon: 'long',
        totalInvestment: 1000,
      };

      const strategy = agent.analyzeProfile(profile);

      expect(strategy.riskLevel).toBe('aggressive');
      expect(strategy.allocations.sol).toBeGreaterThanOrEqual(35);
    });

    it('should adjust allocations based on time horizon', () => {
      const shortTermProfile: UserProfile = {
        riskTolerance: 'moderate',
        investmentGoals: ['growth'],
        timeHorizon: 'short',
        totalInvestment: 1000,
      };

      const longTermProfile: UserProfile = {
        riskTolerance: 'moderate',
        investmentGoals: ['growth'],
        timeHorizon: 'long',
        totalInvestment: 1000,
      };

      const shortTermStrategy = agent.analyzeProfile(shortTermProfile);
      const longTermStrategy = agent.analyzeProfile(longTermProfile);

      // Short term should have more stablecoins
      expect(shortTermStrategy.allocations.stablecoins)
        .toBeGreaterThan(longTermStrategy.allocations.stablecoins);
    });

    it('should adjust allocations based on investment goals', () => {
      const incomeProfile: UserProfile = {
        riskTolerance: 'moderate',
        investmentGoals: ['income'],
        timeHorizon: 'medium',
        totalInvestment: 1000,
      };

      const speculationProfile: UserProfile = {
        riskTolerance: 'moderate',
        investmentGoals: ['speculation'],
        timeHorizon: 'medium',
        totalInvestment: 1000,
      };

      const incomeStrategy = agent.analyzeProfile(incomeProfile);
      const speculationStrategy = agent.analyzeProfile(speculationProfile);

      // Income focus should have more stablecoins
      expect(incomeStrategy.allocations.stablecoins)
        .toBeGreaterThan(speculationStrategy.allocations.stablecoins);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = agent.getConfig();

      expect(config.dryRun).toBe(true);
      expect(config.minTradeSize).toBe(10);
      expect(config.maxSlippageBps).toBe(300);
    });

    it('should allow updating configuration', () => {
      agent.updateConfig({ minTradeSize: 20, dryRun: false });

      const config = agent.getConfig();
      expect(config.minTradeSize).toBe(20);
      expect(config.dryRun).toBe(false);
    });
  });
});

describe('Strategies', () => {
  describe('conservativeStrategy', () => {
    it('should have correct allocations', () => {
      expect(conservativeStrategy.allocations.stablecoins).toBe(50);
      expect(conservativeStrategy.allocations.sol).toBe(15);
      expect(conservativeStrategy.allocations.otherTokens).toBe(5);
      expect(conservativeStrategy.allocations.stocks).toBe(30);
    });

    it('should have blue chip stock recommendations', () => {
      const stockSymbols = conservativeStrategy.recommendedAssets.stocks.map(s => s.symbol);
      expect(stockSymbols).toContain('AAPL');
      expect(stockSymbols).toContain('MSFT');
    });
  });

  describe('moderateStrategy', () => {
    it('should have correct allocations', () => {
      expect(moderateStrategy.allocations.stablecoins).toBe(25);
      expect(moderateStrategy.allocations.sol).toBe(30);
      expect(moderateStrategy.allocations.otherTokens).toBe(15);
      expect(moderateStrategy.allocations.stocks).toBe(30);
    });

    it('should sum to 100%', () => {
      const total = moderateStrategy.allocations.stablecoins +
                    moderateStrategy.allocations.sol +
                    moderateStrategy.allocations.otherTokens +
                    moderateStrategy.allocations.stocks;
      expect(total).toBe(100);
    });
  });

  describe('aggressiveStrategy', () => {
    it('should have correct allocations', () => {
      expect(aggressiveStrategy.allocations.stablecoins).toBe(10);
      expect(aggressiveStrategy.allocations.sol).toBe(40);
      expect(aggressiveStrategy.allocations.otherTokens).toBe(30);
      expect(aggressiveStrategy.allocations.stocks).toBe(20);
    });

    it('should have higher risk tokens', () => {
      const tokenSymbols = aggressiveStrategy.recommendedAssets.tokens.map(t => t.symbol);
      expect(tokenSymbols).toContain('BONK');
    });
  });
});

describe('Health Score Calculation', () => {
  it('should return 100 for perfect allocation', () => {
    // Perfect allocation means 0 deviation
    const agent = new PortfolioBuilderAgent(testConfig);

    // Health score is calculated internally based on deviation sum
    // With 0 deviation, score should be 100
    const mockComparison = [
      { deviationPct: 0 },
      { deviationPct: 0 },
      { deviationPct: 0 },
      { deviationPct: 0 },
    ];

    // Access private method through prototype for testing
    const calculateHealthScore = (agent as any).calculateHealthScore.bind(agent);
    expect(calculateHealthScore(mockComparison)).toBe(100);
  });

  it('should decrease score with higher deviations', () => {
    const agent = new PortfolioBuilderAgent(testConfig);
    const calculateHealthScore = (agent as any).calculateHealthScore.bind(agent);

    const smallDeviation = [
      { deviationPct: 2 },
      { deviationPct: -2 },
      { deviationPct: 1 },
      { deviationPct: -1 },
    ];

    const largeDeviation = [
      { deviationPct: 20 },
      { deviationPct: -20 },
      { deviationPct: 10 },
      { deviationPct: -10 },
    ];

    expect(calculateHealthScore(smallDeviation))
      .toBeGreaterThan(calculateHealthScore(largeDeviation));
  });
});
