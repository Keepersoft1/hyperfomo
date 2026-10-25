
const START = Date.UTC(2024, 10, 29) / 1000;
const END = Date.UTC(2026, 9, 25) / 1000;
const DAY = 86400;

const iso = (timestamp) =>
  new Date(timestamp * 1000).toISOString().slice(0, 10);

async function getJSON(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "s-maxage=3600, stale-while-revalidate=86400"
  );

  const observed = new Map();
  const errors = [];

  const providers = [
    async () => {
      const data = await getJSON(
        `https://min-api.cryptocompare.com/data/v2/histoday?fsym=HYPE&tsym=USD&limit=730&toTs=${END}&aggregate=1`
      );

      if (data.Response === "Error") {
        throw new Error(data.Message);
      }

      for (const point of data.Data?.Data || []) {
        if (
          point.close > 0 &&
          point.time >= START &&
          point.time <= END
        ) {
          observed.set(iso(point.time), point.close);
        }
      }
    },

    async () => {
      const data = await getJSON(
        `https://coins.llama.fi/chart/coingecko:hyperliquid?start=${START}&span=700&period=1d`
      );

      const points =
        data.coins?.["coingecko:hyperliquid"]?.prices || [];

      for (const point of points) {
        if (
          point.price > 0 &&
          point.timestamp >= START &&
          point.timestamp <= END
        ) {
          const date = iso(point.timestamp);

          if (!observed.has(date)) {
            observed.set(date, point.price);
          }
        }
      }
    },
  ];

  const results = await Promise.allSettled(
    providers.map((provider) => provider())
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      errors.push(
        `Provider ${index + 1}: ${result.reason.message}`
      );
    }
  });

  if (observed.size === 0) {
    return res.status(502).json({
      error: "Historical HYPE prices unavailable",
      details: errors,
    });
  }

  const dates = [...observed.keys()].sort();
  const prices = [];

  let previous = null;
  let carriedForwardDays = 0;

  for (let t = START; t <= END; t += DAY) {
    const date = iso(t);

    if (observed.has(date)) {
      previous = observed.get(date);
    }

    if (previous !== null) {
      const estimated = !observed.has(date);

      if (estimated) carriedForwardDays++;

      prices.push({
        date,
        price: previous,
        estimated,
      });
    }
  }

  return res.status(200).json({
    prices,
    firstAvailable: dates[0],
    lastAvailable: dates[dates.length - 1],
    coverage: observed.size,
    carriedForwardDays,
    notes: errors,
  });
};
