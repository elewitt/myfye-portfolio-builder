/**
 * Autonomous Portfolio Manager
 *
 * An AI agent that understands natural language investment goals,
 * builds portfolios, and autonomously maintains target allocations.
 */

import { AgentWallet, TOKENS, createAgentWallet } from '../sdk/agent-wallet.js';

// ============================================================================
// Types
// ============================================================================

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | 'custom';

export interface TargetAllocation {
  [tokenSymbol: string]: number; // percentage (0-100)
}

export interface PortfolioState {
  totalValueUsd: number;
  holdings: { symbol: string; mint: string; amount: number; valueUsd: number; percentage: number }[];
  lastUpdated: Date;
}

export interface RebalanceAction {
  type: 'buy' | 'sell';
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  reason: string;
}

export interface ManagerConfig {
  privyAppId: string;
  privyAppSecret: string;
  rpcUrl?: string;
  rebalanceThresholdPct?: number; // Default 5%
  minTradeUsd?: number; // Minimum trade size in USD
}

// ============================================================================
// Predefined Strategies
// ============================================================================

const STRATEGIES: Record<RiskProfile, TargetAllocation> = {
  conservative: {
    USDC: 50,
    USDY: 30, // Yield-bearing stablecoin
    SOL: 15,
    EURC: 5,
  },
  moderate: {
    USDC: 25,
    USDY: 25,
    SOL: 35,
    EURC: 15,
  },
  aggressive: {
    SOL: 60,
    USDY: 20,
    USDC: 15,
    EURC: 5,
  },
  custom: {},
};

// Token metadata
const TOKEN_INFO: Record<string, { mint: string; decimals: number; priceUsd?: number }> = {
  SOL: { mint: TOKENS.SOL, decimals: 9, priceUsd: 180 },
  USDC: { mint: TOKENS.USDC, decimals: 6, priceUsd: 1 },
  USDY: { mint: TOKENS.USDY, decimals: 6, priceUsd: 1.12 },
  EURC: { mint: TOKENS.EURC, decimals: 6, priceUsd: 1.04 },
  USDT: { mint: TOKENS.USDT, decimals: 6, priceUsd: 1 },
};

// ============================================================================
// Natural Language Parser
// ============================================================================

interface ParsedIntent {
  action: 'create_portfolio' | 'rebalance' | 'check_status' | 'swap' | 'set_strategy' | 'unknown';
  riskProfile?: RiskProfile;
  amount?: number;
  fromToken?: string;
  toToken?: string;
  customAllocation?: TargetAllocation;
}

function parseNaturalLanguage(input: string): ParsedIntent {
  const lower = input.toLowerCase();

  // Check for portfolio creation
  if (lower.includes('create') || lower.includes('build') || lower.includes('start') || lower.includes('i want')) {
    let riskProfile: RiskProfile = 'moderate';

    if (lower.includes('conservative') || lower.includes('safe') || lower.includes('low risk')) {
      riskProfile = 'conservative';
    } else if (lower.includes('aggressive') || lower.includes('high risk') || lower.includes('risky')) {
      riskProfile = 'aggressive';
    } else if (lower.includes('moderate') || lower.includes('balanced') || lower.includes('medium')) {
      riskProfile = 'moderate';
    }

    // Extract amount if present
    const amountMatch = lower.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : undefined;

    return { action: 'create_portfolio', riskProfile, amount };
  }

  // Check for rebalance
  if (lower.includes('rebalance') || lower.includes('rebalancing') || lower.includes('adjust')) {
    return { action: 'rebalance' };
  }

  // Check for status
  if (lower.includes('status') || lower.includes('portfolio') || lower.includes('holdings') || lower.includes('check') || lower.includes('how')) {
    return { action: 'check_status' };
  }

  // Check for swap
  if (lower.includes('swap') || lower.includes('buy') || lower.includes('sell') || lower.includes('trade') || lower.includes('convert')) {
    const tokens = Object.keys(TOKEN_INFO);
    let fromToken: string | undefined;
    let toToken: string | undefined;
    let amount: number | undefined;

    // Find tokens mentioned
    for (const token of tokens) {
      if (lower.includes(token.toLowerCase())) {
        if (lower.includes('sell') || lower.includes('from')) {
          fromToken = fromToken || token;
        } else {
          toToken = toToken || token;
        }
      }
    }

    // Extract amount
    const amountMatch = lower.match(/\$?(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1]);
    }

    return { action: 'swap', fromToken, toToken, amount };
  }

  // Check for strategy change
  if (lower.includes('strategy') || lower.includes('change to') || lower.includes('switch to')) {
    let riskProfile: RiskProfile = 'moderate';
    if (lower.includes('conservative')) riskProfile = 'conservative';
    else if (lower.includes('aggressive')) riskProfile = 'aggressive';

    return { action: 'set_strategy', riskProfile };
  }

  return { action: 'unknown' };
}

