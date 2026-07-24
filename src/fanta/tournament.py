import json
from datetime import datetime
from pathlib import Path

import requests

YEAR = datetime.now().year
URL = "https://api.gsplizzana.it/api"


def download_from_api(url: str) -> dict:
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 404:
            raise requests.HTTPError(f"Resource {url} not found.")
        content = resp.json()
    except requests.HTTPError as e:
        print(f"Cannot download from {url}. Reason: {e}")
        content = {}
    except requests.ConnectTimeout:
        print("Connection timeout")
        raise
    return content


def save_to_file(content: dict, path: str) -> None:
    with open(path, "w+") as file:
        json.dump(content, file, indent=3)


def scrape_stats() -> None:
    Path(f"assets/{YEAR}/api/").mkdir(parents=True, exist_ok=True)
    url = URL + "/stats"
    content = download_from_api(url)
    save_to_file(content, path=f"assets/{YEAR}/api/stats.json")
    print("Downloaded stats")


def scrape_matches() -> None:
    for group_id in range(1, 20):
        groups = Path(f"assets/{YEAR}/api/groups/{group_id}/fixture")
        groups.mkdir(parents=True, exist_ok=True)

    for i in range(1, 19):
        url = URL + "/groups/" + str(i)
        content = download_from_api(url)
        save_to_file(content, path=f"assets/{YEAR}/api/groups/{i}.json")
        print(f"Downloaded group {i} listing")

        content = download_from_api(url + "/rankings")
        save_to_file(content, path=f"assets/{YEAR}/api/groups/{i}/rankings.json")
        print(f"Downloaded group {i} rankings")

        url = url + "/fixtures?page=1"
        while url:
            content = download_from_api(url)
            current_page = content["meta"]["current_page"]
            save_to_file(
                content,
                path=f"assets/{YEAR}/api/groups/{i}/fixture/{current_page}.json",
            )
            print(f"Downloaded group {i} page {current_page} ")
            url = content.get("links").get("next")
        print("Downloaded all pages")


def scrape_teams() -> None:
    groups = Path(f"assets/{YEAR}/api/teams")
    groups.mkdir(parents=True, exist_ok=True)

    url = URL + "/teams?page=1"
    while url:
        content = download_from_api(url)
        current_page = content["meta"]["current_page"]
        save_to_file(
            content,
            path=f"assets/{YEAR}/api/teams/{current_page}.json",
        )
        print(f"Downloaded team page {current_page} ")
        url = content.get("links").get("next")

    for team_id in range(1, int(content["meta"]["total"]) + 1):
        url = URL + "/teams/"
        content = download_from_api(url + f"{team_id}/players")
        save_to_file(
            content,
            path=f"assets/{YEAR}/api/teams/{team_id}.json",
        )
        print(f"Downloaded team {team_id} players")


if __name__ == "__main__":
    # try:
    #    scrape_stats()
    # except Exception as e:
    #    print(f"Skipping the rest... {e}")
    # print("-" * 100)
    try:
        scrape_matches()
    except Exception as e:
        print(f"Skipping the rest... {e}")
    print("-" * 100)
    # try:
    #    scrape_teams()
    # except Exception as e:
    #    print(f"Skipping the rest... {e}")
