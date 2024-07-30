import os

import pandas as pd
import streamlit as st

from src.components.registration_form import RegistrationForm
from src.loader import init_session_state
from src.utils import load

st.set_page_config(layout="wide")
st.title("Fantacalciosplash Lizzana")

editions = list(set([x.split("_")[0] for x in os.listdir("./assets")]))
tabs = st.tabs(editions)

for edition, tab in zip(editions, tabs):
    with tab:
        print(edition)
        init_session_state(edizione=int(edition))

        if st.session_state["current_edition"]:
            with st.expander("Iscrivi una squadra", expanded=True):
                registration_form = RegistrationForm()
                registration_form.render()

        with st.expander("Giocatori", expanded=False):
            st.table(st.session_state["data"])

        with st.expander("Squadre", expanded=False):
            # btn_reload_squadre = st.button("Reload", on_click=load)
            st.table(st.session_state["squadre"])

        with st.expander("Punteggi", expanded=False):
            st.table(st.session_state["punteggi"])

        with st.expander(
            "Classifica", expanded=not st.session_state["current_edition"]
        ):
            st.table(st.session_state["classifica"])


st.markdown(
    """
    <div style="text-align: center;">
        <h1>Made with 🍻 by GSP</h1>
    </div>
    """,
    unsafe_allow_html=True,
)
