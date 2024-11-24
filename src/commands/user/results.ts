import { TextChannel } from 'discord.js';
import type { TursoDatabaseProvider } from '../../db/turso';

export default {
  name: 'results',
  description: 'Get your own Wordle results',
  async execute(message: any, args: any, channel: TextChannel, db: TursoDatabaseProvider) {
    const results = await db.getUserGameResults(message.author.id, args[0]);
    const resultString = results ? `Your Wordle result for game #${results.gameNumber.toLocaleString()} is ${results.attempts}/6` : 'No results found';
    await channel.messages.channel.send(resultString);
  },
};
