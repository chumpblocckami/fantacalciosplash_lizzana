import streamlit as st 
import pandas as pd 

BUDGET = 500 

st.set_page_config(layout="wide")
st.title("Fantacalciosplash Lizzana")

if 'budget' not in st.session_state:
        st.session_state['budget'] = BUDGET
if 'portiere' not in st.session_state:
        st.session_state['portiere'] = []
if 'titolari' not in st.session_state:
        st.session_state['titolari'] = []
if 'riserve' not in st.session_state:
        st.session_state['riserve'] = []
if 'allenatore' not in st.session_state:
        st.session_state['allenatore'] = []

if 'data' not in st.session_state:
        st.session_state["data"] = pd.read_csv("./assets/2024_fantacalciosplash.csv", delimiter=",")
        st.session_state['portieri'] = set(st.session_state["data"].loc[st.session_state['data']["Ruolo"] == "Portiere"]["Nominativo"])
        st.session_state['movimento'] = set(st.session_state["data"].loc[st.session_state['data']["Ruolo"] == "Movimento"]["Nominativo"])

if 'squadre' not in st.session_state:
        st.session_state["squadre"] = pd.read_csv("./assets/2024_squadre_fantacalciosplash.csv", delimiter=",")


def get_cost(player):
    cost =  st.session_state['data'].loc[st.session_state['data']["Nominativo"] ==player]["Quota"].astype(float)
    if cost.empty: 
          return 0 
    return float(cost)

def get_players():
      giocatori_disponibili = set(st.session_state['movimento']) - st.session_state['titolari']
      return list(giocatori_disponibili)

def load():
      st.session_state["squadre"] = pd.read_csv("./assets/2024_squadre_fantacalciosplash.csv", delimiter=",")


with st.expander("Iscrivi una squadra", expanded=True):
        
        budget = st.empty()
        budget.write(f"Budget: {st.session_state['budget']}")

        allenatore  = st.text_input("Nominativo: " )

        portiere = st.multiselect(label="Portiere", 
                                                      options=st.session_state["portieri"],
                                                      max_selections=1)

        movimento = st.multiselect(label="Giocatori", 
                                   options=st.session_state["movimento"],
                                   max_selections=3)
        
        riserve = st.multiselect(label="Riserve",  
                                 options=st.session_state["movimento"],  
                                 max_selections=3)
        
        st.session_state['budget'] = BUDGET
        for key in st.session_state:
            if key == "portiere" or key=="titolari" or key=="riserve":
                somma_quote = sum([get_cost(player) for player in st.session_state[key]])
                st.session_state["budget"] -= somma_quote
                budget.write(f"Budget: {st.session_state['budget']}")
        
        st.session_state['allenatore'] = allenatore
        st.session_state['portiere'] = portiere
        st.session_state['titolari'] = movimento
        st.session_state["riserve"] = riserve

        btn_submit = st.button("Iscrivi squadra")
        if btn_submit:
              giocatori_doppi = set(st.session_state['titolari']).intersection(set(st.session_state['riserve']))
              if len(giocatori_doppi)>0:
                    st.write(f"Giocatori presenti sia come titolari che come riserve: {giocatori_doppi}")
              elif st.session_state['budget'] < 0:
                    st.write(f"Il budget non può essere minore di zero!")
              else:
                giocatori_in_squadra = st.session_state['portiere'] + st.session_state['titolari'] + st.session_state['riserve']
                giocatori_in_squadra.append(allenatore)
                squadra = pd.Series(giocatori_in_squadra, 
                                        index="Portiere,Giocatore1,Giocatore2,Giocatore3,Riserva1,Riserva2,Riserva3,Allenatore".split(","))
                st.session_state["squadre"] .append(squadra,ignore_index=True).to_csv("./assets/2024_squadre_fantacalciosplash.csv", index=None)
                st.write("Fantasquadra iscritta!")


with st.expander("Giocatori", expanded=False) :
    st.table(st.session_state['data'])


with st.expander("Squadre", expanded=False):
    btn_reload_squadre = st.button("Reload", on_click=load)
    st.table(st.session_state['squadre'])