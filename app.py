import os

import streamlit as st
from PIL import Image
import datetime as dt 
from src.components.registration_form import RegistrationForm
from src.loader import Loader, init_session_state
from src.utils import check_current_edition

st.set_page_config(
    page_title="Fantacalciosplash Lizzana",
    page_icon=Image.open("favicon.ico"),
    layout="wide",
)
st.markdown(
    """
    <div style="text-align: center;">
        <h1>Fantacalciosplash Lizzana ⚽</h1>
    </div>
    """,
    unsafe_allow_html=True,
)

editions = list(set([x.split("_")[0] for x in os.listdir("./assets")]))
editions.sort(reverse=True)

with st.spinner("Caricamento..."):
    init_session_state(editions)

tabs = st.tabs(editions)

for edition, tab in zip(editions, tabs):
    loader = Loader(edition=edition)
    is_current_edition = check_current_edition(edition)
    with tab:
        if is_current_edition:
            with st.expander("Iscrivi una squadra 🤼‍♂️", expanded=True):
                registration_form = RegistrationForm(edition=edition)
                registration_form.render()

        with st.expander("Quotazione giocatori 💰", expanded=False):
            giocatori = st.session_state["giocatori"][edition].copy()
            st.download_button(
                label="Scarica ⏬",
                data=giocatori.to_csv().encode("utf-8"),
                file_name=f"{edition}_giocatori.csv",
                mime="text/csv",
            )
            st.table(giocatori)

        with st.expander("Squadre iscritte 👯‍♀️", expanded=False):
            if is_current_edition:
                btn_reload_teams = st.button(
                    "Reload",
                    on_click=loader.load_teams,
                    key=f"{edition}_reload_teams",
                )
            squadre = st.session_state["squadre"][edition].copy()
            today =  dt.datetime.now()
            if today.month == 8 and today.day <= 14:
                st.write("""Le squadre sono state nascoste, verranno visualizzate quando inizierà il torneo.
                         Al momento sono visibili solo i nomi dei fantallenatori.""")
                st.table(squadre["Fantallenatore"])
                # todo: visualizza un grafico con 
                #1. giocatore piu preso
                #2. squadra con piu giocatori
            else:
                st.table(squadre)

        with st.expander("Punteggi giocatore 🍿", expanded=False):
            if is_current_edition:
                btn_reload_points = st.button(
                    "Reload",
                    on_click=loader.load_points,
                    key=f"{edition}_reload_players",
                )
            punteggi = st.session_state["punteggi"][edition].copy()
            st.table(punteggi)

        with st.expander("Classifica 💯", expanded=not is_current_edition):
            if is_current_edition:
                btn_reload_rankings = st.button(
                    "Reload",
                    on_click=loader.load_rankings,
                    key=f"{edition}_reload_rankings",
                )
            edition = st.session_state["classifica"][edition].copy()
            st.table(edition)


st.markdown(
    """
    <div style="text-align: center;">
        <p>Made with 🍻 by GSP</p>
    </div>
    """,
    unsafe_allow_html=True,
)
