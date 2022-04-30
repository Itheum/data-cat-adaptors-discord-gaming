import dotenv from 'dotenv';
import { Client, Message, MessageReaction, PartialUser, TextChannel, User } from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  excludeUserGuild,
  includeUserGuild,
  getExcludedUserGuild,
  getNMostActiveUsers,
  incrementUserGuildActivities,
  getAllExcludedUserGuild,
} from "./aws-dynamodb";

dotenv.config();


/* Register commands */

const commands = [
  {
    // todo add userId argument
    name: 'exclude',
    description: 'Excludes user from being tracked',
  },{
    // todo add userId argument
    name: 're-include',
    description: 'Re-includes user for being tracked',
  },{
    name: 'list-excluded',
    description: 'Lists excluded user from being tracked',
  },{
    // todo add N argument
    name: 'get-most-n-active-user',
    description: 'Lists most N active users',
  },
];

const rest = new REST({version: '9'}).setToken(process.env.DISCORD_BOT_TOKEN!);

rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands }).catch(console.error);


/* Setup client */

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
});

client.on("ready", () => {
  console.log("Itheum bot is ready to go!");
});

client.on("message", async (msg: Message) => {
  const userId = msg.author.id;
  const guildId = (msg.channel as TextChannel).guild.id;
  const isReply = msg.mentions.users.size !== 0;

  try {
    await getExcludedUserGuild(userId, guildId);
    return;
  } catch (err: any) {
    // user is not excluded, continue
  }

  const messageIncrement = isReply ? 0 : 1;
  const replyIncrement = isReply ? 1 : 0;

  incrementUserGuildActivities(userId, guildId , messageIncrement, replyIncrement, 0);
});

client.on("messageReactionAdd", async (msgReaction: MessageReaction, user:User | PartialUser ) => {
  const userId = user.id;
  const guildId = (msgReaction.message.channel as TextChannel)!.guild.id;

  try {
    await getExcludedUserGuild(userId, guildId);
    return;
  } catch (err: any) {
    // user is not excluded, continue
  }

  incrementUserGuildActivities(userId, guildId , 0, 0, 1);
});

client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isCommand()) {
    return;
  }

  const guildId = ''; // todo extract guildId

  if (interaction.commandName === 'exclude') {
    const userId = ''; // todo extract userId

    try {
      await excludeUserGuild(userId, guildId);
      await interaction.reply('excluded');
    } catch (err: any) {
      await interaction.reply('error while excluding');
    }
  } else if(interaction.commandName === 're-include') {
    const userId = ''; // todo extract userId

    try {
      await includeUserGuild(userId, guildId);
      await interaction.reply('re-included');
    } catch (err: any) {
      await interaction.reply('error while re-including');
    }
  } else if(interaction.commandName === 'list-excluded') {
    try {
      await interaction.reply(await getAllExcludedUserGuild(guildId));
    } catch (err: any) {
      await interaction.reply('error while re-including');
    }
  } else if(interaction.commandName === '') {
    const n = 0; // todo extract N

    try {
      await interaction.reply(await getNMostActiveUsers(n, guildId));
    } catch (err: any) {
      await interaction.reply('error while re-including');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);