import datetime
from dataclasses import dataclass
from typing import Optional

from dataclasses_json import dataclass_json


@dataclass
class Timer:
    current: int
    offset: int
    started_at: Optional[datetime]
    stopped_at: Optional[datetime]


@dataclass
class Shootouts:
    history: list
    live_history: list[str]
    misses: int
    score: int
    total: int


@dataclass
class Statistics:
    fouls: int
    red_cards: int
    substitutions: int
    yellow_cards: int


@dataclass
class Player:
    id: int
    fouls: int
    goals: int
    yellow_cards: int
    red_cards: int
    name: str
    surname: str

    production_path: str  # unused
    avatar_url: Optional[str] = None  # unused
    username: Optional[str] = None  # unused


@dataclass
class Team:
    id: int
    best_player: Optional[Player]
    name: str
    players: list[Player]
    score: int
    tag: str
    winner: bool
    substitutes: list[Player]  # unused
    stats: Statistics  # unused
    shootouts: Shootouts  # unused
    players_count: int  # unused
    production_path: str  # unused
    logo_url: Optional[str] = None  # unused


@dataclass
class Match:
    away_team: Team
    home_team: Team

    scheduled_at: datetime  # unused
    timer: Timer  # unused
    live: bool  # unused


@dataclass
class Link:
    first: str
    last: str
    next: Optional[str] = None
    prev: Optional[str] = None


@dataclass
class MetadataLink:
    label: str
    active: bool
    url: Optional[str] = None


@dataclass
class Metadata:
    current_page: int
    # from: int
    last_page: int
    links: list[MetadataLink]
    path: str
    per_page: int
    to: Optional[int]
    total: int


@dataclass_json
@dataclass
class Results:
    data: list[Match]
    links: Link
    meta: Metadata
