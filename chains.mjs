export const COINS = [
  {
    id: "bitcoin",
    title: "Bitcoin",
    symbol: "BTC",
    cg: "bitcoin",
    balanceApi: "btc",
    decimals: 8,
    icon: "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png",
  },
  {
    id: "ethereum",
    title: "Ethereum",
    symbol: "ETH",
    cg: "ethereum",
    rpc: "ethereum",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    id: "solana",
    title: "Solana",
    symbol: "SOL",
    cg: "solana",
    rpc: "solana",
    decimals: 9,
    icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
  },
  {
    id: "base",
    title: "Ethereum · Base",
    symbol: "ETH",
    cg: "ethereum",
    rpc: "base",
    decimals: 18,
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg",
  },
  {
    id: "arbitrum",
    title: "Ethereum · Arbitrum",
    symbol: "ETH",
    cg: "ethereum",
    rpc: "arbitrum",
    decimals: 18,
    icon: "https://icons.llamao.fi/icons/chains/rsz_arbitrum.jpg",
  },
  {
    id: "optimism",
    title: "Ethereum · Optimism",
    symbol: "ETH",
    cg: "ethereum",
    rpc: "optimism",
    decimals: 18,
    icon: "https://icons.llamao.fi/icons/chains/rsz_optimism.jpg",
  },
  {
    id: "robinhood",
    title: "Robinhood Chain",
    symbol: "ETH",
    cg: "ethereum",
    coinType: "ethereum",
    rpc: "robinhood",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",
    badge: "https://icons.duckduckgo.com/ip3/robinhood.com.ico",
  },
  {
    id: "polygon",
    title: "Polygon",
    symbol: "POL",
    cg: "matic-network",
    rpc: "polygon",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/4713/small/polygon.png",
  },
  {
    id: "binance",
    coinType: "smartChain",
    title: "BNB Chain",
    symbol: "BNB",
    cg: "binancecoin",
    rpc: "binance",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png",
  },
  {
    id: "avalanche",
    coinType: "avalancheCChain",
    title: "Avalanche C-Chain",
    symbol: "AVAX",
    cg: "avalanche-2",
    rpc: "avalanche",
    decimals: 18,
    icon: "https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  },
  {
    id: "tron",
    title: "Tron",
    symbol: "TRX",
    cg: "tron",
    balanceApi: "tron",
    decimals: 6,
    icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",
  },
  {
    id: "cosmos",
    title: "Cosmos",
    symbol: "ATOM",
    cg: "cosmos",
    balanceApi: "cosmos",
    decimals: 6,
    icon: "https://coin-images.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  },
  {
    id: "litecoin",
    title: "Litecoin",
    symbol: "LTC",
    cg: "litecoin",
    balanceApi: "ltc",
    decimals: 8,
    icon: "https://coin-images.coingecko.com/coins/images/2/small/litecoin.png",
  },
  {
    id: "dogecoin",
    title: "Dogecoin",
    symbol: "DOGE",
    cg: "dogecoin",
    balanceApi: "doge",
    decimals: 8,
    icon: "https://coin-images.coingecko.com/coins/images/5/small/dogecoin.png",
  },
  {
    id: "ton",
    title: "TON",
    symbol: "TON",
    cg: "the-open-network",
    coinType: "ton",
    balanceApi: "ton",
    decimals: 9,
    icon: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png",
  },
  {
    id: "sui",
    title: "Sui",
    symbol: "SUI",
    cg: "sui",
    coinType: "sui",
    balanceApi: "sui",
    decimals: 9,
    icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
  },
];

/** Extra tokens for swap UI (prices via CoinGecko id). */
export const SWAP_EXTRA = [
  { id: "usdc", title: "USD Coin", symbol: "USDC", cg: "usd-coin", icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" },
  { id: "usdt", title: "Tether", symbol: "USDT", cg: "tether", icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png" },
  { id: "jup", title: "Jupiter", symbol: "JUP", cg: "jupiter-exchange-solana", icon: "https://coin-images.coingecko.com/coins/images/34191/small/jupiter.png" },
  { id: "wbtc", title: "Wrapped BTC", symbol: "WBTC", cg: "wrapped-bitcoin", icon: "https://coin-images.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png" },
  { id: "link", title: "Chainlink", symbol: "LINK", cg: "chainlink", icon: "https://coin-images.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { id: "uni", title: "Uniswap", symbol: "UNI", cg: "uniswap", icon: "https://coin-images.coingecko.com/coins/images/12504/small/uniswap-logo.png" },
  { id: "aave", title: "Aave", symbol: "AAVE", cg: "aave", icon: "https://coin-images.coingecko.com/coins/images/12645/small/aave-token-round.png" },
  { id: "pepe", title: "Pepe", symbol: "PEPE", cg: "pepe", icon: "https://coin-images.coingecko.com/coins/images/29850/small/pepe-token.jpeg" },
  { id: "bonk", title: "Bonk", symbol: "BONK", cg: "bonk", icon: "https://coin-images.coingecko.com/coins/images/28600/small/bonk.jpg" },
  { id: "ray", title: "Raydium", symbol: "RAY", cg: "raydium", icon: "https://coin-images.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg" },
];

export function allSwapTokens() {
  const seen = new Set();
  const out = [];
  COINS.forEach(function (c) {
    if (!seen.has(c.symbol)) {
      seen.add(c.symbol);
      out.push(c);
    }
  });
  SWAP_EXTRA.forEach(function (t) {
    if (!seen.has(t.symbol)) {
      seen.add(t.symbol);
      out.push(t);
    }
  });
  return out;
}

function favicon(domain, fallback) {
  return {
    icon: "https://icons.duckduckgo.com/ip3/" + domain + ".ico",
    fallback: fallback,
  };
}

export const EARN = [
  { title: "Jupiter", sub: "SOL staking", apy: "7.2%", ...favicon("jup.ag", "https://coin-images.coingecko.com/coins/images/34191/small/jupiter.png"), surfHost: "jup.ag", url: "https://jup.ag/stake" },
  { title: "Lido", sub: "ETH liquid staking", apy: "3.4%", ...favicon("lido.fi", "https://coin-images.coingecko.com/coins/images/13573/small/Lido_DAO.png"), surfHost: "stake.lido.fi", url: "https://stake.lido.fi" },
  { title: "PancakeSwap", sub: "BNB yield farms", apy: "4.1%", ...favicon("pancakeswap.finance", "https://coin-images.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png"), surfHost: "pancakeswap.finance", url: "https://pancakeswap.finance/earn" },
  { title: "Keplr", sub: "Cosmos staking hub", apy: "~15%", ...favicon("keplr.app", "https://icons.llamao.fi/icons/chains/rsz_cosmos.jpg"), surfHost: "wallet.keplr.app", url: "https://wallet.keplr.app" },
];

export const DAPPS = [
  { title: "Jupiter", sub: "Swap & perps", ...favicon("jup.ag", "https://coin-images.coingecko.com/coins/images/34191/small/jupiter.png"), surfHost: "jup.ag", url: "https://jup.ag" },
  { title: "Raydium", sub: "Solana AMM", ...favicon("raydium.io", "https://coin-images.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg"), surfHost: "raydium.io", url: "https://raydium.io" },
  { title: "Uniswap", sub: "EVM DEX", ...favicon("app.uniswap.org", "https://coin-images.coingecko.com/coins/images/12504/small/uniswap-logo.png"), surfHost: "app.uniswap.org", url: "https://app.uniswap.org" },
  { title: "Aave", sub: "Lending", ...favicon("app.aave.com", "https://coin-images.coingecko.com/coins/images/12645/small/aave-token-round.png"), surfHost: "app.aave.com", url: "https://app.aave.com" },
  { title: "Hyperliquid", sub: "Perp DEX", ...favicon("app.hyperliquid.xyz", "https://coin-images.coingecko.com/coins/images/40481/small/hyperliquid.jpeg"), surfHost: "app.hyperliquid.xyz", url: "https://app.hyperliquid.xyz" },
  { title: "OpenSea", sub: "NFT marketplace", ...favicon("opensea.io", "https://storage.googleapis.com/opensea-static/Logomark/Logomark-Blue.png"), surfHost: "opensea.io", url: "https://opensea.io" },
  { title: "PancakeSwap", sub: "BNB DEX", ...favicon("pancakeswap.finance", "https://coin-images.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png"), surfHost: "pancakeswap.finance", url: "https://pancakeswap.finance" },
  { title: "1inch", sub: "DEX aggregator", ...favicon("app.1inch.io", "https://coin-images.coingecko.com/coins/images/13469/small/1inch-token.png"), surfHost: "app.1inch.io", url: "https://app.1inch.io" },
  { title: "Marginfi", sub: "Solana lending", ...favicon("app.marginfi.com", "https://icons.llamao.fi/icons/protocols/marginfi.jpg"), surfHost: "app.marginfi.com", url: "https://app.marginfi.com" },
  { title: "Lido", sub: "ETH staking", ...favicon("stake.lido.fi", "https://coin-images.coingecko.com/coins/images/13573/small/Lido_DAO.png"), surfHost: "stake.lido.fi", url: "https://stake.lido.fi" },
];
