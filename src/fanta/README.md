# Fanta

These folder is used to automatically get data about the tournament

## Hackerman: inspect endpoints

Since we don't have a clue about what the API will returns, and no openapi/swagger are up, we need to force inspect it.

```bash
sudo apt update
sudo apt install -y fuff
curl https://github.com/danielmiessler/SecLists/blob/master/Discovery/Web-Content/big.txt > big.txt
ffuf -u https://api.gsplizzana.it/api/FUZZ      -w big.txt      -H "Accept: application/json"      -fc 403,404      -fs 1069,1234,1500      -mc 200      --ac

```

After running this, we got

|||
|-|-|
|groups |   [Status: 200, Size: 12658, Words: 81, Lines: 1, Duration: 148ms]|
|live   |   [Status: 200, Size: 4925, Words: 15, Lines: 1, Duration: 201ms] |
|stats  |   [Status: 200, Size: 64, Words: 1, Lines: 1, Duration: 55ms]     |
|teams  |   [Status: 200, Size: 2440, Words: 12, Lines: 1, Duration: 73ms]  |

Let's inspect them:

```bash
ffuf -u https://api.gsplizzana.it/api/<API_ENPOINT>/FUZZ -w big.txt -H "Accept: application/json" -fc 403,404 -fs 1069,1234,1500 -mc 200 --ac
```
After reviewing the outputs, we see that to get the player we can use
> https://api.gsplizzana.it/api/teams/<TEAM_ID>/players

with TEAM_ID from

> https://api.gsplizzana.it/api/teams/

We can also see that

> https://api.gsplizzana.it/api/groups/1

returns the stage id (ROUND, PLAYOFF, SEMIFINALS, etc).
It also returns the rankings,
W
> https://api.gsplizzana.it/api/groups/1/rankings

and all the results for each game

> https://api.gsplizzana.it/api/groups/1/fixtures

With this in mind, we might want to update the code in order to reflect all of this.
