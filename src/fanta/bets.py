from datetime import datetime

import Levenshtein
import pandas as pd

YEAR = datetime.now().year


def sanitize_player_name(player_name: str) -> str:
    """Player input is made by:
        Nominativo | NOME_SQUADRA
    This function sanitizes the input by ensuring proper capitalization and removing extra spaces.
    """
    player, team = player_name.split("|")
    player = " ".join(player.split()).title()
    team = team.strip().upper()
    return f"{player} | {team}"


teams = pd.read_excel(f"./assets/{YEAR}/squadre.xlsx").drop_duplicates()
points = pd.read_csv(f"./assets/{YEAR}/punteggi.csv").drop_duplicates()
ranking = []

for _, team in teams.iterrows():
    my_players_raw = team.iloc[1:].apply(lambda x: sanitize_player_name(x))
    my_players = []

    for player in my_players_raw:
        fixed_player = min(points["player"], key=lambda x: Levenshtein.distance(player, x))
        if Levenshtein.ratio(fixed_player, player) < 0.9:
            print("Mismatch found:", player, "->", fixed_player)
            break
        my_players.append(fixed_player)

    filtered = points[points["player"].isin(my_players)].copy()
    filtered["player"] = pd.Categorical(filtered["player"], categories=my_players, ordered=True)
    my_team_stats = filtered.sort_values("player").reset_index(drop=True)
    my_team_stats.set_index("player", inplace=True)

    if my_team_stats.shape[0] < len(my_players):
        print(f"ERRORI in {team}!")
        continue

    match_columns = [col for col in my_team_stats.columns if col.startswith("Match")]
    my_team_stats = my_team_stats[match_columns]

    mask = pd.DataFrame(False, index=my_team_stats.index, columns=my_team_stats.columns)

    first_four_players = my_players[:4]
    first_three_matches = ["Match 1", "Match 2", "Match 3", "Match 4"]
    mask.loc[first_four_players, first_three_matches] = True

    for match in match_columns[4:]:
        top_players = my_team_stats[match].nlargest(4).index
        mask.loc[top_players, match] = True

    bets = my_team_stats.where(mask)

    bets.to_excel(f"./assets/{YEAR}/results/{team['Fantallenatore']}.xlsx")
    ranking.append({"Allenatore": team.iloc[0], "Punteggio": bets.sum(numeric_only=True).sum()})
pd.DataFrame().from_records(ranking).sort_values("Punteggio", ascending=False).to_csv(
    f"assets/{YEAR}/final_ranking.csv"
)
