import pandas as pd
import streamlit as st

from src.env import BUDGET


class Loader:
    def __init__(self, edition: int) -> None:
        self.edition = edition

    def load_points(self):
        st.session_state["squadre"][self.edition] = pd.read_excel(
            f"./assets/{self.edition}_squadre.xlsx"
        )

    def load_rankings(self):
        st.session_state["punteggi"][self.edition] = pd.read_excel(
            f"./assets/{self.edition}_punteggi.xlsx"
        )

    def load_teams(self):
        st.session_state["classifica"][self.edition] = pd.read_excel(
            f"./assets/{self.edition}_classifica.xlsx"
        )


def read_data(editions: list):

    st.session_state["giocatori"] = {}
    st.session_state["squadre"] = {}
    st.session_state["punteggi"] = {}
    st.session_state["classifica"] = {}

    for edition in editions:
        st.session_state["giocatori"][edition] = pd.read_excel(
            f"./assets/{edition}_giocatori.xlsx"
        )
        loader = Loader(edition=edition)
        loader.load_points()
        loader.load_teams()
        loader.load_rankings()


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
