import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';
import { parseIgnoredUserIds, processLatestWordleResult } from '../wordle-processor';
import type { IDatabaseProvider } from '../db/entities/IDatabaseProvider';
import type { IScore } from '../db/entities/IScore';
import type { UserScore } from '../wordle-processor';

// ── helpers ────────────────────────────────────────────────────────────────

function makeScore(discordId: string, gameNumber: number, attempts = '3'): IScore {
  return { discordId, gameNumber, attempts, isWin: 0, isTie: 0, player: null };
}

function makeDb(overrides: Partial<IDatabaseProvider> = {}): IDatabaseProvider {
  return {
    getScoresByNumber: mock(async () => []),
    getScoresById: mock(async () => []),
    getScoreByIdAndNumber: mock(async () => undefined),
    createWordle: mock(async () => true),
    createPlayer: mock(async () => true),
    createScore: mock(async () => undefined),
    updateScore: mock(async () => true),
    ...overrides,
  };
}

const IGNORED_ID = '111111111111111111';
const NORMAL_ID  = '222222222222222222';

const ignoredUser: UserScore = {
  discordId: IGNORED_ID,
  userName: 'IgnoredUser',
  gameNumber: 1234,
  attempts: '4',
};

const normalUser: UserScore = {
  discordId: NORMAL_ID,
  userName: 'NormalUser',
  gameNumber: 1234,
  attempts: '3',
};

// ── parseIgnoredUserIds ─────────────────────────────────────────────────────

describe('parseIgnoredUserIds', () => {
  it('returns an empty set for an empty string', () => {
    expect(parseIgnoredUserIds('').size).toBe(0);
  });

  it('parses a single ID', () => {
    const result = parseIgnoredUserIds(IGNORED_ID);
    expect(result.has(IGNORED_ID)).toBe(true);
    expect(result.size).toBe(1);
  });

  it('parses multiple comma-separated IDs', () => {
    const result = parseIgnoredUserIds(`${IGNORED_ID},${NORMAL_ID}`);
    expect(result.has(IGNORED_ID)).toBe(true);
    expect(result.has(NORMAL_ID)).toBe(true);
    expect(result.size).toBe(2);
  });

  it('trims whitespace around each ID', () => {
    const result = parseIgnoredUserIds(` ${IGNORED_ID} , ${NORMAL_ID} `);
    expect(result.has(IGNORED_ID)).toBe(true);
    expect(result.has(NORMAL_ID)).toBe(true);
  });

  it('filters out empty entries from trailing/double commas', () => {
    const result = parseIgnoredUserIds(`${IGNORED_ID},,`);
    expect(result.size).toBe(1);
  });
});

// ── processLatestWordleResult — ignored user ────────────────────────────────

describe('processLatestWordleResult — ignored user', () => {
  const ignoredIds = new Set([IGNORED_ID]);
  const ignoredScore = makeScore(IGNORED_ID, 1234, '4');
  const otherScore = makeScore(NORMAL_ID, 1234);

  let db: IDatabaseProvider;

  beforeEach(() => {
    db = makeDb({
      getScoresByNumber: mock(async () => [otherScore]),
      createScore: mock(async () => ignoredScore),
    });
  });

  it('still calls createScore to persist the ignored user\'s result', async () => {
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(db.createScore).toHaveBeenCalledWith(
      IGNORED_ID, ignoredUser.gameNumber, ignoredUser.attempts, 0, 0
    );
  });

  it('still calls createPlayer for the ignored user', async () => {
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(db.createPlayer).toHaveBeenCalledWith(IGNORED_ID, ignoredUser.userName);
  });

  it('excludes the ignored user from the returned scores', async () => {
    const result = await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(result.some((s) => s.discordId === IGNORED_ID)).toBe(false);
  });

  it('returns non-ignored scores so downstream winner logic is unaffected', async () => {
    const result = await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(result).toContain(otherScore);
  });

  it('logs the ignore event including the user ID', async () => {
    const logSpy = spyOn(console, 'log');
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    const logged = logSpy.mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes(IGNORED_ID)
    );
    expect(logged).toBe(true);
    logSpy.mockRestore();
  });

  it('does not call createWordle when scores already exist for that game', async () => {
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(db.createWordle).not.toHaveBeenCalled();
  });

  it('calls createWordle when the ignored user is the first to submit for that game', async () => {
    db = makeDb({ createScore: mock(async () => ignoredScore) });
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(db.createWordle).toHaveBeenCalledWith(ignoredUser.gameNumber);
  });

  it('does not re-save if the ignored user already has a result for that game', async () => {
    db = makeDb({ getScoresByNumber: mock(async () => [ignoredScore, otherScore]) });
    await processLatestWordleResult(ignoredUser, db, ignoredIds);
    expect(db.createScore).not.toHaveBeenCalled();
  });
});

