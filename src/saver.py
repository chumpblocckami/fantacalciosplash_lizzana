import os

import pandas as pd
from git import Repo


class Saver:
    def __init__(self, repo_path: str) -> None:
        self.repo = Repo(repo_path, search_parent_directories=True)
        self.branch = "main"

    def commit_and_push(self, file_path: str, commit_message: str):

        if self.repo.is_dirty():
            print("This repo has uncommited changes")

        self.repo.index.add([file_path])
        self.repo.index.commit(commit_message)
        origin = self.repo.remote(name="origin")
        origin.push(refspec=f"{self.branch}:{self.branch}")

    def pull_latest(self):
        origin = self.repo.remote(name="origin")
        origin.pull(self.branch)

    def get_path(self, file: str):
        return f"{os.path.dirname(os.path.dirname(os.path.realpath(__file__)))}/{file}"

    def submit_team(
        self,
        allenatore: str,
        portiere: list,
        titolari: list,
        riserve: list,
        edition: int,
        budget: int,
    ):
        giocatori_doppi = set(titolari).intersection(set(riserve))

        if len(giocatori_doppi) > 0:
            return f"Giocatori presenti sia come titolari che come riserve: {giocatori_doppi}"

        if budget < 0:
            return "Il budget non può essere minore di zero!"

        giocatori_in_squadra = [allenatore] + portiere + titolari + riserve
        squadra = pd.Series(
            giocatori_in_squadra,
            index="Fantallenatore,Portiere,Titolare 1,Titolare 2,Titolare 3,Riserva".split(
                ","
            ),
        )
        file_path = self.get_path(f"assets/{edition}_squadre.xlsx")
        squadre = pd.read_excel(file_path)
        squadre.append(squadra, ignore_index=True).to_excel(file_path, index=None)

        self.commit_and_push(file_path, commit_message=f"Added {allenatore} team")
        self.pull_latest()
        return "Fantasquadra iscritta!"


if __name__ == "__main__":
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_path = dir_path + "/test.py"
    saver = Saver(dir_path)
    saver.commit_and_push(file_path=file_path, commit_message="Updated")
