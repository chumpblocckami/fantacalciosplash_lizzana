from collections import OrderedDict
from dataclasses import dataclass, fields

from constants import POINTS_PER_GOAL, POINTS_PER_RED_CARD, POINTS_PER_YELLOW_CARD


def create_dataclass(cls, raw_dict):
    filtered = {k: v for k, v in raw_dict.items() if k in {f.name for f in fields(cls)}}
    return cls(**filtered)


@dataclass(eq=True, frozen=True)
class Player:
    id: int
    name: str
    surname: str
    username: str
    goals: int
    fouls: int
    yellow_cards: int
    red_cards: int

    def __post_init__(self):
        object.__setattr__(self, "name", self.name.capitalize().strip())
        object.__setattr__(self, "surname", self.surname.capitalize().strip())


@dataclass
class Team:
    id: int
    name: str
    tag: str
    winner: bool
    score: int
    substitutes: list[Player]
    players: list[Player]

    def __post_init__(self):
        self.players = [create_dataclass(Player, player) for player in self.players]
        self.substitutes = [create_dataclass(Player, player) for player in self.substitutes]
        combined = self.players + self.substitutes
        self.players = list(OrderedDict((p.id, p) for p in combined).values())


@dataclass
class MatchPoints:
    goals: int
    yellow_cards: int
    red_cards: int
    team_points: int
    goalkeeper_points: int
    total_points: int = 0

    def __post_init__(self):
        self.goals = self.goals * POINTS_PER_GOAL
        self.yellow_cards = self.yellow_cards * POINTS_PER_YELLOW_CARD
        self.red_cards = self.red_cards * POINTS_PER_RED_CARD
        self.total_points = (
            self.goals
            + self.yellow_cards
            + self.red_cards
            + self.team_points
            + self.goalkeeper_points
        )
