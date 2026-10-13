/** LI.FI-routable assets (same-chain + cross-chain). Native EVM = zero address. */
export const LIFI_NATIVE_EVM = "0x0000000000000000000000000000000000000000";
export const LIFI_SOL = "So11111111111111111111111111111111111111112";

/** @typedef {{ id: string, title: string, symbol: string, cg: string, icon?: string, lifiChain: string, lifiToken: string, decimals: number, kind: "evm"|"svm", balanceCoinId?: string }} SwapAsset */

/** @type {SwapAsset[]} */
export const SWAP_ASSETS = [
  {
    id: "sol",
    title: "Solana",
    symbol: "SOL",
    cg: "solana",
    icon: "https://icons.llamao.fi/icons/chains/rsz_solana.jpg",
    lifiChain: "SOL",
    lifiToken: LIFI_SOL,
    decimals: 9,
    kind: "svm",
    balanceCoinId: "solana",
  },
  {
    id: "eth",
    title: "Ethereum",
    symbol: "ETH",
    cg: "ethereum",
    icon: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    lifiChain: "ETH",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "ethereum",
  },
  {
    id: "usdc-sol",
    title: "USDC · Solana",
    symbol: "USDC",
    cg: "usd-coin",
    icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
    lifiChain: "SOL",
    lifiToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    kind: "svm",
  },
  {
    id: "usdc-eth",
    title: "USDC · Ethereum",
    symbol: "USDC",
    cg: "usd-coin",
    icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
    lifiChain: "ETH",
    lifiToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    kind: "evm",
  },
  {
    id: "usdt-eth",
    title: "USDT · Ethereum",
    symbol: "USDT",
    cg: "tether",
    icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",
    lifiChain: "ETH",
    lifiToken: "0xdAC17F958D2ee523a2206206994597C13D831786",
    decimals: 6,
    kind: "evm",
  },
  {
    id: "pol",
    title: "Polygon",
    symbol: "POL",
    cg: "matic-network",
    icon: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg",
    lifiChain: "POL",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "polygon",
  },
  {
    id: "bnb",
    title: "BNB Chain",
    symbol: "BNB",
    cg: "binancecoin",
    icon: "https://icons.llamao.fi/icons/chains/rsz_binance.jpg",
    lifiChain: "BSC",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "binance",
  },
  {
    id: "arb-eth",
    title: "ETH · Arbitrum",
    symbol: "ETH",
    cg: "ethereum",
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg",
    lifiChain: "ARB",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "arbitrum",
  },
  {
    id: "base-eth",
    title: "ETH · Base",
    symbol: "ETH",
    cg: "ethereum",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg",
    lifiChain: "BAS",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "base",
  },
  {
    id: "op-eth",
    title: "ETH · Optimism",
    symbol: "ETH",
    cg: "ethereum",
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg",
    lifiChain: "OPT",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "optimism",
  },
  {
    id: "rh-eth",
    title: "ETH · Robinhood",
    symbol: "ETH",
    cg: "ethereum",
    icon: "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/robinhood.svg",
    lifiChain: "out",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "robinhood",
  },
  {
    id: "usdg-rh",
    title: "USDG · Robinhood",
    symbol: "USDG",
    cg: "usd-coin",
    icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
    lifiChain: "out",
    lifiToken: "0x0A3B763d66c0e8c7555c986A3701E1DC1Bf3954F",
    decimals: 6,
    kind: "evm",
  },
  {
    id: "avax",
    title: "Avalanche",
    symbol: "AVAX",
    cg: "avalanche-2",
    icon: "https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg",
    lifiChain: "AVAX",
    lifiToken: LIFI_NATIVE_EVM,
    decimals: 18,
    kind: "evm",
    balanceCoinId: "avalanche",
  },
  {
    id: "jup",
    title: "Jupiter",
    symbol: "JUP",
    cg: "jupiter-exchange-solana",
    icon: "https://coin-images.coingecko.com/coins/images/34191/small/jupiter.png",
    lifiChain: "SOL",
    lifiToken: "JUPyiwrYJFskUPkHaMtJJkRjH4nFFovdpbFeV2PsWZL",
    decimals: 6,
    kind: "svm",
  },
  {
    id: "bonk",
    title: "Bonk",
    symbol: "BONK",
    cg: "bonk",
    icon: "https://coin-images.coingecko.com/coins/images/28600/small/bonk.jpg",
    lifiChain: "SOL",
    lifiToken: "DezXAZ8z7PnrnRJjz3w3BoCuDD9F4Y8m3k2q33b3VjR",
    decimals: 5,
    kind: "svm",
  },
  {
    id: "wbtc-eth",
    title: "WBTC · Ethereum",
    symbol: "WBTC",
    cg: "wrapped-bitcoin",
    icon: "https://coin-images.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
    lifiChain: "ETH",
    lifiToken: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    kind: "evm",
  },
];

export const LIFI_CHAIN_TO_RPC = {
  ETH: "ethereum",
  BSC: "binance",
  POL: "polygon",
  ARB: "arbitrum",
  OPT: "optimism",
  BAS: "base",
  AVAX: "avalanche",
  SOL: "solana",
  OUT: "robinhood",
  out: "robinhood",
};

export const LIFI_CHAIN_NUM = {
  ETH: 1,
  BSC: 56,
  POL: 137,
  ARB: 42161,
  OPT: 10,
  BAS: 8453,
  AVAX: 43114,
  OUT: 4663,
  out: 4663,
};

export function swapAssetById(id) {
  return SWAP_ASSETS.find(function (a) {
    return a.id === id;
  });
}

export function amountToBaseUnits(amount, decimals) {
  if (!amount || amount <= 0) return "0";
  const parts = String(amount).split(".");
  const whole = parts[0] || "0";
  let frac = (parts[1] || "").slice(0, decimals);
  while (frac.length < decimals) frac += "0";
  const combined = whole + frac;
  return combined.replace(/^0+/, "") || "0";
}
