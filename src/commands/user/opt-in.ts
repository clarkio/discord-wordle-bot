import { TextChannel } from 'discord.js';
import type { TursoDatabaseProvider } from '../../db/turso';

export default {
  name: 'optin',
  description: 'Opt-in for your stats to show in the public leaderboard data',
  async execute(message: any, args: any, channel: TextChannel, db: TursoDatabaseProvider) {
    const result = await db.updatePlayer(message.author.id, true);

    let responseMessage: string = '';
    if (!result) {
      responseMessage = `<@${message.author.id}> you have already opted in for showing up in the public leaderboard data`;
    } else {
      responseMessage = `<@${message.author.id}> you have successfully opted in for showing up in the public leaderboard data`;
    }

    await channel.messages.channel.send(responseMessage);
  },
};
