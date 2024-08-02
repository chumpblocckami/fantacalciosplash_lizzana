from datetime import datetime as dt

import pandas as pd
import streamlit as st

from src.env import BUDGET


def get_cost(player):
    cost = (
        st.session_state["data"]
        .loc[st.session_state["data"]["Nominativo"] == player]["Quota"]
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


def update_budget(budget: st.empty):
    st.session_state["budget"] = BUDGET
    for key in st.session_state:
        if key == "portiere" or key == "titolari" or key == "riserve":
            somma_quote = sum([get_cost(player) for player in st.session_state[key]])
            st.session_state["budget"] -= somma_quote
            budget.write(f"Budget: {st.session_state['budget']}")


def check_current_edition(edition: int) -> bool:
    return int(edition) == dt.now().year
