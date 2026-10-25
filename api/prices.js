
const START = Date.UTC(2024, 10, 29);
const END = Date.UTC(2026, 9, 26);
const DAY = 86400000;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600");

  try {
    const response = await fetch(
      "https://api.hyperliquid.xyz/info",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "candleSnapshot",
          req: {
            coin: "@107",
            interval: "1d",
            startTime: START,
            endTime: END,
          },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Hyperliquid API HTTP ${response.status}`
      );
    }

    const candles = await response.json();

    if (!Array.isArray(candles)) {
      throw new Error("Invalid candle response");
    }

    const prices = candles
      .filter((c) => {
        const price = Number(c.c);
        return (
          Number.isFinite(price) &&
          price > 0 &&
          c.t >= START &&
          c.t < END
        );
      })
      .map((c) => ({
        date: new Date(c.t).toISOString().slice(0, 10),
        price: Number(c.c),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!prices.length) {
      return res.status(502).json({
        error: "No historical HYPE candles returned",
      });
    }

    return res.status(200).json({
      prices,
      firstAvailable: prices[0].date,
      lastAvailable: prices[prices.length - 1].date,
      coverage: prices.length,
      source: "Hyperliquid HYPE/USDC spot daily close",
    });
  } catch (error) {
    return res.status(502).json({
      error: "Unable to fetch HYPE prices",
      details: error.message,
    });
  }
};
