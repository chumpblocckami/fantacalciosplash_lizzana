import os
from datetime import datetime as dt

import pytz
import streamlit as st
from PIL import Image

from src.components.registration_form import RegistrationForm
from src.components.support_graph import SupportGraph
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

with open("./assets/2024_regolamento.pdf", "rb") as pdf_file:
    pdf_byte = pdf_file.read()

st.download_button(
    label="Scarica regolamento",
    data=pdf_byte,
    file_name="2024_regolamento.pdf",
    mime="application/octet-stream",
)

editions = list(set([x.split("_")[0] for x in os.listdir("./assets")]))
editions.sort(reverse=True)

with st.spinner("Caricamento..."):
    init_session_state(editions)

tabs = st.tabs(editions)
today = dt.now(pytz.country_names.get("Rome"))

for edition, tab in zip(editions, tabs):
    loader = Loader(edition=edition)
    is_current_edition = check_current_edition(edition)
    with tab:
        if is_current_edition:
            if today.month == 8:
                if today.day <= 14:
                    if today.day == 14 and today.hour >= 14:
                        st.write("Iscrizioni chiuse! Ci vediamo sul gonfiabile")
                    else:
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
                    "Aggiorna squadre",
                    on_click=loader.load_teams,
                    key=f"{edition}_reload_teams",
                )
            squadre = st.session_state["squadre"][edition].copy()
            if today.month == 8:
                if today.day <= 14:
                    if today == 14:
                        if today.hour >= 14:
                            st.table(squadre)
                    else:
                        st.write(
                            """Le squadre sono state nascoste, verranno visualizzate quando inizierà il torneo.
                            Al momento sono visibili solo i nomi dei fantallenatori e alcune statistiche."""
                        )
                        st.table(squadre["Fantallenatore"])
            else:
                st.table(squadre)
            if squadre.shape[0] > 5:
                SupportGraph().render(squadre.drop(columns=["Fantallenatore"]).items())

        with st.expander("Punteggi giocatore 🍿", expanded=False):
            if is_current_edition:
                btn_reload_points = st.button(
                    "Aggiorna punteggi",
                    on_click=loader.load_points,
                    key=f"{edition}_reload_players",
                )
            punteggi = st.session_state["punteggi"][edition].copy()
            st.table(punteggi)

        with st.expander("Classifica 💯", expanded=not is_current_edition):
            if is_current_edition:
                btn_reload_rankings = st.button(
                    "Aggiorna classifica",
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