// ============================================================================
// Autonomous Portfolio Manager
// ============================================================================

export class AutonomousPortfolioManager {
  private wallet: AgentWallet;
  private config: ManagerConfig;
  private targetAllocation: TargetAllocation = {};
  private riskProfile: RiskProfile = 'moderate';
  private isMonitoring = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(config: ManagerConfig) {
    this.config = {
      rebalanceThresholdPct: 5,
      minTradeUsd: 0.50,
      ...config,
    };
    this.wallet = createAgentWallet({
      privyAppId: config.privyAppId,
      privyAppSecret: config.privyAppSecret,
      rpcUrl: config.rpcUrl,
    });
  }

  /**
   * Process a natural language command
   */
  async processCommand(input: string): Promise<string> {
    const intent = parseNaturalLanguage(input);
    console.log(`[Agent] Parsed intent:`, intent);

    switch (intent.action) {
      case 'create_portfolio':
        return this.handleCreatePortfolio(intent.riskProfile || 'moderate', intent.amount);

      case 'rebalance':
        return this.handleRebalance();

      case 'check_status':
        return this.handleCheckStatus();

      case 'swap':
        if (intent.fromToken && intent.toToken && intent.amount) {
          return this.handleSwap(intent.fromToken, intent.toToken, intent.amount);
        }
        return "Please specify: swap [amount] [from_token] to [to_token]";

      case 'set_strategy':
        return this.handleSetStrategy(intent.riskProfile || 'moderate');

      default:
        return `I didn't understand that. Try:\n` +
               `- "Create a conservative portfolio"\n` +
               `- "Check my portfolio status"\n` +
               `- "Rebalance my portfolio"\n` +
               `- "Swap 10 USDC to SOL"`;
    }
  }

  /**
   * Create or load wallet
   */
  async initialize(existingWalletId?: string): Promise<string> {
    if (existingWalletId) {
      const wallet = await this.wallet.loadWallet(existingWalletId);
      return `Loaded wallet: ${wallet.address}`;
    } else {
      const wallet = await this.wallet.createWallet();
      return `Created new wallet: ${wallet.address}\nWallet ID: ${wallet.id}`;
    }
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.getAddress();
  }

  /**
   * Handle portfolio creation
   */
  private async handleCreatePortfolio(profile: RiskProfile, _amount?: number): Promise<string> {
    this.riskProfile = profile;
    this.targetAllocation = { ...STRATEGIES[profile] };

    const allocationStr = Object.entries(this.targetAllocation)
      .map(([token, pct]) => `  ${token}: ${pct}%`)
      .join('\n');

    return `Portfolio strategy set to: ${profile.toUpperCase()}\n\nTarget Allocation:\n${allocationStr}\n\n` +
           `Send funds to: ${this.wallet.getAddress()}\n` +
           `Then say "rebalance" to allocate funds.`;
  }

  /**
   * Handle strategy change
   */
  private async handleSetStrategy(profile: RiskProfile): Promise<string> {
    this.riskProfile = profile;
    this.targetAllocation = { ...STRATEGIES[profile] };
    return `Strategy changed to: ${profile.toUpperCase()}\nSay "rebalance" to adjust holdings.`;
  }

