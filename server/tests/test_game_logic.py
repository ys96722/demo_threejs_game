"""Tests for pure game logic functions in game_logic.py."""

import pytest
from game_logic import (
    Coord,
    is_valid_coord,
    manhattan_dist,
    compute_attack_damage,
    compute_displace_dir,
    validate_movement,
    validate_displace,
)


# ---------------------------------------------------------------------------
# is_valid_coord
# ---------------------------------------------------------------------------

class TestIsValidCoord:
    def test_inside_grid(self):
        assert is_valid_coord(Coord(5, 5)) is True

    def test_top_left_corner(self):
        assert is_valid_coord(Coord(0, 0)) is True

    def test_top_right_corner(self):
        assert is_valid_coord(Coord(9, 0)) is True

    def test_bottom_left_corner(self):
        assert is_valid_coord(Coord(0, 9)) is True

    def test_bottom_right_corner(self):
        assert is_valid_coord(Coord(9, 9)) is True

    def test_negative_col(self):
        assert is_valid_coord(Coord(-1, 5)) is False

    def test_negative_row(self):
        assert is_valid_coord(Coord(5, -1)) is False

    def test_col_too_large(self):
        assert is_valid_coord(Coord(10, 5)) is False

    def test_row_too_large(self):
        assert is_valid_coord(Coord(5, 10)) is False

    def test_both_out_of_bounds(self):
        assert is_valid_coord(Coord(-1, -1)) is False


# ---------------------------------------------------------------------------
# manhattan_dist
# ---------------------------------------------------------------------------

class TestManhattanDist:
    def test_same_tile(self):
        assert manhattan_dist(Coord(3, 3), Coord(3, 3)) == 0

    def test_adjacent_horizontal(self):
        assert manhattan_dist(Coord(0, 0), Coord(1, 0)) == 1

    def test_adjacent_vertical(self):
        assert manhattan_dist(Coord(0, 0), Coord(0, 1)) == 1

    def test_diagonal_one_step(self):
        assert manhattan_dist(Coord(0, 0), Coord(1, 1)) == 2

    def test_far_distance(self):
        assert manhattan_dist(Coord(0, 0), Coord(9, 9)) == 18

    def test_symmetry(self):
        assert manhattan_dist(Coord(2, 3), Coord(5, 1)) == manhattan_dist(Coord(5, 1), Coord(2, 3))


# ---------------------------------------------------------------------------
# compute_attack_damage
# ---------------------------------------------------------------------------

class TestComputeAttackDamage:
    def test_strength_exceeds_defense(self):
        assert compute_attack_damage(10, 3) == 7

    def test_defense_equals_strength(self):
        assert compute_attack_damage(5, 5) == 0

    def test_defense_exceeds_strength(self):
        assert compute_attack_damage(3, 10) == 0

    def test_zero_strength(self):
        assert compute_attack_damage(0, 5) == 0

    def test_zero_defense(self):
        assert compute_attack_damage(8, 0) == 8

    def test_both_zero(self):
        assert compute_attack_damage(0, 0) == 0


# ---------------------------------------------------------------------------
# compute_displace_dir
# ---------------------------------------------------------------------------

class TestComputeDisplaceDir:
    def test_push_enemy_right(self):
        # Enemy is to the right of mover — push goes right
        dc, dr = compute_displace_dir(Coord(2, 2), 1, Coord(4, 2), 2)
        assert dc == 1 and dr == 0

    def test_push_enemy_up(self):
        dc, dr = compute_displace_dir(Coord(3, 5), 1, Coord(3, 3), 2)
        assert dc == 0 and dr == -1

    def test_push_enemy_diagonal(self):
        dc, dr = compute_displace_dir(Coord(1, 1), 1, Coord(3, 3), 2)
        assert dc == 1 and dr == 1

    def test_pull_ally_toward_mover(self):
        # Ally is to the right — pull goes left (toward mover)
        dc, dr = compute_displace_dir(Coord(2, 2), 1, Coord(5, 2), 1)
        assert dc == -1 and dr == 0

    def test_pull_ally_diagonal(self):
        dc, dr = compute_displace_dir(Coord(1, 1), 1, Coord(4, 4), 1)
        assert dc == -1 and dr == -1


# ---------------------------------------------------------------------------
# validate_movement
# ---------------------------------------------------------------------------

class TestValidateMovement:
    def _no_occupied(self, coord: Coord) -> bool:
        return False

    def test_within_range(self):
        result = validate_movement(Coord(5, 5), 3, 1, Coord(7, 5), self._no_occupied)
        assert result is True

    def test_at_exact_range(self):
        result = validate_movement(Coord(5, 5), 3, 1, Coord(8, 5), self._no_occupied)
        assert result is True

    def test_one_beyond_range(self):
        result = validate_movement(Coord(5, 5), 3, 1, Coord(9, 5), self._no_occupied)
        assert result is False

    def test_zero_move_tokens(self):
        result = validate_movement(Coord(5, 5), 3, 0, Coord(7, 5), self._no_occupied)
        assert result is False

    def test_own_tile(self):
        result = validate_movement(Coord(5, 5), 3, 1, Coord(5, 5), self._no_occupied)
        assert result is False

    def test_occupied_destination(self):
        result = validate_movement(Coord(5, 5), 3, 1, Coord(7, 5), lambda _: True)
        assert result is False

    def test_off_grid_negative(self):
        result = validate_movement(Coord(0, 0), 5, 1, Coord(-1, 0), self._no_occupied)
        assert result is False

    def test_off_grid_large(self):
        result = validate_movement(Coord(9, 9), 5, 1, Coord(10, 9), self._no_occupied)
        assert result is False

    def test_top_left_edge(self):
        result = validate_movement(Coord(1, 0), 3, 1, Coord(0, 0), self._no_occupied)
        assert result is True

    def test_bottom_right_edge(self):
        result = validate_movement(Coord(8, 9), 3, 1, Coord(9, 9), self._no_occupied)
        assert result is True


# ---------------------------------------------------------------------------
# validate_displace
# ---------------------------------------------------------------------------

class TestValidateDisplace:
    def test_valid_push(self):
        # Enemy at (5,5), mover at (3,5) — push goes right to (6,5)
        result = validate_displace(
            Coord(3, 5), 1, Coord(5, 5), 2, lambda _: False
        )
        assert result is True

    def test_push_blocked_by_edge(self):
        # Enemy at right edge col=9, push would go to col=10 (off grid)
        result = validate_displace(
            Coord(7, 5), 1, Coord(9, 5), 2, lambda _: False
        )
        assert result is False

    def test_push_destination_occupied(self):
        # Enemy at (5,5), destination (6,5) is occupied
        result = validate_displace(
            Coord(3, 5), 1, Coord(5, 5), 2,
            lambda c: c.col == 6 and c.row == 5
        )
        assert result is False

    def test_valid_pull(self):
        # Ally at (6,5), mover at (3,5) — pull goes left to (5,5)
        result = validate_displace(
            Coord(3, 5), 1, Coord(6, 5), 1, lambda _: False
        )
        assert result is True

    def test_pull_destination_occupied(self):
        # Ally at (6,5), pull dest (5,5) occupied
        result = validate_displace(
            Coord(3, 5), 1, Coord(6, 5), 1,
            lambda c: c.col == 5 and c.row == 5
        )
        assert result is False

    def test_pull_valid_from_near_edge(self):
        # Ally at left edge col=0, mover at col=3 — pull goes to col=1 (valid)
        result = validate_displace(
            Coord(3, 5), 1, Coord(0, 5), 1, lambda _: False
        )
        assert result is True
