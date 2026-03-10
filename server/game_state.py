"""Authoritative server-side game state.

GameState is the single source of truth during a match. All action handlers
mutate this object after validation via game_logic.py, then broadcast the
snapshot to both clients.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional

from game_logic import (
    Coord, compute_attack_damage, compute_displace_dir,
    validate_movement, validate_displace, is_valid_coord,
)


# ---------------------------------------------------------------------------
# Skill definitions (mirror of src/config/gameConfig.ts)
# ---------------------------------------------------------------------------

SKILL_DEFS: dict[str, dict] = {
    "Reveille of Black Cranes": {
        "range": 3,
        "target_type": "ally",
    },
    "Abrazo o Desprecio (Embrace or Exile)": {
        "range": 3,
        "target_type": "any",
    },
}


@dataclass
class CharacterState:
    player_index: int
    team: int
    name: str
    coord: Coord
    hp: int
    max_hp: int
    strength: int
    intellect: int
    defense: int
    base_defense: int
    resistance: int
    move_range: int
    attack_range: int
    skills: list[str] = field(default_factory=list)
    move_tokens: int = 1
    action_tokens: int = 1

    def to_snapshot(self) -> dict:
        return {
            "playerIndex": self.player_index,
            "team": self.team,
            "coord": {"col": self.coord.col, "row": self.coord.row},
            "hp": self.hp,
            "defense": self.defense,
            "moveTokens": self.move_tokens,
            "actionTokens": self.action_tokens,
        }


@dataclass
class GameState:
    characters: list[CharacterState]
    active_team: int = 1
    turn_count: int = 1

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def get_character(self, player_index: int) -> Optional[CharacterState]:
        return next((c for c in self.characters if c.player_index == player_index), None)

    def get_at_coord(self, coord: Coord) -> Optional[CharacterState]:
        return next((c for c in self.characters if c.coord.col == coord.col and c.coord.row == coord.row), None)

    def is_occupied(self, coord: Coord) -> bool:
        return self.get_at_coord(coord) is not None

    def teams(self) -> list[int]:
        seen: list[int] = []
        for c in self.characters:
            if c.team not in seen:
                seen.append(c.team)
        return seen

    # ------------------------------------------------------------------
    # Turn management
    # ------------------------------------------------------------------

    def check_turn_end(self) -> bool:
        """Returns True if the active team has no action tokens left."""
        active_chars = [c for c in self.characters if c.team == self.active_team]
        return all(c.action_tokens == 0 for c in active_chars)

    def next_turn(self) -> None:
        all_teams = self.teams()
        idx = all_teams.index(self.active_team)
        self.active_team = all_teams[(idx + 1) % len(all_teams)]
        if self.active_team == all_teams[0]:
            self.turn_count += 1
        for c in self.characters:
            if c.team == self.active_team:
                c.move_tokens = 1
                c.action_tokens = 1

    def check_game_over(self) -> Optional[int]:
        """Returns the winning team number if all opponents are dead, else None."""
        for team in self.teams():
            if all(c.hp <= 0 for c in self.characters if c.team != team):
                return team
        return None

    # ------------------------------------------------------------------
    # Action handlers (validate then mutate)
    # ------------------------------------------------------------------

    def apply_move(self, character_index: int, dest_col: int, dest_row: int) -> Optional[str]:
        """Returns None on success, or an error string on failure."""
        char = self.get_character(character_index)
        if not char:
            return "character not found"
        if char.team != self.active_team:
            return "not your turn"
        dest = Coord(col=dest_col, row=dest_row)
        ok = validate_movement(
            char_coord=char.coord,
            char_move_range=char.move_range,
            char_move_tokens=char.move_tokens,
            dest=dest,
            is_occupied=self.is_occupied,
        )
        if not ok:
            return "invalid move"
        # Apply
        char.coord = dest
        char.move_tokens -= 1
        return None

    def apply_attack(self, attacker_index: int, target_col: int, target_row: int) -> Optional[str]:
        attacker = self.get_character(attacker_index)
        if not attacker:
            return "attacker not found"
        if attacker.team != self.active_team:
            return "not your turn"
        if attacker.action_tokens == 0:
            return "no action tokens"
        target_coord = Coord(col=target_col, row=target_row)
        target = self.get_at_coord(target_coord)
        if not target or target.team == attacker.team:
            return "no enemy at target"
        if (abs(target_coord.col - attacker.coord.col) + abs(target_coord.row - attacker.coord.row)) > attacker.attack_range:
            return "out of range"
        # Apply
        damage = compute_attack_damage(attacker.strength, target.defense)
        target.hp = max(0, target.hp - damage)
        attacker.action_tokens -= 1
        attacker.move_tokens = 0
        return None

    def apply_skill(self, caster_index: int, skill_name: str, target_col: int, target_row: int) -> Optional[str]:
        caster = self.get_character(caster_index)
        if not caster:
            return "caster not found"
        if caster.team != self.active_team:
            return "not your turn"
        if caster.action_tokens == 0:
            return "no action tokens"
        if skill_name not in caster.skills:
            return "skill not available"
        skill = SKILL_DEFS.get(skill_name)
        if not skill:
            return "unknown skill"

        target_coord = Coord(col=target_col, row=target_row)
        dist = abs(target_coord.col - caster.coord.col) + abs(target_coord.row - caster.coord.row)
        if dist > skill["range"]:
            return "out of range"

        target = self.get_at_coord(target_coord)
        if not target:
            return "no target at coord"

        target_type = skill["target_type"]
        if target_type == "ally" and target.team != caster.team:
            return "must target ally"
        if target_type == "enemy" and target.team == caster.team:
            return "must target enemy"

        # Apply effect
        if skill_name == "Reveille of Black Cranes":
            target.defense += 10
        elif skill_name == "Abrazo o Desprecio (Embrace or Exile)":
            ok = validate_displace(
                mover_coord=caster.coord, mover_team=caster.team,
                target_coord=target.coord, target_team=target.team,
                is_occupied=self.is_occupied,
            )
            if not ok:
                return "displace blocked"
            dc, dr = compute_displace_dir(
                caster.coord, caster.team, target.coord, target.team,
            )
            dest = Coord(col=target.coord.col + dc, row=target.coord.row + dr)
            target.coord = dest

        caster.action_tokens -= 1
        caster.move_tokens = 0
        return None

    def apply_spend_action(self, character_index: int) -> Optional[str]:
        """Spend the action token for Transcend/Hold actions."""
        char = self.get_character(character_index)
        if not char:
            return "character not found"
        if char.team != self.active_team:
            return "not your turn"
        if char.action_tokens == 0:
            return "no action tokens"
        char.action_tokens -= 1
        char.move_tokens = 0
        return None

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    def to_snapshot(self) -> dict:
        return {
            "characters": [c.to_snapshot() for c in self.characters],
            "activeTeam": self.active_team,
            "turnCount": self.turn_count,
        }


# ---------------------------------------------------------------------------
# Factory — mirrors src/config/gameConfig.ts `characters` array
# ---------------------------------------------------------------------------

def build_initial_game_state() -> GameState:
    return GameState(
        active_team=1,
        turn_count=1,
        characters=[
            # Team 1
            CharacterState(
                player_index=1, team=1, name="Seonjae",
                coord=Coord(col=1, row=1), hp=100, max_hp=100,
                strength=10, intellect=8, defense=1, base_defense=1,
                resistance=1, move_range=6, attack_range=2,
                skills=["Reveille of Black Cranes"],
            ),
            CharacterState(
                player_index=3, team=1, name="Aerin",
                coord=Coord(col=1, row=3), hp=90, max_hp=90,
                strength=7, intellect=3, defense=3, base_defense=3,
                resistance=2, move_range=5, attack_range=1,
                skills=[],
            ),
            # Team 2
            CharacterState(
                player_index=2, team=2, name="Mina",
                coord=Coord(col=8, row=6), hp=100, max_hp=100,
                strength=1, intellect=1, defense=1, base_defense=1,
                resistance=1, move_range=4, attack_range=1,
                skills=["Abrazo o Desprecio (Embrace or Exile)"],
            ),
            CharacterState(
                player_index=4, team=2, name="Isma",
                coord=Coord(col=8, row=8), hp=130, max_hp=130,
                strength=4, intellect=5, defense=5, base_defense=5,
                resistance=4, move_range=3, attack_range=1,
                skills=[],
            ),
        ],
    )
