from datetime import datetime as dt
import pytz 
import pandas as pd
import streamlit as st

from src.env import BUDGET


def get_cost(player):
    cost = (
        st.session_state["data"]
        .loc[st.session_state["data"]["Nominativo"] == player]["Quotazione"]
        .astype(float)
    )
    if cost.empty:
        return 0
    return float(cost)


def get_players():
    giocatori_disponibili = (
        set(st.session_state["movimento"]) - st.session_state["titolari"]
    )
    return list(giocatori_disponibili)


def load(edition: int):
    st.session_state["squadre"][edition] = pd.read_csv(
        f"./assets/{edition}_squadre.xlsx", delimiter=","
    )


def update_budget(players, data):
    player_names = [player.split(" | ")[0] for player in players]
    print(player_names)
    costs = sum([float(data.loc[data["Nominativo"]==name]["Quotazione"]) for name in player_names])
    print(costs)
    return BUDGET - costs


def check_current_edition(edition: int) -> bool:
    return int(edition) == dt.datetime.now(pytz.country_names.get("Rome")).year