# HYPE DCA Calculator

English-language historical HYPE DCA backtest for Vercel.

## Deploy without GitHub

Install Node.js and Vercel CLI, then from this folder run:

```bash
npm install -g vercel
vercel login
vercel --prod
```

Select **Other** framework. The `/api/prices` route fetches historical daily HYPE/USD quotes. The website hides the source field.

**Accuracy:** The calculation requires a verified price on every selected calendar date. If early dates are missing from external providers, the app displays an explicit error instead of inventing prices. API responses and coverage have not been live-tested here.
