# Author: https://github.com/tylerjrichards/st-filter-dataframe
# modified by chumpblocckami

import pandas as pd
import streamlit as st
from pandas.api.types import (
    is_categorical_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
)


def filter_dataframe(df: pd.DataFrame, key: str) -> pd.DataFrame:
    """
    Adds a UI on top of a dataframe to let viewers filter columns

    Args:
        df (pd.DataFrame): Original dataframe
        key (str): key used for display multiple objects

    Returns:
        pd.DataFrame: Filtered dataframe
    """

    df = df.copy()

    # Try to convert datetimes into a standard format (datetime, no timezone)
    for col in df.columns:
        if is_object_dtype(df[col]):
            try:
                df[col] = pd.to_datetime(df[col])
            except Exception:
                pass

        if is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.tz_localize(None)

    modification_container = st.container()

    with modification_container:
        column = st.selectbox("Filtra la tabella per", df.columns, key=key)
        left, right = st.columns((1, 20))
        left.write("↳")

        if column == "Nominativo" or column == "Soprannome":
            user_text_input = right.text_input(
                f"Testo da ricercare in {column}",
            )
            if user_text_input:
                df = df[df[column].str.contains(user_text_input)]

        elif column == "Quota":
            _min = float(df[column].min())
            _max = float(df[column].max())
            step = (_max - _min) / 100
            user_num_input = right.slider(
                f"Valori per {column}",
                _min,
                _max,
                (_min, _max),
                step=step,
            )
            df = df[df[column].between(*user_num_input)]
        elif column == "Squadra":
            # Treat columns with < 10 unique values as categorical
            user_cat_input = right.multiselect(
                f"Valori per {column}",
                df[column].unique(),
                default=list(df[column].unique()),
            )
            df = df[df[column].isin(user_cat_input)]

    return df
