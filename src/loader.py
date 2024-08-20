import json
from dataclasses import dataclass

import pandas as pd
import requests
import streamlit as st

from tournament.constants import BUDGET
from tournament.diagnostic import init_logger
from tournament.domain import Results


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


class ApiReader:
    def __init__(self, edition: int):
        self.edition = edition
        self.logger = init_logger(edition=self.edition, name="api_reader")

    def get_data(self):
        has_data: bool = True
        id_group: int = 1
        while has_data:
            try:
                url: str = f"https://api.gsplizzana.it/api/groups/{id_group}/fixtures"
                raw_data: dict = requests.get(url, timeout=10).json()
                meta = Results.from_dict(raw_data).meta
                for page in range(1, meta.last_page + 1):
                    self.logger.info("Reading page %s of %s", page, meta.last_page)
                    url: str = (
                        f"https://api.gsplizzana.it/api/groups/{id_group}/fixtures?page={page}"
                    )
                    self.logger.info("Parsing %s", url)
                    raw_data: dict = requests.get(url, timeout=5).json()

                    with open(
                        f"assets/{self.edition}/raw/{self.edition}_{id_group:03}_page_{page:03}.json",
                        "w",
                        encoding="utf-8",
                    ) as file:
                        json.dump(raw_data, file)
                id_group += 1
            except Exception as e:
                has_data = False
                self.logger.error(e)


if __name__ == "__main__":
    ApiReader(edition=2024).get_data()
