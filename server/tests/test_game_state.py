"""Tests for GameState action handlers in game_state.py."""

import pytest
from game_state import GameState, CharacterState, build_initial_game_state
from game_logic import Coord


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_state() -> GameState:
    """Fresh two-character game state: char 1 (team 1) vs char 2 (team 2)."""
    return GameState(
        active_team=1,
        turn_count=1,
        characters=[
            CharacterState(
                player_index=1, team=1, name="A",
                coord=Coord(col=0, row=0), hp=100, max_hp=100,
                strength=10, intellect=0, defense=2, base_defense=2,
                resistance=0, move_range=5, attack_range=3,
                skills=["Reveille of Black Cranes"],
                move_tokens=1, action_tokens=1,
            ),
            CharacterState(
                player_index=2, team=2, name="B",
                coord=Coord(col=3, row=0), hp=50, max_hp=50,
                strength=5, intellect=0, defense=3, base_defense=3,
                resistance=0, move_range=3, attack_range=2,
                skills=[],
                move_tokens=1, action_tokens=1,
            ),
        ],
    )


# ---------------------------------------------------------------------------
# apply_move
# ---------------------------------------------------------------------------

class TestApplyMove:
    def test_valid_move(self):
        gs = make_state()
        error = gs.apply_move(1, 1, 0)
        assert error is None
        assert gs.get_character(1).coord == Coord(1, 0)
        assert gs.get_character(1).move_tokens == 0

    def test_wrong_team(self):
        gs = make_state()
        error = gs.apply_move(2, 2, 0)  # team 2, but active is team 1
        assert error is not None

    def test_zero_move_tokens(self):
        gs = make_state()
        gs.get_character(1).move_tokens = 0
        error = gs.apply_move(1, 1, 0)
        assert error is not None

    def test_out_of_range(self):
        gs = make_state()
        error = gs.apply_move(1, 9, 9)  # dist > move_range=5 from (0,0) would be 18
        assert error is not None

    def test_occupied_destination(self):
        gs = make_state()
        # Move char 1 to char 2's position (3,0)
        error = gs.apply_move(1, 3, 0)
        assert error is not None

    def test_character_not_found(self):
        gs = make_state()
        error = gs.apply_move(99, 1, 0)
        assert error is not None


# ---------------------------------------------------------------------------
# apply_attack
# ---------------------------------------------------------------------------

class TestApplyAttack:
    def test_valid_attack(self):
        gs = make_state()
        initial_hp = gs.get_character(2).hp
        error = gs.apply_attack(1, 3, 0)
        assert error is None
        # damage = strength(10) - defense(3) = 7
        assert gs.get_character(2).hp == initial_hp - 7
        assert gs.get_character(1).action_tokens == 0
        assert gs.get_character(1).move_tokens == 0

    def test_wrong_team(self):
        gs = make_state()
        error = gs.apply_attack(2, 0, 0)  # team 2 not active
        assert error is not None

    def test_no_action_tokens(self):
        gs = make_state()
        gs.get_character(1).action_tokens = 0
        error = gs.apply_attack(1, 3, 0)
        assert error is not None

    def test_out_of_range(self):
        gs = make_state()
        # Move enemy far away first by directly setting coord
        gs.get_character(2).coord = Coord(col=9, row=9)
        error = gs.apply_attack(1, 9, 9)
        assert error is not None

    def test_no_enemy_at_target(self):
        gs = make_state()
        error = gs.apply_attack(1, 1, 0)  # empty tile
        assert error is not None

    def test_attacker_not_found(self):
        gs = make_state()
        error = gs.apply_attack(99, 3, 0)
        assert error is not None


# ---------------------------------------------------------------------------
# apply_skill
# ---------------------------------------------------------------------------

class TestApplySkill:
    def test_valid_skill_buff(self):
        gs = make_state()
        # Char 1 has "Reveille of Black Cranes" (buff ally). Target char 1 itself.
        # But targetType is "ally" — char 1 targets itself (same team)
        initial_defense = gs.get_character(1).defense
        error = gs.apply_skill(1, "Reveille of Black Cranes", 0, 0)
        assert error is None
        assert gs.get_character(1).defense == initial_defense + 10
        assert gs.get_character(1).action_tokens == 0

    def test_wrong_team(self):
        gs = make_state()
        error = gs.apply_skill(2, "Reveille of Black Cranes", 0, 0)
        assert error is not None

    def test_no_action_tokens(self):
        gs = make_state()
        gs.get_character(1).action_tokens = 0
        error = gs.apply_skill(1, "Reveille of Black Cranes", 0, 0)
        assert error is not None

    def test_out_of_range(self):
        gs = make_state()
        # Reveille range=3; target at (9,9) is out of range from (0,0)
        gs.characters.append(CharacterState(
            player_index=5, team=1, name="C",
            coord=Coord(col=9, row=9), hp=100, max_hp=100,
            strength=5, intellect=0, defense=1, base_defense=1,
            resistance=0, move_range=3, attack_range=1,
            skills=[], move_tokens=1, action_tokens=1,
        ))
        error = gs.apply_skill(1, "Reveille of Black Cranes", 9, 9)
        assert error is not None

    def test_wrong_target_type(self):
        gs = make_state()
        # "Reveille of Black Cranes" targets ally; targeting enemy (char 2) should fail
        error = gs.apply_skill(1, "Reveille of Black Cranes", 3, 0)
        assert error is not None

    def test_unknown_skill(self):
        gs = make_state()
        error = gs.apply_skill(1, "Unknown Skill", 0, 0)
        assert error is not None