  /**
   * Handle status check
   */
  private async handleCheckStatus(): Promise<string> {
    const state = await this.getPortfolioState();

    if (state.totalValueUsd === 0) {
      return `Portfolio is empty.\nSend funds to: ${this.wallet.getAddress()}`;
    }

    let status = `=== Portfolio Status ===\n`;
    status += `Total Value: $${state.totalValueUsd.toFixed(2)}\n\n`;
    status += `Holdings:\n`;

    for (const holding of state.holdings) {
      const target = this.targetAllocation[holding.symbol] || 0;
      const drift = holding.percentage - target;
      const driftStr = drift > 0 ? `+${drift.toFixed(1)}%` : `${drift.toFixed(1)}%`;
      status += `  ${holding.symbol}: $${holding.valueUsd.toFixed(2)} (${holding.percentage.toFixed(1)}%) [target: ${target}%, drift: ${driftStr}]\n`;
    }

    // Check if rebalance needed
    const needsRebalance = await this.checkRebalanceNeeded();
    if (needsRebalance) {
      status += `\n⚠️ Portfolio drift exceeds ${this.config.rebalanceThresholdPct}%. Say "rebalance" to adjust.`;
    } else {
      status += `\n✓ Portfolio is balanced within ${this.config.rebalanceThresholdPct}% threshold.`;
    }

    return status;
  }

  /**
   * Handle rebalance
   */
  private async handleRebalance(): Promise<string> {
    const actions = await this.calculateRebalanceActions();

    if (actions.length === 0) {
      return "Portfolio is already balanced. No trades needed.";
    }

    let result = `=== Rebalancing Portfolio ===\n`;

    for (const action of actions) {
      result += `\n${action.reason}\n`;

      const fromInfo = TOKEN_INFO[action.fromSymbol];
      const toInfo = TOKEN_INFO[action.toSymbol];

      if (!fromInfo || !toInfo) {
        result += `  ❌ Unknown token\n`;
        continue;
      }

      const swapResult = await this.wallet.swap(fromInfo.mint, toInfo.mint, action.amount);

      if (swapResult.success) {
        result += `  ✓ Swapped ${action.fromSymbol} → ${action.toSymbol}\n`;
        result += `    TX: ${swapResult.txSignature}\n`;
      } else {
        result += `  ❌ Failed: ${swapResult.error}\n`;
      }

      // Small delay between swaps
      await new Promise(r => setTimeout(r, 1000));
    }

    return result;
  }

  /**
   * Handle direct swap
   */
  private async handleSwap(fromSymbol: string, toSymbol: string, amountUsd: number): Promise<string> {
    const fromInfo = TOKEN_INFO[fromSymbol];
    const toInfo = TOKEN_INFO[toSymbol];

    if (!fromInfo || !toInfo) {
      return `Unknown token. Available: ${Object.keys(TOKEN_INFO).join(', ')}`;
    }

    // Convert USD to token amount
    const tokenAmount = amountUsd / (fromInfo.priceUsd || 1);
    const rawAmount = Math.floor(tokenAmount * Math.pow(10, fromInfo.decimals)).toString();

    const result = await this.wallet.swap(fromInfo.mint, toInfo.mint, rawAmount);

    if (result.success) {
      return `✓ Swapped ~$${amountUsd} ${fromSymbol} → ${toSymbol}\nTX: ${result.txSignature}`;
    } else {
      return `❌ Swap failed: ${result.error}`;
    }
  }

