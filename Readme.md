# Fantacalciosplash Lizzana

Fantasy football for the GSP Lizzana splash tournament. Pick four players and a reserve inside
a 200-credit budget, then watch the classifica move as the real matches are played.

**Site:** https://chumpblocckami.github.io/fantacalciosplash_lizzana/
**Live data:** https://api.cs.xana2.media/api

## How it works

The site is static: `index.html` plus the ES modules under `js/`, served straight off GitHub
Pages. There is no server and nothing to build. Everything it displays is a JSON file under
`data/`, and those files are produced by four Node scripts that a GitHub Action runs on a
schedule during the tournament.

```
Calciosplash API ──scrape──▶ assets/YEAR/api/ ──compute-scores──▶ data/YEAR/punteggi.json
                                                                  data/YEAR/risultati.json
                                                                  data/YEAR/eliminazioni.json
Google Form ──fetch-registrations──▶ data/YEAR/squadre.json
                                             │
                        build-classifica ────┴──▶ data/YEAR/classifica.json
```

| Script | What it does |
| --- | --- |
| `scripts/scrape.js` | Mirrors the Calciosplash API into `assets/YEAR/api/` |
| `scripts/compute-scores.js` | Turns fixtures into per-player match points |
| `scripts/fetch-registrations.js` | Pulls the submitted teams out of the Apps Script backend |
| `scripts/build-classifica.js` | Adds up each coach's four players into the standings |

Registrations arrive through `scripts/registrazioni.gs`, a Google Apps Script bound to the
sheet that backs the entry form.

## Running it

Requires Node 20 or newer. There are no dependencies to install.

```bash
npm run serve     # http://localhost:8080
npm run build     # scrape, score, fetch registrations, rebuild the classifica
npm test          # node --test
```

Each script honours `YEAR` (default `2026`), so a past edition can be recomputed in place:

```bash
YEAR=2025 npm run compute
```

## Between editions

Two steps are manual, once a year.

Player prices are set by `scripts/assign_quotazioni.py`, the one piece of Python left. It reads
the previous editions out of `data/` and `assets/2025/punteggi.json` and writes the new price
list:

```bash
uv run scripts/assign_quotazioni.py
```

The historical spreadsheets in `assets/2023|2024|2025` are the provenance of the past editions
and are no longer read by the site. `scripts/export_legacy_data.py` lifts them into
`export/legacy/*.csv`, one file per tab, ready to import into Google Sheets:

```bash
uv run scripts/export_legacy_data.py
```

`export/` is a staging area for that upload and is not committed.

## Scoring

Every rule lives in `js/constants.js`, shared by the browser and the scripts, so there is one
place to change a number.

| | |
| --- | --- |
| Goal | +2 |
| Yellow card | −2 |
| Red card | −3 |
| Win / draw / loss | +2 / +1 / 0 |
| Clean sheet (goalkeeper) | +5 |
| Goal conceded (goalkeeper) | −0.5 |
| Match MVP | +3 |
| Round missed after elimination | −2 |
| Capocannoniere | +5 |

A coach fields four players. When one of them goes out with their team, the reserve takes
their place for the rounds that follow. The third-place play-off pays no fantasy points, but
its goals still count towards the Capocannoniere.

## Tests

`node --test tests/` covers the scoring truth table, the elimination malus, the classifica's
reserve substitution, registration validation, HTML escaping in the renderers, and a golden
test that recomputes the committed 2026 data from the API snapshot to catch silent drift.

## Layout

```
index.html          the whole site
js/                 rendering, registration form, shared constants
scripts/            the data pipeline
data/YEAR/          what the site fetches
assets/YEAR/        API snapshots and historical sources
tests/              node:test suite
```
