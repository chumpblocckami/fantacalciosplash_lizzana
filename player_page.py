import json

import altair as alt
import pandas as pd
import streamlit as st

# Sample player data
PLAYER = "andrea_conzatti"
YEAR = str(2024)

with open("./assets/history.json") as file:
    player_data = json.load(file)
player_data = player_data[PLAYER]

# Scheda giocatore
st.subheader(f"{player_data['nominativo']} ({player_data[YEAR]['soprannome']})")
st.subheader(f"Squadra: {player_data[YEAR]['squadra']}")

years = [key for key in player_data if key.isdigit()]
df = pd.DataFrame(
    {year: {"nominativo": player_data["nominativo"], **player_data[year]} for year in years}
).T

df.index.name = "edizione"

df.sort_index(inplace=True)
df.drop(columns=["nominativo", "soprannome"], inplace=True)

st.markdown("### Statistiche")
st.dataframe(df)

# Chart quotazione
chart = (
    alt.Chart(df.reset_index())
    .mark_line(point=True)
    .encode(
        x=alt.X("edizione:O", title="Edizione"),
        y=alt.Y(
            "quotazione:Q",
            title="Quotazione",
            axis=alt.Axis(values=range(0, 100, 5)),
            scale=alt.Scale(domain=[0, 100]),
        ),
    )
)

st.altair_chart(chart, use_container_width=True)

# Chart goal segnati
st.bar_chart(df, y="goal", y_label="Goal segnati")

# Chart fantapunti
st.line_chart(df, y="fanta_points", y_label="Fantapunti")
