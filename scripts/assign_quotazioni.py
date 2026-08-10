# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Assign 2026 quotazioni from 2025 performance, team strength and previous prices.

Usage: uv run scripts/assign_quotazioni.py
"""

import csv
import json
import re
import statistics as stats
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

# ===== TUNABLES =====

# How the three signals are blended into a single rating (renormalised when one is missing).
WEIGHT_PREVIOUS_PRICE = 0.45
WEIGHT_PERFORMANCE = 0.40
WEIGHT_TEAM = 0.15

# Within the performance signal, how much comes from points per match vs goals per match.
WEIGHT_POINTS_PER_MATCH = 0.70
WEIGHT_GOALS_PER_MATCH = 0.30

# Players only played 4-8 matches in 2025, so short samples are pulled back toward the role mean.
SHRINKAGE_MATCHES = 4.0

# A 2024-only price is older evidence, so it is damped before being used as a prior.
PRICE_DECAY_2024 = 0.70

# Rating (in standard deviations) to price, in euros.
BASE_PRICE = 26.0
PRICE_PER_SIGMA = 18.0
MIN_PRICE = 5
MAX_PRICE = 80

# Newcomers are priced off their teammates, minus a discount for the unknown.
NEWCOMER_DISCOUNT = 0.70

# Players with a price history but no 2025 minutes are unproven too, just less so.
UNPROVEN_DISCOUNT = 0.85

# A weak 2025 team drags its players down harder than a strong one lifts them up.
WEAK_TEAM_MULTIPLIER = 2.0

# A 2026 team inherits its 2025 ancestor only with enough shared players.
MIN_SHARED_PLAYERS = 3
MIN_SHARED_FRACTION = 0.40

# Two spellings are the same player above this similarity.
NAME_MATCH_THRESHOLD = 0.90

ROOT = Path(__file__).resolve().parent.parent
ROSTER_2026 = ROOT / "data" / "2026" / "giocatori.json"
ROSTER_2025 = ROOT / "data" / "2025" / "giocatori.json"
MATCHES_2025 = ROOT / "assets" / "2025" / "punteggi.json"
RESULTS_2025 = ROOT / "data" / "2025" / "risultati.json"
HISTORY = ROOT / "data" / "history.json"
REPORT = ROOT / "data" / "2026" / "quotazioni_report.csv"

GOALKEEPER = "Portiere"


def normalise(text: str) -> str:
    """Reduce a name to lowercase ASCII letters and single spaces for matching."""
    text = unicodedata.normalize("NFKD", (text or "").replace("\u2019", "'"))
    text = text.encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", text.lower())).strip()


def team_key(name: str) -> str:
    """Reduce a team name to a spelling-insensitive key."""
    return normalise(name).replace(" ", "")


def read_json(path: Path):
    """Load a JSON file."""
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def zscores(values: dict) -> dict:
    """Map each value to its z-score, returning zeros when there is no spread."""
    if len(values) < 2:
        return {key: 0.0 for key in values}
    mean = stats.mean(values.values())
    sigma = stats.pstdev(values.values())
    if sigma == 0:
        return {key: 0.0 for key in values}
    return {key: (value - mean) / sigma for key, value in values.items()}


@dataclass
class Performance:
    """A player's 2025 record, taken from the per-match breakdown."""

    matches: int = 0
    points: float = 0.0
    goals: float = 0.0
    mvp: int = 0

    @property
    def points_per_match(self) -> float:
        """Average fanta points per match actually played."""
        return self.points / self.matches if self.matches else 0.0

    @property
    def goals_per_match(self) -> float:
        """Average goals per match actually played."""
        return self.goals / self.matches if self.matches else 0.0


@dataclass
class TeamRecord:
    """A 2025 team's results record."""

    matches: int = 0
    points: int = 0
    scored: int = 0
    conceded: int = 0

    @property
    def strength(self) -> float:
        """Points per match plus half the goal difference per match."""
        if not self.matches:
            return 0.0
        return self.points / self.matches + 0.5 * (self.scored - self.conceded) / self.matches


