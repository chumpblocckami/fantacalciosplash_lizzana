import os

import pandas as pd
from git import GitCommandError, Repo


def test_git():
    # Replace with your GitHub username and personal access token
    github_username = "your_github_username"
    personal_access_token = os.getenv("GITHUB_ACCESS_TOKEN")
    repository_path = "/path/to/your/repository"

    # Set up the remote URL with the personal access token
    remote_url = f"""https://{github_username}:{personal_access_token}@github.com/chumpblocckami/"""
    """fantacalciosplash_lizzana.git"""

    try:
        # Open the repository
        repo = Repo(repository_path)

        # Ensure the repository is not bare
        if repo.bare:
            raise Exception("The repository is bare")

        # Set the URL for the remote 'origin'
        origin = repo.remotes.origin
        origin.set_url(remote_url)

        # Push changes to the repository
        origin.push("main:main")
        print("Push successful")

    except GitCommandError as e:
        print(f"GitCommandError: {e.stderr}")
    except Exception as e:
        print(f"Error: {e}")


def fix_database_giocatori(path: str):
    data = pd.read_excel(path)
    data["Nominativo"] = data["Nominativo"].apply(
        lambda x: " ".join(
            [x.strip().replace(" ", "").lower().capitalize() for x in x.split(" ") if x != ""]
        )
    )
    data["Soprannome"].fillna("", inplace=True)
    data["Soprannome"] = data["Soprannome"].apply(
        lambda x: " ".join(
            [x.strip().replace(" ", "").lower().capitalize() for x in x.split(" ") if x != ""]
        )
    )
    data = (
        data.drop_duplicates()
        .dropna()
        .drop(columns=[x for x in data.columns if "Unnamed" in x])
        .reset_index(drop=True)
    )
    data.to_excel(path, index=False)


def fix_database_squadre(path: str):
    data = pd.read_excel(path)
    data = (
        data.drop_duplicates()
        .dropna()
        .drop(columns=[x for x in data.columns if "Unnamed" in x])
        .reset_index(drop=True)
    )
    data.to_excel(path, index=False)


if __name__ == "__main__":
    fix_database_giocatori("./assets/2024/giocatori.xlsx")
    fix_database_squadre("./assets/2024/squadre.xlsx")
