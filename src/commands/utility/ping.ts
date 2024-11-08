import { Message, type OmitPartialGroupDMChannel } from 'discord.js';

export default {
  name: 'ping',
  description: 'Responds with Pong!',
  async execute(message: OmitPartialGroupDMChannel<Message>, args: any) {
    // await message.channel.send('Pong!');
  },
};