@dataclass
class Rating:
    """Everything that went into one player's price, kept for the report."""

    player: dict
    roster_key: str = ""
    perf_key: tuple = ()
    previous_team: str = ""
    matched_2025: str = ""
    ambiguous: bool = False
    price_2025: float | None = None
    price_2024: float | None = None
    performance: Performance = field(default_factory=Performance)
    previous_z: float | None = None
    performance_z: float | None = None
    team_z: float = 0.0
    rating: float = 0.0
    price: int = 0
    newcomer: bool = False
    unproven: bool = False


def load_performances() -> tuple[dict, dict]:
    """Read the 2025 per-match breakdown, keyed by name and team.

    The team is part of the key because two different players can share a name, and pooling
    their matches would both inflate the sample and average away their real form.
    """
    performances = {}
    by_name = defaultdict(list)
    for key, matches in read_json(MATCHES_2025).items():
        name, team = key.split("|")
        entry = (normalise(name), team_key(team))
        record = performances.setdefault(entry, Performance())
        record.matches += len(matches)
        record.points += sum(match["total_points"] for match in matches)
        # The stored `goals` field is already worth 2 points per goal.
        record.goals += sum(match["goals"] for match in matches) / 2
        record.mvp += sum(1 for match in matches if match["mvp_points"] > 0)
        if entry not in by_name[entry[0]]:
            by_name[entry[0]].append(entry)
    return performances, by_name


def load_team_strength() -> dict:
    """Compute a z-scored strength per 2025 team from the match results."""
    records = defaultdict(TeamRecord)
    for match in read_json(RESULTS_2025):
        try:
            home_goals, away_goals = (int(part) for part in match["score"].split("-"))
        except (ValueError, KeyError):
            continue
        for team, scored, conceded in (
            (match["home"], home_goals, away_goals),
            (match["away"], away_goals, home_goals),
        ):
            record = records[team_key(team)]
            record.matches += 1
            record.scored += scored
            record.conceded += conceded
            record.points += 3 if scored > conceded else (1 if scored == conceded else 0)
    return zscores({key: record.strength for key, record in records.items()})


def load_previous_prices() -> tuple[dict, dict]:
    """Return the 2025 roster indexed by normalised name, plus 2024 prices from history."""
    roster_2025 = defaultdict(list)
    for player in read_json(ROSTER_2025):
        roster_2025[normalise(player["Nominativo"])].append(player)

    prices_2024 = {}
    for entry in read_json(HISTORY).values():
        record = entry.get("2024") or {}
        if record.get("quotazione"):
            prices_2024[normalise(entry["nominativo"])] = float(record["quotazione"])
    return roster_2025, prices_2024


def match_name(name: str, candidates) -> str | None:
    """Find a player in `candidates`, allowing for small spelling differences."""
    if name in candidates:
        return name
    best, score = None, 0.0
    for candidate in candidates:
        ratio = SequenceMatcher(None, name, candidate).ratio()
        if ratio > score:
            best, score = candidate, ratio
    return best if score >= NAME_MATCH_THRESHOLD else None


def map_team_ancestors(players: list, roster_2025: dict) -> dict:
    """Map each 2026 team to the 2025 team most of its returning players came from."""
    squads = defaultdict(list)
    for player in players:
        squads[player["Squadra"]].append(normalise(player["Nominativo"]))

    ancestors = {}
    for team, names in squads.items():
        previous = Counter()
        for name in names:
            matched = match_name(name, roster_2025)
            if matched:
                previous[team_key(roster_2025[matched][0]["Squadra"])] += 1
        if not previous:
            continue
        ancestor, shared = previous.most_common(1)[0]
        fraction = shared / len(names)
        if shared >= MIN_SHARED_PLAYERS and fraction >= MIN_SHARED_FRACTION:
            ancestors[team] = (ancestor, fraction)
    return ancestors


