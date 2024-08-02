import pandas as pd
import streamlit as st

from src.env import BUDGET


def read_data(editions):

    st.session_state["giocatori"] = {}
    st.session_state["squadre"] = {}
    st.session_state["punteggi"] = {}
    st.session_state["classifica"] = {}

    for edition in editions:
        st.session_state["giocatori"][edition] = pd.read_excel(
            f"./assets/{edition}_giocatori.xlsx"
        )
        st.session_state["squadre"][edition] = pd.read_excel(
            f"./assets/{edition}_squadre.xlsx"
        )
        st.session_state["punteggi"][edition] = pd.read_excel(
            f"./assets/{edition}_punteggi.xlsx"
        )
        st.session_state["classifica"][edition] = pd.read_excel(
            f"./assets/{edition}_classifica.xlsx"
        )


def init_session_state(editions: int):

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

    read_data(editions)
