import pandas as pd
import requests
from constants import (
    POINTS_BEST_PLAYER,
    POINTS_PER_CLEANSHEET,
    POINTS_PER_DEFEAT,
    POINTS_PER_GOAL,
    POINTS_PER_RED_CARD,
    POINTS_PER_VICTORY,
    POINTS_PER_YELLOW_CARD,
)
from domain import Match, Player, Results, Team


class Tournament:
    def __init__(self, edition: int) -> None:
        self.edition = edition
        self.idx = 1
        self.enrolled_players = pd.read_excel(f"assets/{self.edition}_giocatori.xlsx")

    def correct_name(self, name: str, team: str):
        player_data = self.enrolled_players.loc[
            self.enrolled_players["Nominativo"] == name
        ]
        if player_data.shape[0] > 0:
            return player_data["Nominativo"].str.strip()
        print("diocane")

    def get_player_points(self, player: Player, team: str):
        points: int = 0
        points += POINTS_PER_GOAL * player.goals
        points += POINTS_PER_YELLOW_CARD * player.yellow_cards
        points += POINTS_PER_RED_CARD * player.red_cards

        name = f"{player.name.capitalize()} {player.surname.capitalize()}"
        corrected_name = self.correct_name(name, team)
        return {corrected_name, points}

    def calculate_team_points(self, team: Team):
        team_data = []
        for player in team.players:
            player_data = self.get_player_points(player, team.name)
            player_data.update({"squadra": team.name})
            team_data.append(player_data)
        team_results = pd.DataFrame(team_data, columns=["Nominativo, squadra, punti"])

        if team.winner:
            team_results["punti"] = team_results["punti"] + 2
        else:
            team_results["punti"] = team_results["punti"] - 1
        return team_results

    def get_match_points(self, match: Match):
        self.calculate_team_points(match.away_team)
        self.calculate_team_points(match.home_team)

    def get_data(self):
        has_data: bool = True
        while has_data:
            try:
                url: str = f"https://api.gsplizzana.it/api/groups/{self.idx}/fixtures"
                raw_data: dict = requests.get(url, timeout=5).json()
                matches: Results = Results.from_dict(raw_data)
                for match in matches.data:
                    self.get_match_points(match)
                self.idx += 1
            except Exception as e:
                has_data = False
                print(e)


if __name__ == "__main__":

    Tournament(2024).get_data()
