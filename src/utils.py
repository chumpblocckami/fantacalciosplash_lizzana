from datetime import datetime as dt

import pandas as pd
import pytz
import streamlit as st

from src.constants import BUDGET


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
    giocatori_disponibili = set(st.session_state["movimento"]) - st.session_state["titolari"]
    return list(giocatori_disponibili)


def load(edition: int):
    st.session_state["squadre"][edition] = pd.read_csv(
        f"./assets/{edition}/squadre.xlsx", delimiter=","
    )


def update_budget(players, data):
    player_names = [player.split(" | ")[0] for player in players]
    costs = sum(
        [float(data.loc[data["Nominativo"] == name]["Quotazione"]) for name in player_names]
    )
    return BUDGET - costs


def check_current_edition(edition: int) -> bool:
    return int(edition) == dt.now(pytz.country_names.get("Rome")).year


def validate(allenatore: str, titolari: list, riserve: list, budget: float):
    errors = []
    flag = True
    chosen_team = [x.split(" | ")[1] for x in titolari + riserve]
    if len(set(chosen_team)) < len(chosen_team):
        errors.append("Non puoi convocare due giocatori di movimento della stessa squadra!")
        flag = False

    giocatori_doppi = set(titolari).intersection(set(riserve))
    if len(giocatori_doppi) > 0:
        errors.append(
            f"""Giocatori presenti sia come titolari che come riserve: """
            f"""{','.join(list(giocatori_doppi))}"""
        )
        flag = False
    if allenatore == "":
        errors.append("Prego inserire il nome dell'allenatore!")
        flag = False
    if budget < 0:
        errors.append("Il budget non può essere minore di zero!")
        flag = False
    return flag, errors


def get_element_visibility():
    today = dt.now(pytz.timezone("Europe/Rome"))
    if today.month == 8:
        if today.day >= 14 and today.hour > 12:
            return False
        else:
            return True
    return True
