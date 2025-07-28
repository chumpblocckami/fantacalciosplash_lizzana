import glob
import json
from collections import defaultdict
from dataclasses import asdict, dataclass

import Levenshtein
import pandas as pd


@dataclass
class HistoryEntry:
    quotazione: int
    soprannome: str
    squadra: str
    ruolo: str


def closest_match(query, candidates):
    return min(candidates, key=lambda x: Levenshtein.distance(query, x))


class HistoryMaker:
    def __init__(self):
        self.data = None
        self.history = defaultdict()

    def load_player_data(self):
        paths = sorted(glob.glob("./assets/*/giocatori.xlsx"))
        for path in paths:
            print(f"Reading {path}")
            year = int(path.split("/")[-2])
            data = pd.read_excel(path)
            for _, player in data.iterrows():
                player_id = player["Nominativo"].lower().strip().replace(" ", "_")
                if "conzatti" in player_id:
                    print("ciao")
                if player_id not in self.history:
                    self.history[player_id] = {"nominativo": player["Nominativo"]}

                try:
                    self.history[player_id][year] = asdict(
                        HistoryEntry(
                            quotazione=(
                                int(player["Quotazione"])
                                if str(player["Quotazione"]).isdigit()
                                else None
                            ),
                            soprannome=player["Soprannome"],
                            squadra=player["Squadra"].upper(),
                            ruolo=player["Ruolo"].capitalize(),
                        )
                    )
                except Exception as e:
                    print(f"Cannot load data for:{player}: {e}")

    def load_tournament_data(self):
        paths = sorted(glob.glob("./assets/*/ratings.json"))
        for path in paths:
            year = int(path.split("/")[-2])
            data = pd.read_json(path).T
            for player_id, player_values in data.iterrows():
                player_name = player_id.split("|")[0].strip()
                player_id = player_name.lower().strip().replace(" ", "_")
                if player_id not in self.history.keys():
                    fixed_player_id = closest_match(player_id, self.history.keys())
                    if Levenshtein.ratio(fixed_player_id, player_id) < 0.95:
                        print(
                            f"Player {player_id} not in history"
                            f" and too different from {fixed_player_id}"
                        )
                        continue
                    # print(
                    #    f"Player {player_id} not in history."
                    #    f"Found {player_id} as {fixed_player_id}."
                    # )
                    player_id = fixed_player_id
                try:
                    self.history[player_id][year]["goal"] = (
                        sum([x["goals"] for x in player_values]) / 2
                    )
                    self.history[player_id][year]["fanta_points"] = sum(
                        [x["total_points"] for x in player_values]
                    )
                except Exception as e:
                    print(f"Errore: {player_values} - {self.history[player_id]}. {e}")

    def save_data(self):
        with open("./assets/history.json", "w") as file:
            json.dump(self.history, file, indent=3)

    def run(self):
        self.load_player_data()
        self.load_tournament_data()
        self.save_data()


if __name__ == "__main__":
    HistoryMaker().run()
