/**
 * MEV Protection Scanner - Main Entry Point
 * Bounty #45: MEV Protection Scanner
 * Cloudflare Worker with x402 payment gating
 */

import { Hono } from "hono";
import { paymentMiddleware } from "x402-hono";
import { handleHealth } from "./health";
import { handleMEVScan, handleX402Manifest } from "./mev_endpoint";

type Bindings = {
  ORG_EVM_PAYTO: string;
  ETHEREUM_RPC_URL: string;
  ETHEREUM_WS_URL: string;
  INFURA_API_KEY?: string;
  BLOCKNATIVE_API_KEY?: string;
  ETHERSCAN_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Free endpoints
app.get("/health", async (c) => {
  const health = await handleHealth(c.env);
  return c.json(health);
});

app.get("/.well-known/x402.json", async (c) => {
  return handleX402Manifest();
});

// Paid endpoint with x402
app.use("/scan", async (c, next) => {
  const mw = paymentMiddleware(c.env.ORG_EVM_PAYTO as `0x${string}`, {
    "/scan": {
      price: "$0.01",
      network: "base",
      config: {
        description: "MEV Protection Scanner: Detect MEV attacks before they happen",
      },
    },
  });
  return mw(c, next);
});

app.post("/scan", async (c) => {
  return handleMEVScan(c.req.raw, c.env);
});

export default app;