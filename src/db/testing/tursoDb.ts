import { TursoDatabaseProvider } from '../turso';

const db = new TursoDatabaseProvider();
const scores = await db.getScoresByNumber(1254);
console.dir(scores, { depth: null });

// const wordle = await db.createWordle(1254);
// const score = await db.createScore('294639347192561664', 1254, '1', 0, 0);
// console.dir(score, { depth: null });

// const gameNumber = 2;
// const discordId = "5";
// await createWordle(gameNumber);
// await createPlayer(discordId, 'Sally');
// await createScore(discordId, gameNumber, '1', 0, 0);
// await db.insert(wordlesTable).values({ gameNumber }).onConflictDoNothing();
// await db.insert(playersTable).values({ discordId, discordName: 'Joker' }).onConflictDoNothing();
// await db.insert(scoresTable).values({ discordId, gameNumber, attempts: '3', isWin: 0, isTie: 0 }).onConflictDoNothing();
// const results = await db.query.scoresTable.findMany({});

// const winners = determineWinners(scores);
// if (winners.length > 1) {
//   for (const winner of winners) {
//     await updateScore(winner.discordId, winner.gameNumber, winner.attempts, 0, 1);
//   }
// } else {
//   await updateScore(winners[0].discordId, winners[0].gameNumber, winners[0].attempts, 1, 0);
// }

// function getClient(isProd: boolean) {
//   if (isProd) {
//     return createClient({
//       url: process.env.TURSO_DATABASE_URL!,
//       authToken: process.env.TURSO_AUTH_TOKEN,
//     });
//   } else {
//     return createClient({
//       url: 'file:./localDb/local.db',
//       authToken: 'local',
//     });
//   }
// }

// function determineWinners(scores: UserScore[]): UserScore[] {
//   if (!scores || scores.length === 0) return [];

//   // Convert attempts to numbers for comparison (X becomes 7)
//   const scoresWithNumericAttempts = scores.map(score => ({
//     ...score,
//     numericAttempts: score.attempts.toUpperCase() === 'X' ? 7 : parseInt(score.attempts)
//   }));

//   // Find minimum attempts
//   const minAttempts = Math.min(
//     ...scoresWithNumericAttempts.map(score => score.numericAttempts)
//   );

//   // Return all scores that match minimum attempts
//   return scores.filter((_, index) =>
//     scoresWithNumericAttempts[index].numericAttempts === minAttempts
//   );
// }
