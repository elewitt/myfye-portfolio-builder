/**
 * Myfye Agent SDK - Account Module
 * Handles Privy embedded wallet creation and management
 */

import { Account, AccountConfig, SDKConfig } from './types.js';

// Privy API endpoints
const PRIVY_AUTH_API = 'https://auth.privy.io/api/v1';

/**
 * Account management client for Privy embedded wallets
 */
export class AccountClient {
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
  }

  /**
   * Create authorization header for Privy API
   */
  private getAuthHeader(): string {
    if (!this.config.privy) {
      throw new Error('Privy configuration required for account operations');
    }
    const credentials = `${this.config.privy.appId}:${this.config.privy.appSecret}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * Create a new self-custodied account with embedded Solana wallet
   * Uses Privy's pregenerate user flow
   */
  async createAccount(email?: string): Promise<Account> {
    if (!this.config.privy) {
      throw new Error('Privy configuration required for account operations');
    }

    try {
      const requestBody: {
        linked_accounts?: Array<{ type: string; address: string }>;
        wallets: Array<{ chain_type: string }>;
      } = {
        wallets: [{ chain_type: 'solana' }],
      };

      // Optionally link an email
      if (email) {
        requestBody.linked_accounts = [
          { type: 'email', address: email },
        ];
      }

      const response = await fetch(`${PRIVY_AUTH_API}/users`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'privy-app-id': this.config.privy.appId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error(`Failed to create account: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const userData = await response.json() as {
        id: string;
        created_at: number;
        linked_accounts: Array<{
          type: string;
          chain_type?: string;
          address?: string;
        }>;
      };

      // Extract Solana wallet from linked accounts
      const solanaWallet = userData.linked_accounts.find(
        (account) => account.type === 'wallet' && account.chain_type === 'solana'
      );

      if (!solanaWallet?.address) {
        throw new Error('Failed to create Solana wallet');
      }

      return {
        id: userData.id,
        publicKey: solanaWallet.address,
        createdAt: new Date(userData.created_at),
        type: 'privy',
      };
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Get account by Privy user ID
   */
  async getAccountById(userId: string): Promise<Account | null> {
    if (!this.config.privy) {
      throw new Error('Privy configuration required for account operations');
    }

    try {
      const response = await fetch(`${PRIVY_AUTH_API}/users/${userId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
          'privy-app-id': this.config.privy.appId,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to get account: ${response.status}`);
      }

      const userData = await response.json() as {
        id: string;
        created_at: number;
        linked_accounts: Array<{
          type: string;
          chain_type?: string;
          address?: string;
        }>;
      };

      // Extract Solana wallet
      const solanaWallet = userData.linked_accounts.find(
        (account) => account.type === 'wallet' && account.chain_type === 'solana'
      );

      // Extract EVM wallet if present
      const evmWallet = userData.linked_accounts.find(
        (account) => account.type === 'wallet' && account.chain_type === 'ethereum'
      );

      if (!solanaWallet?.address) {
        return null;
      }

      return {
        id: userData.id,
        publicKey: solanaWallet.address,
        evmAddress: evmWallet?.address,
        createdAt: new Date(userData.created_at),
        type: 'privy',
      };
    } catch (error) {
      console.error('Error getting account:', error);
      throw error;
    }
  }

  /**
   * Get account by Solana wallet address
   * Note: This requires iterating through all wallets, which can be slow
   */
  async getAccountByAddress(address: string): Promise<Account | null> {
    if (!this.config.privy) {
      throw new Error('Privy configuration required for account operations');
    }

    try {
      let cursor: string | null = null;

      while (true) {
        const url = cursor
          ? `${PRIVY_AUTH_API.replace('/v1', '')}/v1/wallets?cursor=${cursor}`
          : `${PRIVY_AUTH_API.replace('/v1', '')}/v1/wallets`;

        const response = await fetch(url, {
          headers: {
            'Authorization': this.getAuthHeader(),
            'privy-app-id': this.config.privy.appId,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to search wallets: ${response.status}`);
        }

        const data = await response.json() as {
          data: Array<{
            id: string;
            address: string;
            chain_type: string;
            owner_id: string;
            created_at: number;
          }>;
          next_cursor?: string;
        };

        // Search for matching address
        for (const wallet of data.data) {
          if (wallet.address.toLowerCase() === address.toLowerCase()) {
            // Found the wallet, now get full account info
            return this.getAccountById(wallet.owner_id);
          }
        }

        if (data.next_cursor) {
          cursor = data.next_cursor;
        } else {
          break;
        }
      }

      return null;
    } catch (error) {
      console.error('Error searching for account:', error);
      throw error;
    }
  }

  /**
   * List all wallets (for debugging/admin purposes)
   */
  async listWallets(limit = 100): Promise<Array<{ id: string; address: string; chainType: string; ownerId: string }>> {
    if (!this.config.privy) {
      throw new Error('Privy configuration required for account operations');
    }

    try {
      const wallets: Array<{ id: string; address: string; chainType: string; ownerId: string }> = [];
      let cursor: string | null = null;

      while (wallets.length < limit) {
        const url = cursor
          ? `${PRIVY_AUTH_API.replace('/v1', '')}/v1/wallets?cursor=${cursor}`
          : `${PRIVY_AUTH_API.replace('/v1', '')}/v1/wallets`;

        const response = await fetch(url, {
          headers: {
            'Authorization': this.getAuthHeader(),
            'privy-app-id': this.config.privy.appId,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to list wallets: ${response.status}`);
        }

        const data = await response.json() as {
          data: Array<{
            id: string;
            address: string;
            chain_type: string;
            owner_id: string;
          }>;
          next_cursor?: string;
        };

        for (const w of data.data) {
          if (wallets.length >= limit) break;
          wallets.push({
            id: w.id,
            address: w.address,
            chainType: w.chain_type,
            ownerId: w.owner_id,
          });
        }

        if (data.next_cursor) {
          cursor = data.next_cursor;
        } else {
          break;
        }
      }

      return wallets;
    } catch (error) {
      console.error('Error listing wallets:', error);
      throw error;
    }
  }

  /**
   * Create an account object from an external wallet address
   * (for use with wallets not managed by Privy)
   */
  createExternalAccount(publicKey: string, evmAddress?: string): Account {
    return {
      id: `external-${publicKey.slice(0, 8)}`,
      publicKey,
      evmAddress,
      createdAt: new Date(),
      type: 'external',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new AccountClient instance
 */
export function createAccountClient(config: SDKConfig): AccountClient {
  return new AccountClient(config);
}
