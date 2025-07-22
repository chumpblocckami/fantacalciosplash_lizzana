import streamlit as st


def download_rules(edition: int):
    try:
        with open(f"./assets/{edition}/regolamento.pdf", "rb") as pdf_file:
            pdf_byte = pdf_file.read()
            is_disabled = False

    except FileNotFoundError:
        pdf_byte = None
        is_disabled = True

    if pdf_byte is not None:
        st.download_button(
            label=f"Regolamento {edition}",
            data=pdf_byte,
            file_name=f"{edition}_regolamento.pdf",
            mime="application/octet-stream",
            disabled=is_disabled,
        )
    else:
        st.button(label=f"Regolamento {edition}", disabled=is_disabled)
