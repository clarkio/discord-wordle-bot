import { Client, Events, GatewayIntentBits, TextChannel, type FetchMessagesOptions } from 'discord.js';
import { TursoDatabaseProvider } from '../src/db/turso';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const messageProcessLimit = 10000;

interface UserScore {
  discordId: string;
  discordName: string;
  gameNumber: number;
  attempts: string;
  isWin?: number;
  isTie?: number;
}
const DISCORD_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
const WORDLE_PATTERN = /Wordle (\d{0,3}(,?)\d{1,3}) (🎉 ?)?([X1-6])\/6/;

const db = new TursoDatabaseProvider();

async function fetchAllMessages(channel: TextChannel) {
  let lastMessageId: string | undefined;
  let messageProcessedCount = 0;
  while (true) {
    const options: FetchMessagesOptions = { limit: 100 };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;
    messageProcessedCount += messages.size;
    console.log('Total Fetched Messages:', messageProcessedCount);

    messages.forEach(async (message: any) => {
      if (message.author.bot) {
        console.log('found bot message from user:', message.author.username);
        console.log(message.content);
        return;
      }

      const wordleResult = parseWordleResult(message);
      if (wordleResult !== undefined) {
        const existingWordle = await db.getScoreByIdAndNumber(wordleResult.discordId, wordleResult.gameNumber);
        if (!existingWordle) {
          await db.createWordle(wordleResult.gameNumber);
          await db.createPlayer(wordleResult.discordId, wordleResult.discordName);
          await db.createScore(wordleResult.discordId, wordleResult.gameNumber, wordleResult.attempts);

          // check if the wordle result is a winner or tie or not - update the score too
          const scores = await db.getScoresByNumber(wordleResult.gameNumber) as UserScore[];
          const winners = determineWinners(scores);
          if (winners.length > 1) {
            for (const winner of winners) {
              await db.updateScore(winner.discordId, winner.gameNumber, winner.attempts, 0, 1);
            }
          } else {
            await db.updateScore(winners[0].discordId, winners[0].gameNumber, winners[0].attempts, 1, 0);
          }
        } else {
          console.log(`Result already exists: ${wordleResult.gameNumber} - ${wordleResult.discordName}`);
        }
      } else {
        console.log('Message did not contain wordle result for user:', message.author.username);
      }
    });

    if (messageProcessedCount >= messageProcessLimit) return;
    lastMessageId = messages.last()?.id;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${client.user?.tag}!`);

  const channel = await readyClient.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error('Channel not found!');
    return;
  }

  try {
    await fetchAllMessages(channel);
    // Object.values(userScores).forEach((userScore: UserScore) => {
    //   userScore.totalAttempts = userScore.attempts.length;
    // });
    console.log('Done');
    // console.log('User Scores:', userScores);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    console.error('Possible Fetch Error:', {
      status: error.status,
      message: error.message,
      code: error.code,
      method: error.method,
      url: error.url
    });
  } finally {
    client.destroy(); // Close the client after fetching messages
  }
});

function parseWordleResult(message: any): UserScore | undefined {
  const userName = message.author.username;
  const userId = message.author.id;
  const match = WORDLE_PATTERN.exec(message.content);

  if (match) {
    const gameNumber = parseInt(match[1].replace(/,/g, ''));
    const attempts = match[4];

    return {
      discordId: userId,
      discordName: userName,
      gameNumber,
      attempts,
    };
  } else {
    console.log(`Message from ${userName} was not a wordle result: ${message.content}`);
  }

  return undefined;
}

function determineWinners(scores: UserScore[]): UserScore[] {
  if (!scores || scores.length === 0) return [];

  // Convert attempts to numbers for comparison (X becomes 7)
  const scoresWithNumericAttempts = scores.map(score => ({
    ...score,
    numericAttempts: score.attempts.toUpperCase() === 'X' ? 7 : parseInt(score.attempts)
  }));

  // Find minimum attempts
  const minAttempts = Math.min(
    ...scoresWithNumericAttempts.map(score => score.numericAttempts)
  );

  // Return all scores that match minimum attempts
  return scores.filter((_, index) =>
    scoresWithNumericAttempts[index].numericAttempts === minAttempts
  );
}

export async function start() {
  await client.login(process.env.BOT_TOKEN);
}

await start();
