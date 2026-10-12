/**
 * MEV Protection Scanner - Shared Types
 * Bounty #45: MEV Protection Scanner
 */

// Supported DEXes
export type DexId = "uniswap-v2" | "uniswap-v3" | "sushiswap" | "curve";

// MEV scan request
export interface MEVScanRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // Wei as string
  dex: DexId;
  transactionHash?: string; // Optional: specific pending tx to analyze
  gasPriceGwei?: number; // User's gas price for percentile calculation
}

// Competing transaction in mempool
export interface CompetingTx {
  hash: string;
  gasPriceGwei: number;
  gasLimit: number;
  value: string;
  to: string;
  from: string;
  input: string;
  timestamp: number;
}

// MEV scan result
export interface MEVScanResult {
  riskScore: number; // 0-100
  attackType: "sandwich" | "front-run" | "back-run" | "none";
  estimatedLossUsd: number;
  protectionSuggestions: string[];
  competingTxs: number;
  gasPricePercentile: number; // 0-100
  mempoolTxCount: number;
  analyzedTxHash?: string;
  details: {
    sandwichDetected: boolean;
    frontRunDetected: boolean;
    backRunDetected: boolean;
    highGasCompetitors: number;
    avgCompetitorGasGwei: number;
  };
  timestamp: number;
}

// Health endpoint response
export interface HealthResponse {
  status: "ok" | "degraded";
  mempoolConnected: boolean;
  lastBlock?: number;
  timestamp: number;
}

// x402 manifest
export interface X402Manifest {
  x402Version: number;
  resource: string;
  description: string;
  accepts: Array<{
    scheme: "exact";
    network: string;
    asset: string;
    payTo: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
  }>;
  free: string[];
}