/**
 * Myfye Agent SDK - Market Data Module
 * Fetches token and stock market data from Jupiter and Dinari
 */

import {
  Token,
  TokenPrice,
  Stock,
  StockPrice,
  SDKConfig,
  COMMON_TOKENS,
  JupiterQuoteParams,
  JupiterQuoteResponse,
} from './types.js';

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_TOKENS_API = 'https://tokens.jup.ag/tokens?tags=verified';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v2';

// Dinari API endpoints
const DINARI_API_BASE = 'https://api.dinari.com';
const DINARI_SANDBOX_API = 'https://api-sandbox.dinari.com';

/**
 * Market data client for fetching token and stock information
 */
export class MarketDataClient {
  private config: SDKConfig;
  private tokenCache: Map<string, Token> = new Map();
  private priceCache: Map<string, { price: TokenPrice; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_TTL = 30000; // 30 seconds

  constructor(config: SDKConfig) {
    this.config = config;
  }

  // ============================================================================
  // Token Methods
  // ============================================================================

  /**
   * Fetch list of verified tokens from Jupiter
   */
  async getAvailableTokens(): Promise<Token[]> {
    try {
      const response = await fetch(JUPITER_TOKENS_API);
      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.status}`);
      }

      const tokens = await response.json() as Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        logoURI?: string;
        tags?: string[];
        extensions?: { coingeckoId?: string };
      }>;

      const result: Token[] = tokens.map((t) => ({
        mint: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
        coingeckoId: t.extensions?.coingeckoId,
        tags: t.tags,
      }));

      // Cache tokens
      for (const token of result) {
        this.tokenCache.set(token.mint, token);
      }

      return result;
    } catch (error) {
      console.error('Error fetching tokens:', error);
      throw error;
    }
  }

  /**
   * Get token info by mint address
   */
  async getToken(mint: string): Promise<Token | null> {
    // Check cache first
    if (this.tokenCache.has(mint)) {
      return this.tokenCache.get(mint)!;
    }

    // Fetch from Jupiter
    try {
      const response = await fetch(`https://tokens.jup.ag/token/${mint}`);
      if (!response.ok) {
        return null;
      }

      const t = await response.json() as {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        logoURI?: string;
        tags?: string[];
        extensions?: { coingeckoId?: string };
      };

      const token: Token = {
        mint: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
        coingeckoId: t.extensions?.coingeckoId,
        tags: t.tags,
      };

      this.tokenCache.set(mint, token);
      return token;
    } catch (error) {
      console.error(`Error fetching token ${mint}:`, error);
      return null;
    }
  }

  /**
   * Get token price from Jupiter Price API
   */
  async getTokenPrice(mint: string): Promise<TokenPrice | null> {
    // Check cache
    const cached = this.priceCache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
      return cached.price;
    }

    try {
      const response = await fetch(`${JUPITER_PRICE_API}?ids=${mint}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.status}`);
      }

      const data = await response.json() as {
        data: Record<string, { id: string; price: string }>;
      };
      const priceData = data.data[mint];

      if (!priceData) {
        return null;
      }

      // Get token info for symbol
      const token = await this.getToken(mint);

      const price: TokenPrice = {
        mint,
        symbol: token?.symbol || 'UNKNOWN',
        priceUsd: parseFloat(priceData.price),
        timestamp: new Date(),
      };

      // Cache the price
      this.priceCache.set(mint, { price, timestamp: Date.now() });

