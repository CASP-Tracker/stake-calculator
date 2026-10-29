# Stake Calculator for EU
Staking rewards Calculator for the EU

A small static page that compares staking rewards for ETH, BTC, USDC, LINK, POL and ATOM on MiCA-licensed exchanges (OKX, Bybit, Kraken). Plain HTML, CSS and JavaScript, no build step.

Live: https://casp-tracker.github.io/stake-calculator/

## Files
- `index.html`, `style.css`, `app.js` - the page
- `data/rates.js` - every rate, with its source URL and the date it was read. This is the only file to edit when a rate changes. Bump `asOf` too.
- `assets/logos/` - exchange logos

## Run locally
Open `index.html` in a browser, or serve the folder with any static server.

Rates are read by hand from each exchange's public pages and change often. This is an information tool, not financial or tax advice.