def rate_players(players: list) -> list:
    """Build a Rating per player, with every signal expressed as a z-score."""
    roster_2025, prices_2024 = load_previous_prices()
    performances, performances_by_name = load_performances()
    team_strength = load_team_strength()
    ancestors = map_team_ancestors(players, roster_2025)

    ratings = [Rating(player=player) for player in players]

    # Resolve each 2026 player against the 2025 roster and the per-match records, which are
    # keyed independently and do not always spell a name the same way.
    for rating in ratings:
        name = normalise(rating.player["Nominativo"])
        rating.roster_key = match_name(name, roster_2025) or ""
        rating.price_2024 = prices_2024.get(name)

        if rating.roster_key:
            candidates = roster_2025[rating.roster_key]
            ancestor = ancestors.get(rating.player["Squadra"], (None, 0.0))[0]
            chosen = next(
                (c for c in candidates if team_key(c["Squadra"]) == ancestor), candidates[0]
            )
            rating.matched_2025 = chosen["Nominativo"]
            rating.price_2025 = float(chosen["Quotazione"])
            rating.previous_team = team_key(chosen["Squadra"])

        entries = performances_by_name.get(match_name(name, performances_by_name) or "", [])
        rating.perf_key = next(
            (entry for entry in entries if entry[1] == rating.previous_team),
            entries[0] if entries else (),
        )
        if rating.perf_key:
            rating.performance = performances[rating.perf_key]

    # Two players can share a name, so flag any 2025 record claimed by more than one 2026
    # player: the history is being inherited by at most one of them.
    claims = Counter((r.roster_key, r.previous_team) for r in ratings if r.roster_key)
    for rating in ratings:
        rating.ambiguous = claims[(rating.roster_key, rating.previous_team)] > 1

    # Previous-price z-scores, computed per role over the 2025 population.
    for role in {player["Ruolo"] for player in players}:
        pool = {
            key: float(player["Quotazione"])
            for key, group in roster_2025.items()
            for player in group
            if player["Ruolo"] == role
        }
        scores = zscores(pool)
        for rating in ratings:
            if rating.player["Ruolo"] != role or rating.price_2025 is None:
                continue
            rating.previous_z = scores.get(rating.roster_key, 0.0)

    scores_2024 = zscores(prices_2024)
    for rating in ratings:
        if rating.previous_z is None and rating.price_2024 is not None:
            name = normalise(rating.player["Nominativo"])
            rating.previous_z = scores_2024.get(name, 0.0) * PRICE_DECAY_2024

    # Performance z-scores, computed per role over everyone who played in 2025.
    roles_2025 = {}
    for key in performances:
        roster_match = match_name(key[0], roster_2025)
        if not roster_match:
            continue
        candidates = roster_2025[roster_match]
        chosen = next((c for c in candidates if team_key(c["Squadra"]) == key[1]), candidates[0])
        roles_2025[key] = chosen["Ruolo"]

    for role in {player["Ruolo"] for player in players}:
        pool = {
            key: performance
            for key, performance in performances.items()
            if roles_2025.get(key) == role and performance.matches
        }
        points_z = zscores({key: p.points_per_match for key, p in pool.items()})
        goals_z = zscores({key: p.goals_per_match for key, p in pool.items()})
        for rating in ratings:
            if rating.player["Ruolo"] != role or rating.perf_key not in points_z:
                continue
            key = rating.perf_key
            if role == GOALKEEPER:
                raw = points_z[key]
            else:
                raw = (
                    WEIGHT_POINTS_PER_MATCH * points_z[key] + WEIGHT_GOALS_PER_MATCH * goals_z[key]
                )
            played = rating.performance.matches
            rating.performance_z = raw * played / (played + SHRINKAGE_MATCHES)

    # Team strength, damped by how much of the roster actually carried over. A poor season
    # counts for more than a good one, so players from last year's weakest sides come cheap.
    for rating in ratings:
        ancestor, fraction = ancestors.get(rating.player["Squadra"], (None, 0.0))
        if not ancestor:
            continue
        strength = team_strength.get(ancestor, 0.0) * fraction
        rating.team_z = strength * WEAK_TEAM_MULTIPLIER if strength < 0 else strength

    return ratings


def blend(rating: Rating) -> None:
    """Combine the available signals into a rating, renormalising for missing ones."""
    parts = [(WEIGHT_TEAM, rating.team_z)]
    if rating.previous_z is not None:
        parts.append((WEIGHT_PREVIOUS_PRICE, rating.previous_z))
    if rating.performance_z is not None:
        parts.append((WEIGHT_PERFORMANCE, rating.performance_z))

    rating.newcomer = rating.previous_z is None and rating.performance_z is None
    rating.unproven = not rating.newcomer and not rating.performance.matches
    total = sum(weight for weight, _ in parts)
    rating.rating = sum(weight * value for weight, value in parts) / total


