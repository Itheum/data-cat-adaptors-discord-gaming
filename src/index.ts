import dotenv from 'dotenv';
import {
  Client,
  Intents,
  Message,
  MessageReaction,
  PartialUser,
  TextChannel,
  User,
  Interaction,
  PartialMessageReaction
} from "discord.js";
import { REST } from "@discordjs/rest";
import { SlashCommandBuilder } from "@discordjs/builders"
import { Routes } from "discord-api-types/v9";
import {
  excludeUserGuild,
  includeUserGuild,
  getExcludedUserGuild,
  getNMostActiveUsers,
  updateUserGuildActivities,
  updateUserGuildMentions,
  startAudioVideoSession,
  getAllExcludedUserGuild,

  endAudioVideoSession,
} from "./aws-dynamodb-connector";
import {ExcludedUserGuildEntry, UserGuildActivityEntry} from "./dynamodb-interfaces";

dotenv.config();

const allowedRolesForCommandInteraction = ['Owner', 'Data Auditors'];


/* Register commands */

const commands = [
  (new SlashCommandBuilder()
    .setName('exclude')
    .setDescription('Excludes user from being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be excluded')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('re-include')
    .setDescription('Re-includes user for being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be ere-included')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('list-excluded')
    .setDescription('Lists excluded user from being tracked')
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('get-most-n-active-user')
    .setDescription('Lists most N active users')
    .addNumberOption(option =>
      option.setName('n')
        .setDescription('The amount of active users')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
];

const rest = new REST({version: '9'}).setToken(process.env.DISCORD_BOT_TOKEN!);

rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands }).catch(console.error);


/* Setup client */

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_VOICE_STATES]
});

client.on("ready", () => {
  console.log("Itheum bot is ready to go!");
});

client.on("voiceStateUpdate", (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;

  if (!oldState.streaming && newState.streaming) {
    startAudioVideoSession(userId, guildId, 'screencast');
  }
  if (oldState.streaming && !newState.streaming) {
    endAudioVideoSession(userId, guildId, 'screencast');
  }

  if (!oldState.selfVideo && newState.selfVideo) {
    startAudioVideoSession(userId, guildId, 'video');
  }
  if (oldState.selfVideo && !newState.selfVideo) {
    endAudioVideoSession(userId, guildId, 'video');
  }

  if (!oldState.selfMute && newState.selfMute) {
    startAudioVideoSession(userId, guildId, 'microphone');
  }
  if (oldState.selfMute && !newState.selfMute) {
    endAudioVideoSession(userId, guildId, 'microphone');
  }

  if (!oldState.channel && newState.channel) {
    startAudioVideoSession(userId, guildId, 'voiceChannel');
  }
  if (oldState.channel && !newState.channel) {
    endAudioVideoSession(userId, guildId, 'voiceChannel');
  }
});

client.on("messageCreate", async (msg: Message) => {
  const userId = msg.author.id;
  const guildId = (msg.channel as TextChannel).guild.id;
  const isReply = msg.mentions.users.size !== 0;

  let mentionedUsers = [] as string[];

  if (isReply) {
    mentionedUsers = msg.mentions.users.map(ele => ele.id);
  }

  try {
    await getExcludedUserGuild(userId, guildId);
    return;
  } catch (err: any) {
    // user is not excluded, continue
  }

  const messageIncrement = isReply ? 0 : 1;
  const replyIncrement = isReply ? 1 : 0;

  updateUserGuildMentions(mentionedUsers, guildId);
  updateUserGuildActivities(userId, guildId , messageIncrement, replyIncrement, 0, 0, msg.content.length);
});

client.on("messageReactionAdd", async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
  const userId = user.id;
  const guildId = (reaction.message.channel as TextChannel)!.guild.id;

  try {
    await getExcludedUserGuild(userId, guildId);
    return;
  } catch (err: any) {
    // user is not excluded, continue
  }

  updateUserGuildActivities(userId, guildId , 0, 0, 1, 0, 0);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const highestUserRole = (interaction!.member!.roles as any)['highest']['name'] as string;

  if (!allowedRolesForCommandInteraction.includes(highestUserRole)) {
    await interaction.reply(`only ${allowedRolesForCommandInteraction.toString()} are allowed to perform these commands`);
    return;
  }

  const guildId = interaction.guildId!;

  if (interaction.commandName === 'exclude') {
    const userId = interaction.options.get('user-id')?.value as string;

    if (!userId) {
      return;
    }

    try {
      await excludeUserGuild(userId, guildId);
      await interaction.reply('excluded');
    } catch (err: any) {
      await interaction.reply('error while excluding');
    }
  } else if(interaction.commandName === 're-include') {
    const userId = interaction.options.get('user-id')?.value as string;

    if (!userId) {
      return;
    }

    try {
      await includeUserGuild(userId, guildId);
      await interaction.reply('re-included');
    } catch (err: any) {
      await interaction.reply('error while re-including');
    }
  } else if(interaction.commandName === 'list-excluded') {
    try {
      const excludedUserGuild = await getAllExcludedUserGuild(guildId);

      await interaction.reply(formatExcludedUserGuild(excludedUserGuild));
    } catch (err: any) {
      await interaction.reply('error while listing excluded');
    }
  } else if(interaction.commandName === 'get-most-n-active-user') {
    const n = interaction.options.get('n')?.value as number;

    if(!n) {
      return;
    }

    const mostActiveUsers = await getNMostActiveUsers(n, guildId)

    try {
      await interaction.reply(formatMostActiveUsers(mostActiveUsers));
    } catch (err: any) {
      await interaction.reply('error while re-including');
    }
  }
});

const formatExcludedUserGuild = (excludedUserGuild: ExcludedUserGuildEntry[]) => {
  if (!excludedUserGuild || excludedUserGuild.length === 0) {
    return "no results";
  }

  let result = "userId - date\n";

  for (const exclUserGuild of excludedUserGuild) {
    result += exclUserGuild.userId + ' - ' + exclUserGuild.date + '\n';
  }
  return result;
};

const formatMostActiveUsers = (mostActiveUsers: UserGuildActivityEntry[]) => {
  if (!mostActiveUsers || mostActiveUsers.length === 0) {
    return "no results";
  }

  let result = "userId - activityScore\n";

  for (const activeUsers of mostActiveUsers) {
    result += activeUsers.userId + ' - ' + activeUsers.activityScore + '\n';
  }
  return result;
};

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);