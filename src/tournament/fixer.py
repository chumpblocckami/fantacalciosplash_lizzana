import difflib

import pandas as pd
from domain import Player


class Fixer:
    """
    This class is used for fix everything
    """

    def __init__(self) -> None:
        self.manual_fixes = {"I MONTAGNA": "IMONTAGNA"}

    def fix_team_name(self, name: str, enrolled_players: pd.DataFrame):

        teams = enrolled_players["Squadra"].str.upper()
        team = difflib.get_close_matches(name, teams, cutoff=0.75)
        if len(team) >= 1:
            return team[0]
        raise NameError("Porcoddio")

    def correct_name(self, name: str, team: str, enrolled_players: pd.DataFrame):
        corrected_team = team.upper()
        if corrected_team in self.manual_fixes:
            corrected_team = self.manual_fixes[corrected_team]

        player_data = enrolled_players.loc[
            (enrolled_players["Nominativo"] == name)
            & (enrolled_players["Squadra"].str.upper() == corrected_team)
        ]
        if player_data.shape[0] > 0:
            return f"{player_data['Nominativo'].item()} | {corrected_team}"

        # misspelled player name from data. Try to fix it
        teams = enrolled_players.loc[
            enrolled_players["Squadra"].str.upper() == corrected_team
        ]
        player = difflib.get_close_matches(name, teams["Nominativo"], cutoff=0.75)
        if len(player) == 1:
            return f"{player[0]} | {corrected_team}"

        # misspelled team name from data. Try to fix it
        teams = enrolled_players.loc[enrolled_players["Nominativo"] == name]
        if teams.shape[0] > 0:
            return f"{name} | {teams.get('Squadra').item().upper()}"

        # misspelled both (porcoddio)
        players = enrolled_players["Nominativo"]
        player = difflib.get_close_matches(name, players, cutoff=0.75)
        if len(player) == 1:
            teams = enrolled_players.loc[enrolled_players["Nominativo"] == player[0]]
            if teams.shape[0] > 0:
                return f"{player[0]} | {teams.get('Squadra').item().upper()}"

        raise NameError("PORCODDIO")

    def remove_duplicated_players(self, players: list[Player]):
        seen = set()
        unique_players = []
        for player in players:
            if (player.name, player.surname, player.username) not in seen:
                unique_players.append(player)
                seen.add((player.name, player.surname, player.username))
        return unique_players

    def fix_database_giocatori(self, path: str):
        data = pd.read_excel(path)
        data["Nominativo"] = data["Nominativo"].apply(
            lambda x: " ".join(
                [
                    x.strip().replace(" ", "").lower().capitalize()
                    for x in x.split(" ")
                    if x != ""
                ]
            )
        )
        data["Soprannome"].fillna("", inplace=True)
        data["Soprannome"] = data["Soprannome"].apply(
            lambda x: " ".join(
                [
                    x.strip().replace(" ", "").lower().capitalize()
                    for x in x.split(" ")
                    if x != ""
                ]
            )
        )
        data = (
            data.drop_duplicates()
            .dropna()
            .drop(columns=[x for x in data.columns if "Unnamed" in x])
            .reset_index(drop=True)
        )
        data.to_excel(path, index=False)

    def name_small_team_upper(self, text):
        if "|" not in text:
            return text
        name, team = text.split(" | ")
        name = " ".join(
            [
                x.strip().replace(" ", "").lower().capitalize()
                for x in name.split(" ")
                if x != ""
            ]
        )
        team = team.upper()
        return " | ".join([name, team])

    def fix_database_squadre(self, path: str):
        data = pd.read_excel(path)
        data = (
            data.drop_duplicates()
            .dropna()
            .drop(columns=[x for x in data.columns if "Unnamed" in x])
            .reset_index(drop=True)
        )
        data["Portiere"] = data["Portiere"].apply(
            lambda x: self.name_small_team_upper(x)
        )
        data["Titolare 1"] = data["Titolare 1"].apply(
            lambda x: self.name_small_team_upper(x)
        )
        data["Titolare 2"] = data["Titolare 2"].apply(
            lambda x: self.name_small_team_upper(x)
        )
        data["Titolare 3"] = data["Titolare 3"].apply(
            lambda x: self.name_small_team_upper(x)
        )
        data["Riserva"] = data["Riserva"].apply(lambda x: self.name_small_team_upper(x))
        data.to_excel(path, index=False)


if __name__ == "__main__":
    fixer = Fixer()
    # fixer.fix_database_giocatori("./assets/2024/2024_giocatori.xlsx")
    fixer.fix_database_squadre("./assets/2024/2024_squadre.xlsx")
