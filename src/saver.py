import os
import pandas as pd
from git import GitCommandError, Repo

from dotenv import load_dotenv

load_dotenv()
class Saver:
    def __init__(self, repo_path: str) -> None:
        self.repo = Repo(repo_path, search_parent_directories=True)
        self.branch = "main"
        self.github_username = os.environ["GITHUB_USER"]
        self.access_token = os.environ["GITHUB_TOKEN"]
        self.remote_repo = os.environ["REMOTE_REPO"]
        self.endpoint = f"https://{self.github_username}:{self.access_token}@github.com/{self.github_username}/{self.remote_repo}.git"

    def init_repo(self):
        try:

            origin = self.repo.remote(name="origin")

            origin.push(refspec=f"{self.branch}:{self.branch}")
        except GitCommandError as e:
            print(f"GitCommandError: {e}")

    def commit_and_push(self, file_path: str, commit_message: str):

        if self.repo.is_dirty():
            print("This repo has uncommited changes")

        self.repo.index.add([file_path])
        self.repo.index.commit(commit_message)
        origin = self.repo.remote(name="origin")
        origin.set_url(self.endpoint)
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
        chosen_team = [x.split(" | ")[1] for x in titolari + riserve]
        if len(set(chosen_team)) < len(chosen_team):
            return f"Non puoi convocare due giocatori di movimento della stessa squadra!"
    
        giocatori_doppi = set(titolari).intersection(set(riserve))

        if len(giocatori_doppi) > 0:
            return f"Giocatori presenti sia come titolari che come riserve: {giocatori_doppi}"

        if budget < 0:
            return "Il budget non può essere minore di zero!"

        giocatori_in_squadra = [allenatore] + portiere + titolari + riserve
        squadra = pd.DataFrame(
            [giocatori_in_squadra],
            columns="Fantallenatore,Portiere,Titolare 1,Titolare 2,Titolare 3,Riserva".split(
                ","
            ),
        )
        file_path = self.get_path(f"assets/{edition}_squadre.xlsx")
        squadre = pd.read_excel(file_path)
        pd.concat([squadre, squadra]).to_excel(file_path, index=None)

        self.commit_and_push(file_path, commit_message=f"Added {allenatore} team")
        self.pull_latest()
        return "Fantasquadra iscritta!"
