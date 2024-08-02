import os

import pandas as pd
import streamlit as st

from src.env import BUDGET
from src.saver import Saver
from src.utils import update_budget


class RegistrationForm:
    def __init__(self, edition):
        self.edition = edition
        self.edition_data = st.session_state["giocatori"][self.edition]
        self.saver = Saver(repo_path=os.path.dirname(os.path.realpath(__file__)))
        pass

    def render(self):
        budget = st.empty()
        budget.write(f"Budget: {st.session_state['budget']}")

        allenatore = st.text_input("Nominativo: ", key=f"coach_{self.edition}")

        portiere = st.multiselect(
            label="Portiere",
            placeholder="Scegli un portiere",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Portiere"],
            max_selections=1,
            key=f"portiere_{self.edition}",
        )

        titolari = st.multiselect(
            label="Giocatori",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Movimento"],
            placeholder="Scegli 3 titolari",
            max_selections=3,
            key=f"movimento_{self.edition}",
        )

        riserve = st.multiselect(
            label="Riserve",
            placeholder="Scegli 1 riserva",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Movimento"],
            max_selections=1,
            key=f"riserve_{self.edition}",
        )

        update_budget(budget)

        btn_submit = st.button("Iscrivi squadra", key=f"iscrizione_{self.edition}")
        if btn_submit:
            output = self.saver.submit_team(
                allenatore,
                portiere,
                titolari,
                riserve,
                self.edition,
                st.session_state["budget"],
            )
            st.write(output)
