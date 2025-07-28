import pandas as pd

teams = pd.read_excel("./assets/2024/squadre.xlsx")
points = pd.read_csv("./points.csv")
ranking = {}

for team in teams.iterrows():

    my_players = teams.iloc[0, 1:].tolist()
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
    ranking[team["Fantallenatore"]] = bets.sum().sum()
    bets["player_total"] = bets.sum(axis=1)
    bets.loc["match_total"] = bets.sum(numeric_only=True)
    bets.to_excel(f"./assets/2024/results/{team['Fantallenatore']}.csv")

pd.DataFrame([ranking], index=["points"]).T.sort_values("points", ascending=False).to_csv(
    "assets/2024/final_ranking.csv"
)
