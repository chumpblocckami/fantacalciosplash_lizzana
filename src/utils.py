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


def load():
    st.session_state["squadre"] = pd.read_csv(
        "./assets/2024_squadre.csv", delimiter=","
    )


def update_budget(budget: st.empty):
    st.session_state["budget"] = BUDGET
    for key in st.session_state:
        if key == "portiere" or key == "titolari" or key == "riserve":
            somma_quote = sum([get_cost(player) for player in st.session_state[key]])
            st.session_state["budget"] -= somma_quote
            budget.write(f"Budget: {st.session_state['budget']}")


def submit_team():
    giocatori_doppi = set(st.session_state["titolari"]).intersection(
        set(st.session_state["riserve"])
    )
    if len(giocatori_doppi) > 0:
        st.write(
            f"Giocatori presenti sia come titolari che come riserve: {giocatori_doppi}"
        )
    elif st.session_state["budget"] < 0:
        st.write("Il budget non può essere minore di zero!")
    else:
        giocatori_in_squadra = (
            st.session_state["portiere"]
            + st.session_state["titolari"]
            + st.session_state["riserve"]
        )
        giocatori_in_squadra.append(st.session_state["allenatore"])
        squadra = pd.Series(
            giocatori_in_squadra,
            index="Portiere,Giocatore1,Giocatore2,Giocatore3,Riserva1,Riserva2,Riserva3,Allenatore".split(
                ","
            ),
        )
        squadre = pd.read_csv("./assets/2024_squadre.csv", delimiter=",")
        squadre.append(squadra, ignore_index=True).to_excel(
            "./assets/2024_squadre.xlsx", index=None
        )
        st.write("Fantasquadra iscritta!")
