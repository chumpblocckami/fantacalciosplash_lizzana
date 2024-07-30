import pandas as pd
import streamlit as st

from src.env import BUDGET
from src.utils import submit_team, update_budget


class RegistrationForm:
    def __init__(self):
        pass

    def render(self):
        budget = st.empty()
        budget.write(f"Budget: {st.session_state['budget']}")

        allenatore = st.text_input("Nominativo: ")

        portiere = st.multiselect(
            label="Portiere",
            placeholder="Scegli un portiere",
            options=st.session_state["portieri"],
            max_selections=1,
        )

        movimento = st.multiselect(
            label="Giocatori",
            options=st.session_state["movimento"],
            placeholder="Scegli 3 titolari",
            max_selections=3,
        )

        riserve = st.multiselect(
            label="Riserve",
            placeholder="Scegli 3 riserve",
            options=st.session_state["movimento"],
            max_selections=3,
        )

        update_budget(budget)

        st.session_state["allenatore"] = allenatore
        st.session_state["portiere"] = portiere
        st.session_state["titolari"] = movimento
        st.session_state["riserve"] = riserve

        btn_submit = st.button("Iscrivi squadra")
        if btn_submit:
            submit_team()
