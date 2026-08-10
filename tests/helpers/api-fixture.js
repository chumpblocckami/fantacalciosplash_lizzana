/**
 * Build a Calciosplash API snapshot on disk, in the shape scripts/compute-scores.js reads.
 *
 * The committed 2026 snapshot is a tournament that has not been played, so every fixture is
 * still scheduled and the scorer has nothing to work with. These helpers make it possible to
 * hand-build a small finished tournament instead, which is the only way to exercise the
 * knockout and elimination paths before tournament day.
 */

import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * A player entry as the fixture detail endpoint returns it.
 *
 * @param {number} id
 * @param {string} name
 * @param {string} surname
 * @param {Object} [stats] - goals, yellow_cards, red_cards, is_goalkeeper
 */
export function player(id, name, surname, stats = {}) {
  return {
    id,
    name,
    surname,
    username: `${name}${id}`,
    is_goalkeeper: false,
    goals: 0,
    yellow_cards: 0,
    red_cards: 0,
    ...stats,
  };
}

/**
 * A team entry inside a fixture detail.
 *
 * @param {string} name
 * @param {number} score
 * @param {Object[]} players
 * @param {Object[]} [substitutes]
 */
export function team(name, score, players, substitutes = []) {
  return { id: name.length, name, tag: name.slice(0, 3), score, players, substitutes };
}

/**
 * Write a complete snapshot under assets/YEAR/api.
 *
 * @param {string} root   - Directory to treat as the repository root
 * @param {string} year   - Edition year
 * @param {Object} config
 * @param {Object[]} config.groups   - {id, name, gender, kind}
 * @param {Object[]} config.fixtures - {id, group_name, gender, closed, home, away, best_player}
 */
export function writeSnapshot(root, year, { groups, fixtures }) {
  const apiDir = join(root, 'assets', year, 'api');
  rmSync(join(root, 'assets', year), { recursive: true, force: true });
  mkdirSync(join(apiDir, 'fixtures'), { recursive: true });

  writeFileSync(join(apiDir, 'groups.json'), JSON.stringify({ data: groups }, null, 2));

  const listing = fixtures.map(fixture => ({
    id: fixture.id,
    status: fixture.closed ? 'finished' : 'scheduled',
    closed: fixture.closed ?? false,
    live: false,
    group_name: fixture.group_name,
    gender: fixture.gender,
    home_team: { name: fixture.home.name },
    away_team: { name: fixture.away.name },
    home_score: fixture.home.score,
    away_score: fixture.away.score,
  }));
  writeFileSync(join(apiDir, 'fixtures.json'), JSON.stringify({ data: listing }, null, 2));

  for (const fixture of fixtures) {
    const detail = {
      data: {
        id: fixture.id,
        closed: fixture.closed ?? false,
        home_team: fixture.home,
        away_team: fixture.away,
        best_player: fixture.best_player ?? null,
      },
    };
    writeFileSync(join(apiDir, 'fixtures', `${fixture.id}.json`), JSON.stringify(detail, null, 2));
  }
}