  /**
   * Get current portfolio state with USD values
   */
  async getPortfolioState(): Promise<PortfolioState> {
    const portfolio = await this.wallet.getPortfolio();
    const holdings: PortfolioState['holdings'] = [];
    let totalValueUsd = 0;

    // Add SOL
    if (portfolio.solBalance > 0) {
      const valueUsd = portfolio.solBalance * (TOKEN_INFO.SOL.priceUsd || 180);
      totalValueUsd += valueUsd;
      holdings.push({
        symbol: 'SOL',
        mint: TOKENS.SOL,
        amount: portfolio.solBalance,
        valueUsd,
        percentage: 0, // Calculate after total
      });
    }

    // Add tokens
    for (const token of portfolio.tokens) {
      let symbol = token.symbol || 'UNKNOWN';
      let priceUsd = 1;

      // Match known tokens
      for (const [sym, info] of Object.entries(TOKEN_INFO)) {
        if (info.mint === token.mint) {
          symbol = sym;
          priceUsd = info.priceUsd || 1;
          break;
        }
      }

      const valueUsd = token.amount * priceUsd;
      totalValueUsd += valueUsd;
      holdings.push({
        symbol,
        mint: token.mint,
        amount: token.amount,
        valueUsd,
        percentage: 0,
      });
    }

    // Calculate percentages
    for (const holding of holdings) {
      holding.percentage = totalValueUsd > 0 ? (holding.valueUsd / totalValueUsd) * 100 : 0;
    }

    return {
      totalValueUsd,
      holdings,
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if rebalance is needed
   */
  async checkRebalanceNeeded(): Promise<boolean> {
    const state = await this.getPortfolioState();
    const threshold = this.config.rebalanceThresholdPct || 5;

    for (const holding of state.holdings) {
      const target = this.targetAllocation[holding.symbol] || 0;
      const drift = Math.abs(holding.percentage - target);
      if (drift > threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate rebalance actions
   */
  async calculateRebalanceActions(): Promise<RebalanceAction[]> {
    const state = await this.getPortfolioState();
    const actions: RebalanceAction[] = [];
    const threshold = this.config.rebalanceThresholdPct || 5;
    const minTrade = this.config.minTradeUsd || 0.50;

    // Find overweight and underweight positions
    const overweight: { symbol: string; excessUsd: number; mint: string; decimals: number }[] = [];
    const underweight: { symbol: string; deficitUsd: number; mint: string }[] = [];

    for (const [symbol, targetPct] of Object.entries(this.targetAllocation)) {
      const holding = state.holdings.find(h => h.symbol === symbol);
      const currentPct = holding?.percentage || 0;
      const currentValueUsd = holding?.valueUsd || 0;
      const targetValueUsd = (targetPct / 100) * state.totalValueUsd;
      const diff = currentValueUsd - targetValueUsd;

      if (diff > minTrade && (currentPct - targetPct) > threshold) {
        const info = TOKEN_INFO[symbol];
        if (info) {
          overweight.push({ symbol, excessUsd: diff, mint: info.mint, decimals: info.decimals });
        }
      } else if (diff < -minTrade && (targetPct - currentPct) > threshold) {
        const info = TOKEN_INFO[symbol];
        if (info) {
          underweight.push({ symbol, deficitUsd: -diff, mint: info.mint });
        }
      }
    }

    // Match overweight sells with underweight buys
    for (const over of overweight) {
      for (const under of underweight) {
        if (over.excessUsd < minTrade || under.deficitUsd < minTrade) continue;

        const tradeUsd = Math.min(over.excessUsd, under.deficitUsd);
        const tokenAmount = tradeUsd / (TOKEN_INFO[over.symbol]?.priceUsd || 1);
        const rawAmount = Math.floor(tokenAmount * Math.pow(10, over.decimals)).toString();

        actions.push({
          type: 'sell',
          fromSymbol: over.symbol,
          toSymbol: under.symbol,
          amount: rawAmount,
          reason: `Sell ${over.symbol} (overweight) → Buy ${under.symbol} (underweight): ~$${tradeUsd.toFixed(2)}`,
        });

        over.excessUsd -= tradeUsd;
        under.deficitUsd -= tradeUsd;
      }
    }

    return actions;
  }

  /**
   * Start autonomous monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log(`[Agent] Starting autonomous monitoring (checking every ${intervalMs / 1000}s)`);

    this.monitorInterval = setInterval(async () => {
      try {
        const needsRebalance = await this.checkRebalanceNeeded();
        if (needsRebalance) {
          console.log(`[Agent] Drift detected, auto-rebalancing...`);
          const result = await this.handleRebalance();
          console.log(result);
        }
      } catch (error) {
        console.error(`[Agent] Monitor error:`, error);
      }
    }, intervalMs);
  }

  /**
   * Stop autonomous monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log(`[Agent] Stopped monitoring`);
  }
}

/**
 * Create a new autonomous portfolio manager
 */
export function createPortfolioManager(config: ManagerConfig): AutonomousPortfolioManager {
  return new AutonomousPortfolioManager(config);
}
