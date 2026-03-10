"""Pure game-logic functions — no FastAPI, no WebSocket imports.

These are Python ports of the TypeScript functions in src/logic/.
The contract is identical: plain objects in, plain values out.
"""

from __future__ import annotations
from dataclasses import dataclass

GRID_COLS = 10
GRID_ROWS = 10


@dataclass
class Coord:
    col: int
    row: int


def is_valid_coord(coord: Coord) -> bool:
    return 0 <= coord.col < GRID_COLS and 0 <= coord.row < GRID_ROWS


def manhattan_dist(a: Coord, b: Coord) -> int:
    return abs(a.col - b.col) + abs(a.row - b.row)


def compute_attack_damage(attacker_strength: int, target_defense: int) -> int:
    return max(0, attacker_strength - target_defense)


def compute_displace_dir(
    mover_coord: Coord, mover_team: int,
    target_coord: Coord, target_team: int,
) -> tuple[int, int]:
    is_enemy = target_team != mover_team
    if is_enemy:
        dc = _sign(target_coord.col - mover_coord.col)
        dr = _sign(target_coord.row - mover_coord.row)
    else:
        dc = _sign(mover_coord.col - target_coord.col)
        dr = _sign(mover_coord.row - target_coord.row)
    return dc, dr


def validate_movement(
    char_coord: Coord,
    char_move_range: int,
    char_move_tokens: int,
    dest: Coord,
    is_occupied: "Callable[[Coord], bool]",
) -> bool:
    if char_move_tokens == 0:
        return False
    if not is_valid_coord(dest):
        return False
    if dest.col == char_coord.col and dest.row == char_coord.row:
        return False
    if is_occupied(dest):
        return False
    return manhattan_dist(char_coord, dest) <= char_move_range


def validate_displace(
    mover_coord: Coord, mover_team: int,
    target_coord: Coord, target_team: int,
    is_occupied: "Callable[[Coord], bool]",
) -> bool:
    dc, dr = compute_displace_dir(mover_coord, mover_team, target_coord, target_team)
    dest = Coord(col=target_coord.col + dc, row=target_coord.row + dr)
    return is_valid_coord(dest) and not is_occupied(dest)


def _sign(x: int) -> int:
    return 1 if x > 0 else (-1 if x < 0 else 0)
