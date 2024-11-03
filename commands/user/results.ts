import { Message, TextChannel, type OmitPartialGroupDMChannel } from 'discord.js';

import { getUserGameResults } from '../../user-stats';

export default {
  name: 'results',
  description: 'Get your own Wordle results',
  async execute(message: any, args: any, channel: TextChannel) {
    const results = await getUserGameResults(message.author.id, args[0]);
    const resultString = results ? `Your Wordle result for game #${results.gameNumber.toLocaleString()} is ${results.attempts}/6` : 'No results found';
    await channel.messages.channel.send(resultString);
  },
};
