# Uranograph

A free, monthly atlas of the uranium market: every reactor, every mine, the balance between them, the price,
fund holdings, the news and the filings.

**Live:** https://uranograph.com

## What is in here

This repository is the published site, exactly as served. There is no build step and no framework.

- `index.html`, `css/app.css`, `js/*.js`: the page. Charts are drawn with d3. The globe is a 2D canvas.
- `data/*.json`: the datasets behind every figure, rebuilt once a month.
- `img/art/*.svg`: original line drawings used on the scale ladder and the facts.

To run it locally:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## How the numbers are made

- **Reactor demand** is counted from the bottom up: each unit gets an annual uranium need from its net capacity, a
  capacity factor and its reactor family, and each country is then scaled to its published requirement.
- **Mine supply** is counted from the bottom up: reported production where it exists, guidance or last output for
  operating mines, and start year, ramp and planned output for restarts and new mines.
- Nothing on the site is a price forecast or investment advice.

## Data and reuse

Sources and licences are listed in [DATA-LICENSES.md](DATA-LICENSES.md) and in the site's "Sources and method"
section. The reactor dataset takes its coordinates from GeoNuclearData and is offered under the same Open Database
License.
