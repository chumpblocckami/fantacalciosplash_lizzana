# /// script
# requires-python = ">=3.10"
# dependencies = ["pandas", "openpyxl"]
# ///
"""Export the historical spreadsheets to CSVs ready to import into Google Sheets.

assets/2023|2024|2025 hold the original xlsx and csv the retired Streamlit app read. Nothing
in the repository reads them any more -- the site serves data/*.json -- but they are the
provenance of every past edition, so they are lifted out to Sheets rather than dropped.

Each file becomes one CSV named <edition>_<table>.csv, which is the name Google Sheets gives
the tab when the file is imported, so the workbook comes out organised without any renaming.
Multi-sheet workbooks get one CSV per sheet.

Usage: uv run scripts/export_legacy_data.py [--out export/legacy]

Then, in a Google Sheets workbook: File > Import > Upload, one CSV at a time, choosing
"Insert new sheet(s)". Keep the workbook alongside the 2026_teams one.
"""

import argparse
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent

# assets/YEAR/punteggi.json is deliberately absent: scripts/assign_quotazioni.py still reads
# it to price the next edition, so it stays in the repository as a live input.
SOURCES = ("*.xlsx", "*.csv")


def edition_dirs() -> list[Path]:
    """Every assets/YYYY directory, oldest first."""
    return sorted(p for p in (ROOT / "assets").iterdir() if p.is_dir() and p.name.isdigit())


def tables(path: Path) -> dict[str, pd.DataFrame]:
    """Read one source file as one or more named tables."""
    if path.suffix == ".csv":
        return {path.stem: pd.read_csv(path)}

    workbook = pd.read_excel(path, sheet_name=None)
    if len(workbook) == 1:
        return {path.stem: next(iter(workbook.values()))}
    return {f"{path.stem}_{sheet}": frame for sheet, frame in workbook.items()}


def main() -> None:
    """Write every historical spreadsheet out as a Google Sheets-ready CSV."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="export/legacy")
    args = parser.parse_args()

    out = ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)

    written: set[str] = set()
    for edition in edition_dirs():
        for pattern in SOURCES:
            for path in sorted(edition.glob(pattern)):
                for name, frame in tables(path).items():
                    # Unnamed: 0 is the index pandas wrote out years ago, not data.
                    frame = frame.loc[:, ~frame.columns.astype(str).str.startswith("Unnamed:")]
                    stem = f"{edition.name}_{name}"
                    # 2024 has both a punteggi.xlsx and a punteggi.csv, and they are not the
                    # same table, so the loser of the name clash keeps its extension.
                    if stem in written:
                        stem = f"{stem}_{path.suffix.lstrip('.')}"
                    written.add(stem)
                    target = out / f"{stem}.csv"
                    frame.to_csv(target, index=False)
                    print(f"  ✓ {target.relative_to(ROOT)}  ({len(frame)} rows, {len(frame.columns)} cols)")

    print(f"\n{len(written)} tables written to {out.relative_to(ROOT)}/")
    print("Import them into Google Sheets with File > Import > Upload, one tab each.")


if __name__ == "__main__":
    main()