      return price;
    } catch (error) {
      console.error(`Error fetching price for ${mint}:`, error);
      return null;
    }
  }

  /**
   * Get prices for multiple tokens
   */
  async getTokenPrices(mints: string[]): Promise<Map<string, TokenPrice>> {
    const result = new Map<string, TokenPrice>();
    const uncached: string[] = [];

    // Check cache first
    for (const mint of mints) {
      const cached = this.priceCache.get(mint);
      if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_TTL) {
        result.set(mint, cached.price);
      } else {
        uncached.push(mint);
      }
    }

    if (uncached.length === 0) {
      return result;
    }

    try {
      const response = await fetch(`${JUPITER_PRICE_API}?ids=${uncached.join(',')}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`);
      }

      const data = await response.json() as {
        data: Record<string, { id: string; price: string }>;
      };

      for (const mint of uncached) {
        const priceData = data.data[mint];
        if (priceData) {
          const token = await this.getToken(mint);
          const price: TokenPrice = {
            mint,
            symbol: token?.symbol || 'UNKNOWN',
            priceUsd: parseFloat(priceData.price),
            timestamp: new Date(),
          };
          result.set(mint, price);
          this.priceCache.set(mint, { price, timestamp: Date.now() });
        }
      }

      return result;
    } catch (error) {
      console.error('Error fetching prices:', error);
      throw error;
    }
  }

  /**
   * Get a swap quote from Jupiter
   */
  async getSwapQuote(params: JupiterQuoteParams): Promise<JupiterQuoteResponse> {
    const url = new URL(JUPITER_QUOTE_API);
    url.searchParams.set('inputMint', params.inputMint);
    url.searchParams.set('outputMint', params.outputMint);
    url.searchParams.set('amount', params.amount);
    url.searchParams.set('slippageBps', String(params.slippageBps || 300));
    if (params.maxAccounts) {
      url.searchParams.set('maxAccounts', String(params.maxAccounts));
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Jupiter quote error: ${response.status} - ${errorText}`);
      }

      return await response.json() as JupiterQuoteResponse;
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw error;
    }
  }

  // ============================================================================
  // Stock Methods (Dinari RWA)
  // ============================================================================

  /**
   * Get Dinari API base URL based on environment
   */
  private getDinariApiBase(): string {
    return this.config.dinari?.environment === 'sandbox'
      ? DINARI_SANDBOX_API
      : DINARI_API_BASE;
  }

  /**
   * Get available stocks from Dinari
   */
  async getAvailableStocks(): Promise<Stock[]> {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock operations');
    }

    try {
      const response = await fetch(`${this.getDinariApiBase()}/v2/stocks`, {
        headers: {
          'Authorization': `Bearer ${this.config.dinari.apiKeyId}:${this.config.dinari.apiSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stocks: ${response.status}`);
      }

      const data = await response.json() as Array<{
        id: string;
        symbol: string;
        name: string;
        is_trading_enabled: boolean;
        stock_token_address?: string;
      }>;

      return data.map((s) => ({
        id: s.id,
        symbol: s.symbol,
        name: s.name,
        tokenAddress: s.stock_token_address,
        tradingEnabled: s.is_trading_enabled,
      }));
    } catch (error) {
      console.error('Error fetching stocks:', error);
      throw error;
    }
  }

  /**
   * Get stock price from Dinari
   */
  async getStockPrice(stockId: string): Promise<StockPrice | null> {
    if (!this.config.dinari) {
      throw new Error('Dinari configuration required for stock operations');
    }

    try {
      const response = await fetch(`${this.getDinariApiBase()}/v2/stocks/${stockId}/price`, {
        headers: {
          'Authorization': `Bearer ${this.config.dinari.apiKeyId}:${this.config.dinari.apiSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        id: string;
        symbol: string;
        price: number;
        change_24h?: number;
        market_open: boolean;
      };

      return {
        id: data.id,
        symbol: data.symbol,
        priceUsd: data.price,
        change24h: data.change_24h,
        marketOpen: data.market_open,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching stock price for ${stockId}:`, error);
      return null;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get commonly used tokens with their info
   */
  async getCommonTokens(): Promise<Token[]> {
    const tokens: Token[] = [];

    for (const [_symbol, mint] of Object.entries(COMMON_TOKENS)) {
      const token = await this.getToken(mint);
      if (token) {
        tokens.push(token);
      }
    }

    return tokens;
  }

  /**
   * Clear price cache (useful for forcing fresh data)
   */
  clearPriceCache(): void {
    this.priceCache.clear();
  }

  /**
   * Calculate USD value of a token amount
   */
  async calculateTokenValue(mint: string, amount: number): Promise<number> {
    const price = await this.getTokenPrice(mint);
    if (!price) {
      throw new Error(`Could not get price for ${mint}`);
    }
    return amount * price.priceUsd;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MarketDataClient instance
 */
export function createMarketDataClient(config: SDKConfig): MarketDataClient {
  return new MarketDataClient(config);
}
