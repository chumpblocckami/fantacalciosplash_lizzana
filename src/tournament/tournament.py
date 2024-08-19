import difflib
import logging
from collections import defaultdict

import pandas as pd
import requests
from constants import (
    POINTS_BEST_PLAYER,
    POINTS_PER_CLEANSHEET,
    POINTS_PER_DEFEAT,
    POINTS_PER_DRAW,
    POINTS_PER_GOAL,
    POINTS_PER_GOAL_CONCEDED,
    POINTS_PER_RED_CARD,
    POINTS_PER_VICTORY,
    POINTS_PER_YELLOW_CARD,
)
from domain import Match, Player, Results, Team


class Tournament:
    def __init__(self, edition: int) -> None:
        # create logger with 'spam_application'
        self.logger = logging.getLogger("tournament")
        self.logger.setLevel(logging.DEBUG)
        # create file handler which logs even debug messages
        fh = logging.FileHandler("./{self.edition}_tournament.log")
        fh.setLevel(logging.DEBUG)
        self.logger.addHandler(fh)

        self.edition = edition
        self.idx = 1
        self.player_points = defaultdict()
        self.team_points = defaultdict()
        self.rankings = defaultdict()
        self.enrolled_players = pd.read_excel(f"assets/{self.edition}_giocatori.xlsx")

        self.init_players()
        self.init_teams()

    def init_players(self):
        # init or load from file
        for _, row in self.enrolled_players.iterrows():
            self.player_points[f"{row['Nominativo']} | {row['Squadra'].upper()}"] = []

    def init_teams(self):
        # init or load from file
        for team in self.enrolled_players["Squadra"].unique():
            self.team_points[team.upper()] = 0

    def fix_team_name(self, name: str):
        teams = self.enrolled_players["Squadra"].str.upper()
        team = difflib.get_close_matches(name, teams, cutoff=0.75)
        if len(team) >= 1:
            return team[0]
        return None

    def correct_name(self, name: str, team: str):
        corrected_team = team.upper()
        player_data = self.enrolled_players.loc[
            (self.enrolled_players["Nominativo"] == name)
            & (self.enrolled_players["Squadra"].str.upper() == team)
        ]
        if player_data.shape[0] > 0:
            return f"{player_data['Nominativo'].item()} | {corrected_team}"

        # misspelled player name from data. Try to fix it
        players = self.enrolled_players.loc[
            self.enrolled_players["Squadra"].str.upper() == team
        ]
        player = difflib.get_close_matches(name, players["Nominativo"], cutoff=0.75)
        if len(player) == 1:
            return f"{player[0]} | {corrected_team}"

        # misspelled team name from data. Try to fix it
        teams = self.enrolled_players.loc[self.enrolled_players["Nominativo"] == name]
        if teams.shape[0] > 0:
            return f"{name} | {teams.get('Squadra').item().upper()}"

        # misspelled both (porcoddio)
        players = self.enrolled_players["Nominativo"]
        player = difflib.get_close_matches(name, players, cutoff=0.75)
        if len(player) == 1:
            teams = self.enrolled_players.loc[
                self.enrolled_players["Nominativo"] == player[0]
            ]
            if teams.shape[0] > 0:
                return f"{player[0]} | {teams.get('Squadra').item().upper()}"

        raise NameError("PORCODDIO")

    def calculate_player_points(self, team: Team):
        for player in team.players:
            name = f"{player.name.capitalize()} {player.surname.capitalize()}"

            points: int = 0
            points += POINTS_PER_GOAL * player.goals
            points += POINTS_PER_YELLOW_CARD * player.yellow_cards
            points += POINTS_PER_RED_CARD * player.red_cards

            try:
                corrected_name = self.correct_name(name, team.name)
            except:
                self.logger.error(f"Cannot find data about {name} of {team.name}")
                return
            try:
                self.player_points[corrected_name].append(points)
            except:
                self.logger.error(f"Cannot add points about {name} of {team.name}")

    def calculate_team_points(self, match: Match):
        fixed_away_name = self.fix_team_name(match.away_team.name)
        fixed_home_name = self.fix_team_name(match.home_team.name)

        if not fixed_away_name or not fixed_home_name:
            self.logger.error(
                f"Cannot find teams {match.away_team.name}-{match.home_team.name}"
            )
            return

        if match.away_team.score > match.home_team.score:
            self.team_points[fixed_away_name] += POINTS_PER_VICTORY
            self.team_points[fixed_home_name] += POINTS_PER_DEFEAT

        elif match.home_team.score > match.away_team.score:
            self.team_points[fixed_home_name] += POINTS_PER_VICTORY
            self.team_points[fixed_away_name] += POINTS_PER_DEFEAT
        else:
            self.team_points[fixed_home_name] += POINTS_PER_DRAW
            self.team_points[fixed_away_name] += POINTS_PER_DRAW

        if match.away_team.score == 0:
            self.team_points[fixed_home_name] += POINTS_PER_CLEANSHEET
        else:
            self.team_points[fixed_home_name] += (
                match.away_team.score * POINTS_PER_GOAL_CONCEDED
            )

        if match.home_team.score == 0:
            self.team_points[fixed_away_name] += POINTS_PER_CLEANSHEET
        else:
            self.team_points[fixed_away_name] += (
                match.home_team.score * POINTS_PER_GOAL_CONCEDED
            )

    def get_match_points(self, match: Match):
        self.calculate_player_points(match.away_team)
        self.calculate_player_points(match.home_team)

        self.calculate_team_points(match)
        return

    def get_data(self):
        has_data: bool = True
        while has_data:
            # try:
            url: str = f"https://api.gsplizzana.it/api/groups/{self.idx}/fixtures"
            raw_data: dict = requests.get(url, timeout=5).json()
            matches: Results = Results.from_dict(raw_data)
            for match in matches.data:
                self.get_match_points(match)
            self.idx += 1
        # except Exception as e:
        #    has_data = False
        #    self.logger.error(e)


if __name__ == "__main__":
    Tournament(2024).get_data()
