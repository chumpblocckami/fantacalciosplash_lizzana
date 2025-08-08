import os

import pandas as pd
from dotenv import load_dotenv
from git import GitCommandError, Repo

load_dotenv()


class Saver:
    def __init__(self, repo_path: str) -> None:
        self.repo = Repo(repo_path, search_parent_directories=True)
        self.branch = "main"
        self.github_username = os.environ.get("GITHUB_USER", "")
        self.access_token = os.environ.get("GITHUB_TOKEN", "")
        self.remote_repo = "fantacalciosplash_lizzana"
        self.endpoint = f"https://{self.github_username}:{self.access_token}@github.com/{self.github_username}/{self.remote_repo}.git"  # noqa

    def init_repo(self):
        try:

            origin = self.repo.remote(name="origin")

            origin.push(refspec=f"{self.branch}:{self.branch}")
        except GitCommandError as e:
            print(f"GitCommandError: {e}")

    def commit_and_push(self, file_path: str, commit_message: str):
        try:
            if self.repo.is_dirty():
                print("Repo has uncommitted changes")

            # Stage and commit changes
            self.repo.index.add([file_path])
            self.repo.index.commit(commit_message)

            # Ensure the remote URL is up to date
            origin = self.repo.remote(name="origin")
            origin.set_url(self.endpoint)

            # Pull the latest to avoid non-fast-forward errors
            print("Pulling latest changes before push...")
            origin.pull(self.branch)

            # Push to remote
            print("Pushing changes to remote...")
            origin.push(refspec=f"{self.branch}:{self.branch}")
        except GitCommandError as e:
            print(f"GitCommandError during commit_and_push: {e}")
            raise

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
    ):
        giocatori_in_squadra = [allenatore] + portiere + titolari + riserve
        squadra = pd.DataFrame(
            [giocatori_in_squadra],
            columns="Fantallenatore,Portiere,Titolare 1,Titolare 2,Titolare 3,Riserva".split(","),
        )
        file_path = self.get_path(f"assets/{edition}/squadre.xlsx")
        squadre = pd.read_excel(file_path)
        pd.concat([squadre, squadra]).to_excel(file_path, index=None)

        self.commit_and_push(file_path, commit_message=f"Added {allenatore} team")
        self.pull_latest()
        return "Fantasquadra iscritta!"
