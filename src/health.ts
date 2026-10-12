/**
 * MEV Protection Scanner - Health Endpoint
 * Bounty #45: MEV Protection Scanner
 */

import { HealthResponse } from "./types";

export async function handleHealth(env: { [key: string]: string }): Promise<HealthResponse> {
  const mempoolConnected = !!env.ETHEREUM_WS_URL;
  
  return {
    status: mempoolConnected ? "ok" : "degraded",
    mempoolConnected,
    timestamp: Date.now(),
  };
}