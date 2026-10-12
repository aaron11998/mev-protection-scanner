import { describe, it, expect } from "vitest";
import { DEX_ROUTERS, STABLECOINS, WETH, calculateGasPricePercentile, detectSandwichAttack, detectFrontRun, estimateSandwichLoss, isStablecoin, isWeth } from "../src/chains";
import { DexId } from "../src/types";

describe("MEV Constants", () => {
  it("should have DEX_ROUTERS for all supported DEXes", () => {
    const dexes: DexId[] = ["uniswap-v2", "uniswap-v3", "sushiswap", "curve"];
    for (const dex of dexes) {
      expect(DEX_ROUTERS[dex]).toBeDefined();
      expect(DEX_ROUTERS[dex]).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }
  });

  it("should have stablecoin addresses", () => {
    expect(STABLECOINS.length).toBe(3);
    expect(STABLECOINS).toContain("0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12"); // USDC
    expect(STABLECOINS).toContain("0xdAC17F958D2ee523a2206206994597C13D831ec7"); // USDT
    expect(STABLECOINS).toContain("0x6B175474E89094C44Da98b954EedeAC495271d0F"); // DAI
  });

  it("should have WETH address", () => {
    expect(WETH).toBe("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  });
});

describe("Helper Functions", () => {
  it("isStablecoin should detect known stablecoins", () => {
    expect(isStablecoin("0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12")).toBe(true); // USDC
    expect(isStablecoin("0xdAC17F958D2ee523a2206206994597C13D831ec7")).toBe(true); // USDT
    expect(isStablecoin("0x6B175474E89094C44Da98b954EedeAC495271d0F")).toBe(true); // DAI
    expect(isStablecoin("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")).toBe(false); // WETH
    expect(isStablecoin("0x0000000000000000000000000000000000000000")).toBe(false);
  });

  it("isWeth should detect WETH", () => {
    expect(isWeth("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")).toBe(true);
    expect(isWeth("0xc02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")).toBe(true); // lowercase
    expect(isWeth("0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12")).toBe(false); // USDC
  });

  it("calculateGasPricePercentile should return correct percentile", () => {
    const competingTxs = [
      { gasPrice: BigInt(10e9), gasLimit: BigInt(200000), value: 0n, to: "", from: "", input: "", hash: "", timestamp: 0 },
      { gasPrice: BigInt(20e9), gasLimit: BigInt(200000), value: 0n, to: "", from: "", input: "", hash: "", timestamp: 0 },
      { gasPrice: BigInt(30e9), gasLimit: BigInt(200000), value: 0n, to: "", from: "", input: "", hash: "", timestamp: 0 },
      { gasPrice: BigInt(40e9), gasLimit: BigInt(200000), value: 0n, to: "", from: "", input: "", hash: "", timestamp: 0 },
      { gasPrice: BigInt(50e9), gasLimit: BigInt(200000), value: 0n, to: "", from: "", input: "", hash: "", timestamp: 0 },
    ];
    
    // 25th percentile (25% below)
    expect(calculateGasPricePercentile(15, competingTxs)).toBe(20);
    // 50th percentile (median)
    expect(calculateGasPricePercentile(30, competingTxs)).toBe(40);
    // 75th percentile - 45 is > 40, so 4 out of 5 are lower = 80%
    expect(calculateGasPricePercentile(45, competingTxs)).toBe(80);
    // Below all
    expect(calculateGasPricePercentile(5, competingTxs)).toBe(0);
    // Above all
    expect(calculateGasPricePercentile(60, competingTxs)).toBe(100);
  });

  it("calculateGasPricePercentile should handle empty array", () => {
    expect(calculateGasPricePercentile(25, [])).toBe(50);
  });
});

describe("Sandwich Detection", () => {
  const routerAddress = DEX_ROUTERS["uniswap-v2"];
  
  it("detectSandwichAttack should return false for non-router txs", () => {
    const targetTx = {
      hash: "0x1",
      gasPrice: BigInt(25e9),
      gasLimit: BigInt(300000),
      value: 0n,
      to: "0xOtherContract",
      from: "0xUser",
      input: "0x",
      timestamp: Date.now(),
    };
    
    const competingTxs = [
      { hash: "0x2", gasPrice: BigInt(30e9), gasLimit: BigInt(200000), value: 0n, to: "0xOtherContract", from: "0xAttacker", input: "0x", timestamp: Date.now() - 1000 },
    ];
    
    const result = detectSandwichAttack(targetTx, competingTxs, "uniswap-v2");
    expect(result.detected).toBe(false);
    expect(result.frontRun).toBeNull();
    expect(result.backRun).toBeNull();
  });

  it("detectSandwichAttack should detect sandwich pattern", () => {
    const targetTx = {
      hash: "0x1",
      gasPrice: BigInt(25e9),
      gasLimit: BigInt(300000),
      value: 0n,
      to: routerAddress,
      from: "0xUser",
      input: "0x",
      timestamp: Date.now(),
    };
    
    const competingTxs = [
      { hash: "0x2", gasPrice: BigInt(30e9), gasLimit: BigInt(200000), value: 0n, to: routerAddress, from: "0xAttacker", input: "0x", timestamp: Date.now() - 1000 },
      { hash: "0x3", gasPrice: BigInt(20e9), gasLimit: BigInt(200000), value: 0n, to: routerAddress, from: "0xAttacker", input: "0x", timestamp: Date.now() + 1000 },
    ];
    
    const result = detectSandwichAttack(targetTx, competingTxs, "uniswap-v2");
    expect(result.detected).toBe(true);
    expect(result.frontRun).not.toBeNull();
    expect(result.backRun).not.toBeNull();
  });
});

describe("Front-run Detection", () => {
  const routerAddress = DEX_ROUTERS["uniswap-v2"];
  
  it("detectFrontRun should return false for non-router txs", () => {
    const targetTx = {
      hash: "0x1",
      gasPrice: BigInt(25e9),
      gasLimit: BigInt(300000),
      value: 0n,
      to: "0xOtherContract",
      from: "0xUser",
      input: "0x",
      timestamp: Date.now(),
    };
    
    const competingTxs = [
      { hash: "0x2", gasPrice: BigInt(30e9), gasLimit: BigInt(200000), value: 0n, to: "0xOtherContract", from: "0xAttacker", input: "0x", timestamp: Date.now() - 1000 },
    ];
    
    const result = detectFrontRun(targetTx, competingTxs, "uniswap-v2");
    expect(result.detected).toBe(false);
    expect(result.competitors.length).toBe(0);
  });

  it("detectFrontRun should detect front-run", () => {
    const targetTx = {
      hash: "0x1",
      gasPrice: BigInt(25e9),
      gasLimit: BigInt(300000),
      value: 0n,
      to: routerAddress,
      from: "0xUser",
      input: "0x",
      timestamp: Date.now(),
    };
    
    const competingTxs = [
      { hash: "0x2", gasPrice: BigInt(30e9), gasLimit: BigInt(200000), value: 0n, to: routerAddress, from: "0xAttacker", input: "0x", timestamp: Date.now() - 1000 },
      { hash: "0x3", gasPrice: BigInt(35e9), gasLimit: BigInt(200000), value: 0n, to: routerAddress, from: "0xAttacker2", input: "0x", timestamp: Date.now() - 500 },
    ];
    
    const result = detectFrontRun(targetTx, competingTxs, "uniswap-v2");
    expect(result.detected).toBe(true);
    expect(result.competitors.length).toBe(2);
  });
});

describe("Loss Estimation", () => {
  it("estimateSandwichLoss should calculate loss for stablecoin -> ETH", () => {
    const loss = estimateSandwichLoss(
      "10000000000000000", // 0.01 units (16 decimals, safe integer range)
      "0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12", // USDC
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      "0",
      "0"
    );
    // 0.01 units * $1 * 0.01 = $0.0001 loss
    expect(loss).toBeCloseTo(0.0001, 4);
  });

  it("estimateSandwichLoss should calculate loss for ETH -> stablecoin", () => {
    const loss = estimateSandwichLoss(
      "1000000000000000000", // 1 ETH (18 decimals)
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
      "0xA0b86a33E6441b8C4505B0e33B4A5d4D8F6c6d12", // USDC
      "0",
      "0"
    );
    // 1 ETH * $2600 * 0.01 = $26 loss
    expect(loss).toBeCloseTo(26, 0);
  });
});