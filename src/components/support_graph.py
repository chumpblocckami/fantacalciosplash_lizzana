import numpy as np 
import itertools
import streamlit as st 
from collections import Counter 
import pandas as pd 

class SupportGraph():
    def __init__(self) -> None:
        pass 

    def render(self, data: np.array):
        data: list = list(itertools.chain(*[x[1] for x in data]))
        return st.bar_chart(pd.DataFrame(Counter(data).most_common(10), columns=["Giocatore","Acquisti"]).sort_values("Acquisti"), x="Giocatore",y="Acquisti")