// ── processLatestWordleResult — normal user (not ignored) ───────────────────

describe('processLatestWordleResult — normal user', () => {
  const ignoredIds = new Set([IGNORED_ID]);
  const newScore = makeScore(NORMAL_ID, 1234, '3');

  let db: IDatabaseProvider;

  beforeEach(() => {
    db = makeDb({
      getScoresByNumber: mock(async () => []),
      createScore: mock(async () => newScore),
    });
  });

  it('calls createPlayer for a new normal user', async () => {
    await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(db.createPlayer).toHaveBeenCalledWith(NORMAL_ID, normalUser.userName);
  });

  it('calls createWordle when no scores exist yet', async () => {
    await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(db.createWordle).toHaveBeenCalledWith(normalUser.gameNumber);
  });

  it('calls createScore with the correct arguments', async () => {
    await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(db.createScore).toHaveBeenCalledWith(NORMAL_ID, normalUser.gameNumber, normalUser.attempts, 0, 0);
  });

  it('returns scores including the newly added score', async () => {
    const result = await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(result).toContain(newScore);
  });

  it('does not call createScore when a result already exists for that user', async () => {
    const existingScore = makeScore(NORMAL_ID, 1234);
    db = makeDb({ getScoresByNumber: mock(async () => [existingScore]) });
    await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(db.createScore).not.toHaveBeenCalled();
  });

  it('does not call createWordle when scores already exist for that game', async () => {
    const otherScore = makeScore('333333333333333333', 1234);
    db = makeDb({
      getScoresByNumber: mock(async () => [otherScore]),
      createScore: mock(async () => newScore),
    });
    await processLatestWordleResult(normalUser, db, ignoredIds);
    expect(db.createWordle).not.toHaveBeenCalled();
  });
});

// ── processLatestWordleResult — mixed game with ignored and normal users ────

describe('processLatestWordleResult — mixed game', () => {
  const ignoredIds = new Set([IGNORED_ID]);

  it('excludes only the ignored user from returned scores when both have submitted', async () => {
    const ignoredScore = makeScore(IGNORED_ID, 1234, '4');
    const normalScore  = makeScore(NORMAL_ID,  1234, '3');
    const db = makeDb({ getScoresByNumber: mock(async () => [ignoredScore, normalScore]) });

    const result = await processLatestWordleResult(normalUser, db, ignoredIds);

    expect(result.some((s) => s.discordId === IGNORED_ID)).toBe(false);
    expect(result.some((s) => s.discordId === NORMAL_ID)).toBe(true);
  });
});

// ── processLatestWordleResult — empty ignore list ───────────────────────────

describe('processLatestWordleResult — empty ignore list', () => {
  const emptyIgnoredIds = new Set<string>();
  const newScore = makeScore(IGNORED_ID, 1234, '4');

  it('processes all users normally when IGNORED_USER_IDS is not set', async () => {
    const db = makeDb({ createScore: mock(async () => newScore) });
    const result = await processLatestWordleResult(ignoredUser, db, emptyIgnoredIds);
    expect(db.createScore).toHaveBeenCalled();
    expect(result).toContain(newScore);
  });
});
