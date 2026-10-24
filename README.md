# CostumeScout

Halloween costume scout for the Zero-Human Company Hackathon.

Upload a character photo or type a name. The agent matches nearby stores and peer listings. A paid tier asks a person to confirm the costume is actually on the rack.

## Stack

- TanStack Start on Vercel
- Exa for live store search (`EXA_API_KEY`)
- Whop for the $4 scout report and the $7 verified scout
- Terac for the human stock check

Without `EXA_API_KEY` the app still runs on a Brooklyn demo index.

## Local

```bash
npm install
npm run dev
```