def clamp(price: float) -> int:
    """Round a price and keep it inside the allowed range."""
    return int(round(min(MAX_PRICE, max(MIN_PRICE, price))))


def to_price(rating: float) -> int:
    """Convert a rating in standard deviations to a price in euros."""
    return clamp(BASE_PRICE + PRICE_PER_SIGMA * rating)


def price_newcomers(ratings: list) -> None:
    """Price players with no history off their priced teammates, minus a discount."""
    known = [r for r in ratings if not r.newcomer]
    fallback = stats.mean([r.price for r in known]) if known else BASE_PRICE

    by_team = defaultdict(list)
    for rating in known:
        by_team[rating.player["Squadra"]].append(rating)

    for rating in ratings:
        if not rating.newcomer:
            continue
        teammates = by_team.get(rating.player["Squadra"], [])
        same_role = [r for r in teammates if r.player["Ruolo"] == rating.player["Ruolo"]]
        pool = same_role or teammates
        baseline = stats.mean([r.price for r in pool]) if pool else fallback
        rating.price = clamp(baseline * NEWCOMER_DISCOUNT)


def write_report(ratings: list) -> None:
    """Write the per-player breakdown so prices can be spot-checked and hand-tuned."""
    columns = [
        "Nominativo",
        "Squadra",
        "Ruolo",
        "Quotazione",
        "newcomer",
        "mai_giocato",
        "matched_2025",
        "ambiguous",
        "prezzo_2025",
        "prezzo_2024",
        "partite_2025",
        "punti_per_partita",
        "gol_2025",
        "mvp_2025",
        "z_prezzo",
        "z_performance",
        "z_squadra",
        "rating",
    ]
    with REPORT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        for rating in sorted(ratings, key=lambda r: -r.price):
            writer.writerow(
                [
                    rating.player["Nominativo"],
                    rating.player["Squadra"],
                    rating.player["Ruolo"],
                    rating.price,
                    "yes" if rating.newcomer else "",
                    "yes" if rating.unproven else "",
                    rating.matched_2025,
                    "yes" if rating.ambiguous else "",
                    rating.price_2025 if rating.price_2025 is not None else "",
                    rating.price_2024 if rating.price_2024 is not None else "",
                    rating.performance.matches or "",
                    (
                        round(rating.performance.points_per_match, 2)
                        if rating.performance.matches
                        else ""
                    ),
                    rating.performance.goals or "",
                    rating.performance.mvp or "",
                    round(rating.previous_z, 3) if rating.previous_z is not None else "",
                    round(rating.performance_z, 3) if rating.performance_z is not None else "",
                    round(rating.team_z, 3),
                    round(rating.rating, 3),
                ]
            )
    print(f"  ✓ {REPORT.relative_to(ROOT)}")


def main() -> None:
    """Price the 2026 roster and write both the roster and the report."""
    print("\n💰 Assigning 2026 quotazioni\n")

    roster = read_json(ROSTER_2026)
    print(f"  {len(roster)} players across {len({p['Squadra'] for p in roster})} teams")

    ratings = rate_players(roster)
    for rating in ratings:
        blend(rating)
        if rating.newcomer:
            continue
        rating.price = to_price(rating.rating)
        if rating.unproven:
            rating.price = clamp(rating.price * UNPROVEN_DISCOUNT)
    price_newcomers(ratings)

    matched = sum(1 for r in ratings if r.matched_2025)
    newcomers = sum(1 for r in ratings if r.newcomer)
    unproven = sum(1 for r in ratings if r.unproven)
    print(f"  {matched} matched to 2025, {newcomers} newcomers priced from their team")
    print(f"  {unproven} with a price history but no 2025 minutes, discounted")

    for rating in ratings:
        rating.player["Quotazione"] = rating.price

    ROSTER_2026.write_text(json.dumps(roster, indent=2, ensure_ascii=False) + "\n", "utf-8")
    print(f"  ✓ {ROSTER_2026.relative_to(ROOT)}")
    write_report(ratings)

    values = [r.price for r in ratings]
    print(
        f"\n✅ Prices: min {min(values)}, max {max(values)}, "
        f"mean {stats.mean(values):.1f}, median {stats.median(values)}\n"
    )


if __name__ == "__main__":
    main()
