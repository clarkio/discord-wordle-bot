import { GatewayIntentBits, TextChannel } from 'discord.js';
import type { Models } from 'node-appwrite';
import fs from 'fs';
import path from 'path';
import { CustomClient } from './CustomClient';
import { TursoDatabaseProvider } from './db/turso';
import type { IScore } from './db/entities/IScore';

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
const isUserTaggingEnabled = process.env.USER_TAGGING_ENABLED === 'true';
const wordlePattern = /Wordle (\d{0,3}(,?)\d{1,3}) (🎉 ?)?([X1-6])\/6/;
const client = new CustomClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
interface UserScore {
  discordId: string;
  userName: string;
  gameNumber: number;
  attempts: string;
}

const PREFIX = '!';
const commandsPath = path.join(__dirname, 'commands');

// Recursive function to find all .ts files in a directory and its subdirectories
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.ts')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

const commandFiles = getAllFiles(commandsPath);

// Load command files
for (const filePath of commandFiles) {
  const command = await import(filePath);
  client.commands.set(command.default.name, command.default);
}

// Instantiate the database client
const db = new TursoDatabaseProvider();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  const channel = await client.channels.fetch(TARGET_CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error('Channel not found!');
    // await client.destroy();
    return;
  }
});

client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // determine if the message is a wordle result, a command or can be ignored
  const parsedWordle = parseWordleResult(message);
  if (parsedWordle) {
    const currentResults = await processLatestWordleResult(parsedWordle);
    await processCurrentResults(currentResults, parsedWordle, message);
  } else if (message.content.startsWith(PREFIX)) {
    await processCommand(message, message.channel as TextChannel);
  } else {
    console.log('Message was determined to not be intended for the bot');
  }
});

async function determineWinners(scores: IScore[]): Promise<IScore[]> {
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

async function processCurrentResults(currentResults: IScore[], parsedWordle: UserScore, message: any) {
  try {
    if (currentResults.length > 0) {
      const winners: IScore[] = await determineWinners(currentResults);
      if (winners.length > 0) {
        await recordWinners(winners);
        await informLatestResults(winners, parsedWordle, message);
      }
    } else {
      console.log('No results from processing the latest Wordle result.');
    }
  } catch (error) {
    console.error('Error processing Wordle Result:', error);
  }
}

async function recordWinners(winners: IScore[]) {
  if (winners.length > 1) {
    // Update all winners as ties
    // TODO: Is there a more efficient way to update them in batch? Maybe transaction?
    for (const winner of winners) {
      await db.updateScore(winner.discordId, winner.gameNumber, winner.attempts, 0, 1);
    }
  } else {
    // Update the winner as an outright win
    await db.updateScore(winners[0].discordId, winners[0].gameNumber, winners[0].attempts, 1, 0);
  }

  // find all none winners based on the discordId and update them as losses
  // TODO: Is there a more efficient way to update them in batch? Maybe transaction?
  // What if it was more than just a handful of records to update? 50? 100? 1000?
  const allScoresForGame = await db.getScoresByNumber(winners[0].gameNumber);
  const losers = allScoresForGame.filter(score => !winners.map(winner => winner.discordId).includes(score.discordId));
  for (const loser of losers) {
    await db.updateScore(loser.discordId, loser.gameNumber, loser.attempts, 0, 0);
  }
}

async function informLatestResults(winners: IScore[], parsedWordle: UserScore, message: any) {
  const winnerDiscordIds = winners.map(winner => winner.discordId);
  const winnerDiscordTags = winnerDiscordIds.map(id => `<@${id}>`);
  const winnerNames = winners.map(winner => winner.player?.discordName || 'No Name');
  console.log('Current Winner(s):', winnerNames);

  const gameNumber = winners[0].gameNumber || 1;
  const winningAttempts = winners[0].attempts === 'X' ? 0 : parseInt(winners[0].attempts);
  const winnerTags = isUserTaggingEnabled ? winnerDiscordTags.join(', ') : winnerNames.join(', ');
  const winnerMessage = `Current Winner${winners.length > 1 ? "s" : ""} for Wordle ${gameNumber.toLocaleString()} with ${winningAttempts} attempt${winningAttempts !== 0 && winningAttempts > 1 ? 's' : ''}: ${winnerTags}`;
  console.log(winnerMessage);
  isLatestWordleAWinner(parsedWordle, winnerTags) ? await message.channel.send(winnerMessage) : console.log('No winner change so no message to send.');
}

function parseWordleResult(message: any): UserScore | undefined {
  const userName = message.author.username;
  const discordId = message.author.id;
  const match = wordlePattern.exec(message.content);

  if (match) {
    const gameNumber = parseInt(match[1].replace(/,/g, ''));
    const attempts = match[4];

    return {
      discordId,
      userName,
      gameNumber,
      attempts,
    };
  }

  return undefined;
}

function isLatestWordleAWinner(parsedWordle: UserScore | undefined, winners: string): boolean {
  return parsedWordle !== undefined
    && Object.keys(parsedWordle).length > 0
    && (winners.includes(parsedWordle.userName) || winners.includes(`<@${parsedWordle.discordId}>`));
}

async function processLatestWordleResult(parsedWordle: UserScore): Promise<IScore[]> {
  // Check if the result already exists in the database
  const scoresForCurrentGameNumber = await db.getScoresByNumber(parsedWordle.gameNumber);

  const existingResultForUser = scoresForCurrentGameNumber.find((score) => score.discordId === parsedWordle.discordId);
  if (!existingResultForUser) {
    await db.createPlayer(parsedWordle.discordId, parsedWordle.userName);
    if (scoresForCurrentGameNumber.length === 0) {
      await db.createWordle(parsedWordle.gameNumber);
    }
    const addedScore = await db.createScore(parsedWordle.discordId, parsedWordle.gameNumber, parsedWordle.attempts);
    if (addedScore) {
      scoresForCurrentGameNumber.push(addedScore);
      console.log(`Result added to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    } else {
      console.error(`Error adding result to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    }
  } else {
    console.log(`Result already exists: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
  }

  return scoresForCurrentGameNumber;
}

async function processCommand(message: any, channel: TextChannel) {
  try {
    // Parse the command and arguments
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase() || 'CommandNotFound';

    // Validate command name
    if (!/^[a-z0-9]+$/i.test(commandName)) {
      await channel.messages.channel.send('Invalid command.');
      return;
    }

    // Get the command
    const command = client.commands.get(commandName);

    if (!command) {
      await channel.messages.channel.send(`Unknown command: ${commandName}`);
      return;
    }

    await command.execute(message, args, channel, db);
  } catch (error) {
    console.error(error);
    channel.messages.channel.send('There was an error executing that command.');
  }
}

await client.login(process.env.BOT_TOKEN);
