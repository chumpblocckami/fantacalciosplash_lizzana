import os

from git import Repo


class Saver:
    def __init__(self, repo_path: str) -> None:
        self.repo = Repo(repo_path)
        self.branch = "main"

    def commit_and_push(self, file_path: str, commit_message: "Updated file"):

        if self.repo.is_dirty():
            print("This repo has uncommited changes")

        self.repo.index.add([file_path])
        self.repo.index.commit(commit_message)
        origin = self.repo.remote(name="origin")
        origin.push(refspec=f"{self.branch}:{self.branch}")

        print(
            f"File {file_path} has been committed and pushed to {self.branch} branch."
        )


if __name__ == "__main__":
    dir_path = os.path.dirname(os.path.realpath(__file__))
    file_path = dir_path + "/test.py"
    saver = Saver(dir_path)
    saver.commit_and_push(file_path=file_path, commit_message="Updated")
