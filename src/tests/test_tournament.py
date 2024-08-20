import unittest
from unittest import TestCase

from tournament.domain import Player
from tournament.tournament import Tournament


class TournamentTests(TestCase):
    def __init__(self, methodName: str = "runTest") -> None:
        self.tournament = Tournament(edition=2024)
        return

    def test_calculate_player_points():
        fake_player = Player(
            **{
                "name": "Luca",
                "surname": "Luca",
                "goals": 1,
                "yellow_cards": 1,
                "red_cards": 0,
            }
        )
        self.tournament.calculate_player_points(fake_player)


if __name__ == "__main__":
    unittest.main()
