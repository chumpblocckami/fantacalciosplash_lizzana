import glob
import json
from datetime import datetime

import pandas as pd
import requests
from domain import MatchPoints, Team, create_dataclass

from constants import (
    POINTS_PER_CLEANSHEET,
    POINTS_PER_CONCEDED_GOALS,
    POINTS_PER_DEFEAT,
    POINTS_PER_DRAW,
    POINTS_PER_MISSING_GAME,
    POINTS_PER_VICTORY,
)


def get_team_ratings(team: Team, conceded_goals: int, ratings: dict, goalkeepers: dict) -> dict:
    goalkeeper_found = False
    # Add team if not in ratings
    if team.name not in ratings:
        ratings[team.name] = {}

    # Calculate team points
    team_points = (
        POINTS_PER_VICTORY
        if team.score > conceded_goals
        else POINTS_PER_DEFEAT if team.score < conceded_goals else POINTS_PER_DRAW
    )

    for player in team.players:

        # Add player if not in ratings
        player_id = f"{player.name} {player.surname} | {team.name}"
        if player_id not in ratings[team.name]:
            ratings[team.name][player_id] = []

        # Calculate goalkeeper points
        goalkeeper_points = 0
        if player_id.split("|")[0].strip() in [x.split("|")[0].strip() for x in goalkeepers]:
            goalkeeper_points = (
                POINTS_PER_CLEANSHEET
                if conceded_goals == 0
                else conceded_goals * POINTS_PER_CONCEDED_GOALS
            )
            goalkeeper_found = True

        # Calculate total points for the match
        ratings[team.name][player_id].append(
            MatchPoints(
                goals=player.goals,
                yellow_cards=player.yellow_cards,
                red_cards=player.red_cards,
                team_points=team_points,
                goalkeeper_points=goalkeeper_points,
            )
        )
    if not goalkeeper_found:
        print(f"{team.name.upper()} | Goalkeeper not found!")
    return ratings


def convert_to_dataframe(ratings: dict, save: bool = True) -> pd.DataFrame:
    records = []

    for team_name, team_data in ratings.items():
        for player_name, match_list in team_data.items():
            for match_index, match in enumerate(match_list, start=1):
                records.append(
                    {
                        "team": team_name,
                        "player": player_name,
                        "match_index": match_index,
                        "goals": match.goals,
                        "yellow_cards": match.yellow_cards,
                        "red_cards": match.red_cards,
                        "team_points": match.team_points,
                        "goalkeeper_points": match.goalkeeper_points,
                        "total_points": match.total_points,
                    }
                )

    df = pd.DataFrame(records)
    if save:
        df.to_csv(f"{YEAR}_totale.csv")
    pivoted_df = df.pivot_table(
        index=["team", "player"], columns="match_index", values="total_points", fill_value=-2
    ).reset_index()
    pivoted_df.set_index("player", inplace=True)
    pivoted_df.drop(columns=["team"], inplace=True)
    pivoted_df.columns = [f"Match {n+1}" for n, _ in enumerate(pivoted_df.columns)]
    pivoted_df["Total"] = pivoted_df.sum(axis=1)
    pivoted_df.sort_values(by="Total", inplace=True, ascending=False)
    return pivoted_df


def read_from_path(path: str) -> dict:
    with open(path, "r") as file:
        content = json.load(file)
    return content


def get_goalkeepers(path_listone: str):
    listone = pd.read_excel(path_listone)
    goalkeepers = listone.loc[listone["Ruolo"] == "Portiere"]
    return goalkeepers.apply(
        lambda x: f"{x['Nominativo']} | {x['Squadra'].upper()}", axis=1
    ).tolist()


YEAR = datetime.now().year
# todo: refine this
goalkeepers = get_goalkeepers(f"./assets/{YEAR}/giocatori.xlsx")
players = {}
teams = []
ratings = {}
results = []

paths = glob.glob(f"assets/{YEAR}/api/groups/*.json")
for path in sorted(paths):

    content = read_from_path(path)
    label = content.get("data", {}).get("name", "not_found")
    if label == "not_found":
        continue

    print(f"Analyzing {label}")
    if not label.lower().endswith("m") and "maschile" not in label.lower():
        print(f"\tSkipping {label}")
        continue
    if label.lower() == "terzo/quarto m":
        print("\tSkipping Terzo/Quarto")
        continue
    url = path.replace(".json", "") + "/fixture/1.json"

    try:
        while url:
            content = read_from_path(url)

            for match in content.get("data"):
                if not match.get("home_team") or not match.get("away_team"):
                    print(f"\t\tNo data available for {label}")
                    continue

                home = create_dataclass(Team, match.get("home_team"))
                away = create_dataclass(Team, match.get("away_team"))

                print(f"\t\t{home.name} {home.score} - {away.score} {away.name}")
                ratings = get_team_ratings(home, away.score, ratings, goalkeepers=goalkeepers)
                ratings = get_team_ratings(away, home.score, ratings, goalkeepers=goalkeepers)

                results.append(
                    {
                        "home": home.name,
                        "away": away.name,
                        "score": f"{home.score}-{away.score}",
                        "stage": label,
                    }
                )
            url = content.get("links").get("next")
            if url:
                url = path.replace(".json", "") + f"/fixture/{url[-1]}.json"

    except requests.HTTPError:
        continue

    # playoff stage
    if "playoff" in label.lower():
        resp = requests.get("https://api.gsplizzana.it/api/groups/1/rankings", timeout=5)
        if resp.status_code == 404:
            raise requests.HTTPError(f"Resource {url} not found.")
        rankings = [x["name"] for x in resp.json()["data"]]

        for team in rankings[:8]:
            for player in ratings[team].keys():
                ratings[team][player].append(
                    MatchPoints(
                        goals=0,
                        yellow_cards=0,
                        red_cards=0,
                        team_points=0,
                        goalkeeper_points=0,
                    )
                )
        for team in rankings[-8:]:
            for player in ratings[team].keys():
                ratings[team][player].append(
                    MatchPoints(
                        goals=0,
                        yellow_cards=0,
                        red_cards=0,
                        team_points=POINTS_PER_MISSING_GAME,
                        goalkeeper_points=0,
                    )
                )

with open(f"assets/{YEAR}/punteggi.json", "w+") as file:
    json.dump(
        {
            player: [x.to_dict() for x in ratings[team][player]]
            for team in ratings
            for player in ratings[team]
        },
        file,
        indent=3,
    )
df = convert_to_dataframe(ratings=ratings, save=True)
df.to_csv(f"assets/{YEAR}/punteggi.csv")
pd.DataFrame(results).to_csv(f"assets/{YEAR}/risultati.csv")
