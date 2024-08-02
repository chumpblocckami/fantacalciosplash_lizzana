import os

import pandas as pd
import streamlit as st
from streamlit_dynamic_filters import DynamicFilters

from src.components.querying_table import filter_dataframe
from src.components.registration_form import RegistrationForm
from src.loader import init_session_state
from src.utils import is_current_edition

st.set_page_config(layout="wide")
st.title("Fantacalciosplash Lizzana")

editions = list(set([x.split("_")[0] for x in os.listdir("./assets")]))


with st.spinner("Caricamento..."):
    init_session_state(editions)

tabs = st.tabs(editions)

for edition, tab in zip(editions, tabs):
    with tab:
        if is_current_edition(edition):
            with st.expander("Iscrivi una squadra", expanded=True):
                registration_form = RegistrationForm(edition=edition)
                registration_form.render()

        with st.expander("Quotazione giocatori", expanded=False):
            giocatori = st.session_state["giocatori"][edition].copy()
            dynamic_filters = DynamicFilters(
                df=giocatori, filters=["Nominativo", "Soprannome", "Quota", "Squadra"]
            )
            dynamic_filters.display_filters()
            dynamic_filters.display_df()
            # filter_dataframe(giocatori, key="giocatori")
            # st.table(giocatori)
        with st.expander("Squadre iscritte", expanded=False):
            # btn_reload_squadre = st.button("Reload", on_click=load)
            squadre = st.session_state["squadre"][edition].copy()
            st.table(squadre)

        with st.expander("Punteggi giocatore", expanded=False):
            punteggi = st.session_state["giocatori"][edition].copy()
            st.table(
                punteggi,
            )

        with st.expander("Classifica ", expanded=not is_current_edition(edition)):
            edition = st.session_state["giocatori"][edition].copy()
            st.table(edition)


st.markdown(
    """
    <div style="text-align: center;">
        <h1>Made with 🍻 by GSP</h1>
    </div>
    """,
    unsafe_allow_html=True,
)