# ---------------------------------------------------------------------------
# apply_spend_action
# ---------------------------------------------------------------------------

class TestApplySpendAction:
    def test_valid(self):
        gs = make_state()
        error = gs.apply_spend_action(1)
        assert error is None
        assert gs.get_character(1).action_tokens == 0
        assert gs.get_character(1).move_tokens == 0

    def test_wrong_team(self):
        gs = make_state()
        error = gs.apply_spend_action(2)  # team 2, active is team 1
        assert error is not None

    def test_no_action_tokens(self):
        gs = make_state()
        gs.get_character(1).action_tokens = 0
        error = gs.apply_spend_action(1)
        assert error is not None

    def test_character_not_found(self):
        gs = make_state()
        error = gs.apply_spend_action(99)
        assert error is not None


# ---------------------------------------------------------------------------
# check_turn_end
# ---------------------------------------------------------------------------

class TestCheckTurnEnd:
    def test_tokens_remaining(self):
        gs = make_state()
        assert gs.check_turn_end() is False

    def test_all_spent(self):
        gs = make_state()
        gs.get_character(1).action_tokens = 0
        assert gs.check_turn_end() is True

    def test_partial_spent(self):
        """Multiple team-1 chars: only turn ends when ALL have 0 action tokens."""
        gs = make_state()
        gs.characters.append(CharacterState(
            player_index=5, team=1, name="C",
            coord=Coord(col=0, row=1), hp=100, max_hp=100,
            strength=5, intellect=0, defense=1, base_defense=1,
            resistance=0, move_range=3, attack_range=1,
            skills=[], move_tokens=1, action_tokens=1,
        ))
        gs.get_character(1).action_tokens = 0
        # Char 5 still has tokens → turn not over
        assert gs.check_turn_end() is False
        gs.get_character(5).action_tokens = 0
        assert gs.check_turn_end() is True


# ---------------------------------------------------------------------------
# next_turn
# ---------------------------------------------------------------------------

class TestNextTurn:
    def test_team_rotates(self):
        gs = make_state()
        gs.next_turn()
        assert gs.active_team == 2

    def test_rotates_back(self):
        gs = make_state()
        gs.next_turn()
        gs.next_turn()
        assert gs.active_team == 1

    def test_turn_count_increments_on_full_cycle(self):
        gs = make_state()
        initial = gs.turn_count
        gs.next_turn()  # team 1 → team 2
        assert gs.turn_count == initial  # no increment yet
        gs.next_turn()  # team 2 → team 1 (full cycle)
        assert gs.turn_count == initial + 1

    def test_tokens_reset_for_new_active_team(self):
        gs = make_state()
        gs.get_character(2).action_tokens = 0
        gs.get_character(2).move_tokens = 0
        gs.next_turn()
        assert gs.get_character(2).action_tokens == 1
        assert gs.get_character(2).move_tokens == 1


# ---------------------------------------------------------------------------
# check_game_over
# ---------------------------------------------------------------------------

class TestCheckGameOver:
    def test_enemies_alive_returns_none(self):
        gs = make_state()
        assert gs.check_game_over() is None

    def test_all_enemies_dead_returns_winner(self):
        gs = make_state()
        gs.get_character(2).hp = 0
        winner = gs.check_game_over()
        assert winner == 1

    def test_team1_dead_returns_team2(self):
        gs = make_state()
        gs.get_character(1).hp = 0
        winner = gs.check_game_over()
        assert winner == 2

    def test_no_winner_while_both_alive(self):
        gs = make_state()
        gs.get_character(1).hp = 1
        gs.get_character(2).hp = 1
        assert gs.check_game_over() is None

    def test_build_initial_game_state_no_winner(self):
        gs = build_initial_game_state()
        assert gs.check_game_over() is None
