import pandas as pd
from git import GitCommandError, Repo


def test_git():
    # Replace with your GitHub username and personal access token
    github_username = "your_github_username"
    personal_access_token = "your_personal_access_token"
    repository_path = "/path/to/your/repository"

    # Set up the remote URL with the personal access token
    remote_url = f"https://{github_username}:{personal_access_token}@github.com/chumpblocckami/fantacalciosplash_lizzana.git"

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
