import copy
import glob
import json
import pathlib
from collections import defaultdict

import pandas as pd
from constants import (
    COLUMNS,
    POINTS_PER_CLEANSHEET,
    POINTS_PER_DEFEAT,
    POINTS_PER_DEFEAT_RANKING,
    POINTS_PER_DRAW,
    POINTS_PER_DRAW_RANKING,
    POINTS_PER_GOAL,
    POINTS_PER_GOAL_CONCEDED,
    POINTS_PER_RED_CARD,
    POINTS_PER_UNPLAYED,
    POINTS_PER_VICTORY,
    POINTS_PER_VICTORY_RANKING,
    POINTS_PER_YELLOW_CARD,
)
from diagnostic import init_logger
from domain import Match, Player, Results
from fixer import Fixer


class Tournament:
    """
    Class for parsing tournament data
    """

    def __init__(self, edition: int) -> None:
        self.logger = init_logger(edition, "tournament")
        self.fixer = Fixer()

        self.edition = edition

        self.player_points = defaultdict()
        self.team_points = defaultdict()
        self.goalkeeper_points = defaultdict()
        self.ranking = defaultdict()

        self.enrolled_players = pd.read_excel(
            f"assets/{self.edition}/{self.edition}_giocatori.xlsx"
        )

        self.columns = COLUMNS

        self.init_data()

    def init_data(self):
        for _, row in self.enrolled_players.iterrows():
            self.player_points[f"{row['Nominativo']} | {row['Squadra'].upper()}"] = (
                copy.deepcopy(self.columns)
            )

        for team in self.enrolled_players["Squadra"].unique():
            self.team_points[team.upper()] = copy.deepcopy(self.columns)
            self.goalkeeper_points[team.upper()] = copy.deepcopy(self.columns)
            self.ranking[team.upper()] = {
                "Punteggio": 0,
                "Goal fatti": 0,
                "Goal subiti": 0,
                "Differenza reti": 0,
                "Partite giocate": 0,
            }

        self.enrolled_players["Squadra"] = self.enrolled_players["Squadra"].str.upper()

    def update_points(self, id_player: str, points: float, data_to_update: dict):
        try:
            _, team = (
                id_player.split(" | ") if " | " in id_player else (None, id_player)
            )

            max_played_games = max(
                [self.ranking[x]["Partite giocate"] for x in self.ranking]
            )
            teams_qualified = len(
                [
                    self.ranking[x]["Partite giocate"]
                    for x in self.ranking
                    if self.ranking[x]["Partite giocate"] == 5
                ]
            )
            played_games = self.ranking[team]["Partite giocate"]
            if teams_qualified >= 16:
                # skip bonus because it means that it went directly to final phase
                if data_to_update[id_player]["Bonus"] is None:
                    self.logger.info("Setting BONUS for %s as 0.", id_player)
                    data_to_update[id_player]["Bonus"] = 0

            for key in data_to_update[id_player]:
                if data_to_update[id_player][key] is None:
                    self.logger.info(
                        "Updated %s of %s with %s points", key, id_player, points
                    )
                    data_to_update[id_player][key] = points
                    return
            raise NameError("Porcoddio")

        except NameError as ne:
            self.logger.error(
                "Cannot update points of %s: %s",
                id_player,
                str(ne),
            )

    def calculate_player_points(self, player: Player, team_name: str):
        """
        Calculate the points of a player.
        The check on the team is mandatory for omonimi.
        """
        name = f"{player.name.capitalize()} {player.surname.capitalize()}"
        corrected_name = self.fixer.correct_name(name, team_name, self.enrolled_players)

        points: float = 0
        points += POINTS_PER_GOAL * player.goals
        points += POINTS_PER_YELLOW_CARD * player.yellow_cards
        points += POINTS_PER_RED_CARD * player.red_cards
        self.logger.info(
            "%s - goals: %i yellows: %i reds: %i points: %i",
            corrected_name,
            player.goals,
            player.yellow_cards,
            player.red_cards,
            points,
        )
        return corrected_name, points

    def calculate_goalkeeper_points(self, match: Match):

        points_goalkeeper_away = 0
        points_goalkeeper_home = 0

        if match.home_team.score == 0:
            points_goalkeeper_away += POINTS_PER_CLEANSHEET
        else:
            points_goalkeeper_away += match.home_team.score * POINTS_PER_GOAL_CONCEDED

        if match.away_team.score == 0:
            points_goalkeeper_home += POINTS_PER_CLEANSHEET
        else:
            points_goalkeeper_home += match.away_team.score * POINTS_PER_GOAL_CONCEDED

        return points_goalkeeper_home, points_goalkeeper_away

    def calculate_team_points(self, match: Match):
        points_away = 0
        points_home = 0

        if match.away_team.score > match.home_team.score:
            points_away += POINTS_PER_VICTORY
            points_home += POINTS_PER_DEFEAT

        elif match.home_team.score > match.away_team.score:
            points_home += POINTS_PER_VICTORY
            points_away += POINTS_PER_DEFEAT
        else:
            points_home += POINTS_PER_DRAW
            points_away += POINTS_PER_DRAW

        return points_home, points_away

    def update_ranking(
        self, score_home: int, score_away: int, home_name: str, away_name: str
    ):
        if score_home > score_away:
            self.ranking[home_name]["Punteggio"] += POINTS_PER_VICTORY_RANKING
            self.ranking[away_name]["Punteggio"] += POINTS_PER_DEFEAT_RANKING
        elif score_away > score_home:
            self.ranking[away_name]["Punteggio"] += POINTS_PER_VICTORY_RANKING
            self.ranking[home_name]["Punteggio"] += POINTS_PER_DEFEAT_RANKING
        else:
            self.ranking[home_name]["Punteggio"] += POINTS_PER_DRAW_RANKING
            self.ranking[away_name]["Punteggio"] += POINTS_PER_DRAW_RANKING

        self.ranking[home_name]["Goal fatti"] += score_home
        self.ranking[away_name]["Goal fatti"] += score_away

        self.ranking[home_name]["Goal subiti"] += score_away
        self.ranking[away_name]["Goal subiti"] += score_home

        self.ranking[home_name]["Partite giocate"] += 1
        self.ranking[away_name]["Partite giocate"] += 1

        self.ranking[home_name]["Differenza reti"] = (
            self.ranking[home_name]["Goal fatti"]
            - self.ranking[home_name]["Goal subiti"]
        )
        self.ranking[away_name]["Differenza reti"] = (
            self.ranking[away_name]["Goal fatti"]
            - self.ranking[away_name]["Goal subiti"]
        )

        self.ranking = dict(
            sorted(
                self.ranking.items(),
                key=lambda item: (item[1]["Punteggio"], item[1]["Differenza reti"]),
                reverse=True,
            )
        )

    def get_match_points(self, match: Match):
        try:
            home_team_name = self.fixer.fix_team_name(
                match.home_team.name, self.enrolled_players
            )
            away_team_name = self.fixer.fix_team_name(
                match.away_team.name, self.enrolled_players
            )
        except NameError as ne:
            self.logger.info(
                "Cannot get data for teams %s and %s: %s",
                match.home_team.name,
                match.away_team.name,
                str(ne),
            )
            return

        if (
            match.home_team.name == "MAI UNA GIOIA"
            and match.away_team.name == "HELLAS MADONNA"
        ):
            return
        self.logger.info(
            "Parsing match between %s and %s",
            match.home_team.name,
            match.away_team.name,
        )

        # get players points
        for team in [match.home_team, match.away_team]:
            players = self.fixer.remove_duplicated_players(team.players)
            for player in players:
                try:
                    id_player, points = self.calculate_player_points(
                        player=player, team_name=team.name
                    )
                except NameError as ne:
                    self.logger.error(
                        "Cannot find data about %s of %s: %s",
                        player.name,
                        team.name,
                        str(ne),
                    )
                    continue
                self.update_points(id_player, points, self.player_points)

        # get goalkeeper points
        gk_points_home, gk_points_away = self.calculate_goalkeeper_points(match)
        self.update_points(home_team_name, gk_points_home, self.goalkeeper_points)
        self.update_points(away_team_name, gk_points_away, self.goalkeeper_points)

        # get team points
        team_points_home, team_points_away = self.calculate_team_points(match)
        self.update_points(away_team_name, team_points_away, self.team_points)
        self.update_points(home_team_name, team_points_home, self.team_points)

        # update ranking
        self.update_ranking(
            score_home=match.home_team.score,
            score_away=match.away_team.score,
            home_name=home_team_name,
            away_name=away_team_name,
        )

        return

    def save_data(self):
        pathlib.Path(f"assets/{self.edition}/tmp/").mkdir(parents=True, exist_ok=True)
        pd.DataFrame(self.team_points).T.to_excel(
            f"assets/{self.edition}/tmp/{self.edition}_punti_squadra.xlsx"
        )
        pd.DataFrame(self.player_points).T.to_excel(
            f"assets/{self.edition}/tmp/{self.edition}_punteggio_giocatori.xlsx"
        )
        pd.DataFrame(self.goalkeeper_points).T.to_excel(
            f"assets/{self.edition}/tmp/{self.edition}_punteggio_portieri.xlsx"
        )
        pd.DataFrame().from_records(self.ranking).T.sort_values(
            by=["Punteggio", "Differenza reti"], ascending=[False, False]
        ).to_excel(f"assets/{self.edition}/tmp/{self.edition}_classifica.xlsx")

    def parse_tournament_data(self):
        relevant_data = sorted(glob.glob(f"assets/{self.edition}/raw/*.json"))
        self.logger.info("Reading %d results", len(relevant_data))
        for n, document_path in enumerate(relevant_data):
            self.logger.info(
                "Reading %d result of %d results", n + 1, len(relevant_data) + 1
            )
            with open(document_path, "r", encoding="utf-8") as file:
                document = json.load(file)
            results: Results = Results.from_dict(document)
            for match in results.data:
                self.get_match_points(match)
            self.save_data()
        # self.calculate_fantapoints_per_player()
        self.calculate_fantapoints_per_team()

    def calculate_fantapoints_per_player(self):
        self.player_fantapoints = self.enrolled_players.copy()[
            ["Nominativo", "Squadra", "Ruolo"]
        ]
        self.player_fantapoints["Squadra"] = self.player_fantapoints[
            "Squadra"
        ].str.upper()
        self.player_fantapoints["ID"] = self.player_fantapoints[
            ["Nominativo", "Squadra"]
        ].agg(" | ".join, axis=1)

        fantapoints_report = pd.DataFrame()
        self.player_fantapoints.sort_values(by="Squadra", inplace=True)
        for _, row in self.player_fantapoints.iterrows():
            team_points = pd.Series(self.team_points[row["Squadra"]]).fillna(
                POINTS_PER_UNPLAYED
            )
            player_points = pd.Series(self.player_points[row["ID"]]).fillna(0)
            fantapoints = team_points + player_points
            if row["Ruolo"] == "Portiere":
                gk_poits = pd.Series(self.goalkeeper_points[row["Squadra"]]).fillna(0)
                fantapoints = fantapoints + gk_poits
            fantapoints_report = fantapoints_report.append(
                fantapoints, ignore_index=True
            )
        fantapoints_report.index = self.player_fantapoints["ID"]
        fantapoints_report.to_excel(
            f"assets/{self.edition}/{self.edition}_punteggi.xlsx"
        )

    def calculate_fantapoints_per_team(self):
        # read from file since it can be modified manually
        fantapoints_report = pd.read_excel(
            f"assets/{self.edition}/{self.edition}_punteggi.xlsx"
        ).set_index("ID")
        fantapoints_report["Totale"] = fantapoints_report.sum(axis=1)
        fantapoints_report.to_excel(
            f"assets/{self.edition}/{self.edition}_punteggi.xlsx"
        )
        squadre = pd.read_excel(f"assets/{self.edition}/{self.edition}_squadre.xlsx")
        squadre.set_index("Fantallenatore", inplace=True)

        fantapoints_report.drop(columns=["Totale"], inplace=True)
        classifica = pd.DataFrame()
        for idx, row in squadre.iterrows():
            punti_portiere = fantapoints_report.loc[row["Portiere"]]
            punti_titolare_1 = fantapoints_report.loc[row["Titolare 1"]]
            punti_titolare_2 = fantapoints_report.loc[row["Titolare 2"]]
            punti_titolare_3 = fantapoints_report.loc[row["Titolare 3"]]
            riserva = fantapoints_report.loc[row["Riserva"]]
            riserva[:4] = None
            report = pd.DataFrame(
                [
                    punti_portiere,
                    punti_titolare_1,
                    punti_titolare_2,
                    punti_titolare_3,
                    riserva,
                ],
            )

            report_post_bonus = report[
                ["Bonus", "Sedicesimi", "Ottavi", "Semifinali", "Finale", "Premi"]
            ][1:].apply(lambda col: col.nlargest(3))
            report_before_bonus = report[["Match 1", "Match 2", "Match 3", "Match 4"]]
            final = report_before_bonus.join(
                report_post_bonus, on=report_before_bonus.index
            )
            final.iloc[0] = report.iloc[0]
            final.to_excel(f"assets/{self.edition}/schedine/{idx}.xlsx")
            final = final.sum()
            final["Totale"] = final.sum()

            classifica = classifica.append(final, ignore_index=True)
        classifica.index = squadre.index
        classifica.sort_values("Totale", ascending=False).to_excel(
            f"assets/{self.edition}/{self.edition}_classifica.xlsx"
        )

        return


if __name__ == "__main__":
    tournament = Tournament(2024)
    # tournament.parse_tournament_data()
    tournament.calculate_fantapoints_per_team()
