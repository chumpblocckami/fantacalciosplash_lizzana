import os

import streamlit as st

from src.saver import Saver
from src.utils import update_budget, validate


class RegistrationForm:
    def __init__(self, edition):
        self.edition = edition
        self.edition_data = st.session_state["giocatori"][self.edition]
        self.saver = Saver(repo_path=os.path.dirname(os.path.realpath(__file__)))
        pass

    def render(self):
        lbl_budget = st.empty()
        lbl_budget.write(f"Budget: {st.session_state['budget']}")

        allenatore = st.text_input("Nominativo: ", key=f"coach_{self.edition}")

        portiere = st.multiselect(
            label="Portiere",
            placeholder="Scegli un portiere",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Portiere"][
                ["Nominativo", "Squadra"]
            ].agg(" | ".join, axis=1),
            max_selections=1,
            key=f"portiere_{self.edition}",
        )

        titolari = st.multiselect(
            label="Giocatori",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Movimento"][
                ["Nominativo", "Squadra"]
            ].agg(" | ".join, axis=1),
            placeholder="Scegli 3 titolari",
            max_selections=3,
            key=f"movimento_{self.edition}",
        )

        riserve = st.multiselect(
            label="Riserve",
            placeholder="Scegli 1 riserva",
            options=self.edition_data.loc[self.edition_data["Ruolo"] == "Movimento"][
                ["Nominativo", "Squadra"]
            ].agg(" | ".join, axis=1),
            max_selections=1,
            key=f"riserve_{self.edition}",
        )

        remaining_budget = update_budget(
            portiere + titolari + riserve, self.edition_data
        )
        lbl_budget.write(f"Budget: {remaining_budget}")

        is_validate, outputs = validate(
            allenatore=allenatore,
            riserve=riserve,
            titolari=titolari,
            budget=remaining_budget,
        )
        if not is_validate:
            for error in outputs:
                st.error(f"{error}")

        btn_submit = st.button(
            "Iscrivi squadra",
            key=f"iscrizione_{self.edition}",
            disabled=(not is_validate),
        )
        if btn_submit:
            with st.spinner("Iscrizione formazione..."):
                success_message = self.saver.submit_team(
                    allenatore,
                    portiere,
                    titolari,
                    riserve,
                    self.edition,
                )
                st.write(success_message)
