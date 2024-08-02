import pandas as pd
import streamlit as st

from src.env import BUDGET
from src.utils import submit_team, update_budget


class RegistrationForm:
    def __init__(self, edition):
        self.edition = edition
        self.edition_data = st.session_state["giocatori"][self.edition]
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
            placeholder="Scegli 3 riserve",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Movimento"],
            max_selections=3,
            key=f"riserve_{self.edition}",
        )

        update_budget(budget)

        btn_submit = st.button("Iscrivi squadra", key=f"iscrizione_{self.edition}")
        if btn_submit:
            submit_team(allenatore, portiere, titolari, riserve, self.edition)
