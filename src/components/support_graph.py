import itertools
from collections import Counter

import numpy as np
import pandas as pd
import streamlit as st


class SupportGraph:
    def __init__(self) -> None:
        pass

    def render(self, data: np.array):
        data: list = list(itertools.chain(*[x[1] for x in data]))
        return st.bar_chart(
            pd.DataFrame(
                Counter(data).most_common(20), columns=["Giocatore", "Acquisti"]
            ).sort_values("Acquisti"),
            x="Giocatore",
            y="Acquisti",
        )
