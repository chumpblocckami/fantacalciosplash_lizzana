from datetime import datetime as dt

import pandas as pd
import streamlit as st

from src.env import BUDGET


def init_session_state(edizione: int):
    if "edizione" not in st.session_state:
        st.session_state["edizione"] = edizione
    if "current_edition" not in st.session_state:
        st.session_state["current_edition"] = edizione == dt.now().year
    if "budget" not in st.session_state:
        st.session_state["budget"] = BUDGET
    if "portiere" not in st.session_state:
        st.session_state["portiere"] = []
    if "titolari" not in st.session_state:
        st.session_state["titolari"] = []
    if "riserve" not in st.session_state:
        st.session_state["riserve"] = []
    if "allenatore" not in st.session_state:
        st.session_state["allenatore"] = []

    if "data" not in st.session_state:
        st.session_state["data"] = pd.read_excel(
            f"./assets/{edizione}_giocatori.xlsx",
        )
        st.session_state["portieri"] = set(
            st.session_state["data"].loc[
                st.session_state["data"]["Ruolo"] == "Portiere"
            ]["Nominativo"]
        )
        st.session_state["movimento"] = set(
            st.session_state["data"].loc[
                st.session_state["data"]["Ruolo"] == "Movimento"
            ]["Nominativo"]
        )

    if "squadre" not in st.session_state:
        st.session_state["squadre"] = pd.read_excel(
            f"./assets/{edizione}_squadre.xlsx",
        )

    if "punteggi" not in st.session_state:
        st.session_state["punteggi"] = pd.read_excel(
            f"./assets/{edizione}_punteggi.xlsx",
        ).fillna(0)

    if "classifica" not in st.session_state:
        st.session_state["classifica"] = pd.read_excel(
            f"./assets/{edizione}_classifica.xlsx",
        )
