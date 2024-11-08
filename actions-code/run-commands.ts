import { GatewayIntentBits, TextChannel } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { CustomClient } from '../src/CustomClient';

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
const client = new CustomClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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

client.once('ready', async (client) => {
  console.log(`Logged in as ${client.user?.tag}!`);
  const channel = await client.channels.fetch(TARGET_CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error('Channel not found!');
    await client.destroy();
    return;
  }

  try {
    const message = JSON.parse(process.env.DISCORD_MESSAGE || '{}');
    await handleMessage(message, channel);
  } catch (error) {
    console.error(error);
    channel.messages.channel.send('There was an error executing that command.');
  } finally {
    await client.destroy();
    console.log('Finished processing command. Client disconnected.');
  }
});

// Use this to test locally
// client.on('messageCreate', (message) => {
//   console.log(message.author.id);
//   handleMessage(message, message.channel as TextChannel);
// });

client.login(process.env.BOT_TOKEN);

async function handleMessage(message: any, channel: TextChannel) {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if the message starts with the prefix
  if (!message.content.startsWith(PREFIX)) return;

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

  await command.execute(message, args, channel);
}
