import json
from dataclasses import dataclass

import pandas as pd
import streamlit as st

from constants import BUDGET


@dataclass
class Match:
    id: int
    home_team_name: str
    home_team_score: int
    home_team_goals: list[str]

    away_team_name: str
    away_team_score: int
    away_team_goals: list[str]

    is_live: bool
    is_finished: bool


@dataclass
class Results:
    matches: list[Match]


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

    def load_results(self):
        with open(
            f"./assets/{self.edition}_risultati.json", "r", encoding="utf-8"
        ) as file:
            parsed = Results(**json.loads(file))
        st.session_state["risultati"][self.edition] = parsed.matches


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
