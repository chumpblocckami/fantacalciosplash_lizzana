import requests
from requests.exceptions import HTTPError


class FantaCalculator:
    def __init__(self) -> None:
        self.endpoint = "https://api.gsplizzana.it/api/fixtures"  # TODO: not here

    def load_results():
        
    def check_load_new_data(self):
        results = []  # self.load_results()
        try:
            new_data = requests.get(self.endpoint, timeout=3).json()["data"]
        except HTTPError:
            return False, "Sem embriaghi! Riprova più tardi"

        if len(new_data) > len(results):
            # download and update data
            return True, "Risultati aggiornati"
