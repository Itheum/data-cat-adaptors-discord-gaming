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
  PartialMessageReaction,
  GuildMember,
  Guild,
} from "discord.js";
import { REST } from "@discordjs/rest";
import { SlashCommandBuilder } from "@discordjs/builders"
import { Routes } from "discord-api-types/v9";
import {
  excludeUserGuild,
  includeUserGuild,
  getExcludedUserGuild,
  updateUserGuildActivities,
  updateUserGuildMentions,
  startAudioVideoSession,
  getAllExcludedUserGuild,
  endAudioVideoSession,
  excludeChannelGuild,
  includeChannelGuild,
  getAllExcludedChannelGuild, getExcludedChannelGuild,
} from "./aws-dynamodb-connector";
import {ExcludedChannelGuildEntry, ExcludedUserGuildEntry} from "./dynamodb-interfaces";

dotenv.config();

const ALLOWED_ROLES_FOR_COMMAND_INTERACTION = ['Owner', 'Data Auditors'];
const GAMER_PASSPORT_ROLE = "Gamer Passport";


/* Register commands */

const commands = [
  // users (=gamers)
  (new SlashCommandBuilder()
    .setName('exclude-gamer')
    .setDescription('Excludes gamer from being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be excluded')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('include-gamer')
    .setDescription('Includes gamer for being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be included')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('view-excluded-gamers')
    .setDescription('Views excluded gamers from being tracked')
    .setDefaultPermission(false))
    .toJSON(),

  // channels
  (new SlashCommandBuilder()
    .setName('exclude-channel')
    .setDescription('Excludes channel from being tracked')
    .addStringOption(option =>
      option.setName('channel-id')
        .setDescription('The id of the channel to be excluded')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('include-channel')
    .setDescription('Includes channel for being tracked')
    .addStringOption(option =>
      option.setName('channel-id')
        .setDescription('The id of the channel to be included')
        .setRequired(true))
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('view-excluded-channels')
    .setDescription('Views excluded channels from being tracked')
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('toggle-adapter-status')
    .setDescription('Toggles adapter status (running/paused)')
    .setDefaultPermission(false))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName('view-adapter-status')
    .setDescription('Views the adapter status (running/paused)')
    .setDefaultPermission(false))
    .toJSON(),
];

const rest = new REST({version: '9'}).setToken(process.env.DISCORD_BOT_TOKEN!);

rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands }).catch(console.error);

const adapterIsRunning = true;

/* Setup client */

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_VOICE_STATES]
});

client.on("ready", () => {
  console.log("Itheum bot is ready to go!");
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!adapterIsRunning) {
    return;
  }

  if (guildOrGuildMemberHasGamerPassportRole(newState.guild!) && !guildOrGuildMemberHasGamerPassportRole(newState.member!)) {
    return;
  }

  const userId = newState.id;
  const guildId = newState.guild.id;
  const channelId = newState.channel!.id

  try {
    await getExcludedUserGuild(userId, guildId);
    await getExcludedChannelGuild(channelId, guildId);
    return;
  } catch (err: any) {
    // user and channel are not excluded, continue
  }

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

  if (oldState.selfMute && !newState.selfMute) {
    startAudioVideoSession(userId, guildId, 'microphone');
  }
  if (!oldState.selfMute && newState.selfMute) {
    endAudioVideoSession(userId, guildId, 'microphone');
  }

  if (!oldState.channel && newState.channel) {
    startAudioVideoSession(userId, guildId, 'voiceChannel');

    if (!newState.selfMute) {
      startAudioVideoSession(userId, guildId, 'microphone');
    }
  }
  if (oldState.channel && !newState.channel) {
    endAudioVideoSession(userId, guildId, 'voiceChannel');

    if (!oldState.selfMute) {
      endAudioVideoSession(userId, guildId, 'microphone');
    }
  }
});

client.on("messageCreate", async (msg: Message) => {
  if (!adapterIsRunning) {
    return;
  }

  if (guildOrGuildMemberHasGamerPassportRole(msg.guild!) && !guildOrGuildMemberHasGamerPassportRole(msg.member!)) {
    return;
  }

  const userId = msg.author.id;
  const channelId = msg.channel.id;
  const guildId = (msg.channel as TextChannel).guild.id;
  const isReply = msg.mentions.users.size !== 0;

  let mentionedUsers = [] as string[];

  if (isReply) {
    mentionedUsers = msg.mentions.users.map(ele => ele.id);
  }

  try {
    await getExcludedUserGuild(userId, guildId);
    await getExcludedChannelGuild(channelId, guildId);
    return;
  } catch (err: any) {
    // user and channel are not excluded, continue
  }

  const messageIncrement = isReply ? 0 : 1;
  const replyIncrement = isReply ? 1 : 0;

  updateUserGuildMentions(mentionedUsers, guildId);
  updateUserGuildActivities(userId, guildId , messageIncrement, replyIncrement, 0, 0, msg.content.length);
});

client.on("messageReactionAdd", async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
  if (!adapterIsRunning) {
    return;
  }

  const guildMember = reaction.message.guild!.members.cache.toJSON().find(member => member.user.id === user.id);

  if (guildOrGuildMemberHasGamerPassportRole(reaction.message.guild!) && !guildOrGuildMemberHasGamerPassportRole(guildMember!)) {
    return;
  }

  const userId = user.id;
  const channelId = reaction.message.channel.id;
  const guildId = (reaction.message.channel as TextChannel)!.guild.id;

  try {
    await getExcludedUserGuild(userId, guildId);
    await getExcludedChannelGuild(channelId, guildId);
    return;
  } catch (err: any) {
    // user and channel are not excluded, continue
  }

  updateUserGuildActivities(userId, guildId , 0, 0, 1, 0, 0);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isCommand()) {
    return;
  }

  const highestUserRole = (interaction!.member!.roles as any)['highest']['name'] as string;

  if (!ALLOWED_ROLES_FOR_COMMAND_INTERACTION.includes(highestUserRole)) {
    await interaction.reply(`only ${ALLOWED_ROLES_FOR_COMMAND_INTERACTION.toString()} are allowed to perform these commands`);
    return;
  }

  const guildId = interaction.guildId!;

  if (interaction.commandName === 'exclude-gamer') {
    const userId = interaction.options.get('user-id')?.value as string;

    if (!userId) {
      return;
    }

    try {
      await excludeUserGuild(userId, guildId);
      await interaction.reply('gamer excluded');
    } catch (err: any) {
      await interaction.reply('error while excluding gamer');
    }
  } else if(interaction.commandName === 'include-gamer') {
    const userId = interaction.options.get('user-id')?.value as string;

    if (!userId) {
      return;
    }

    try {
      await includeUserGuild(userId, guildId);
      await interaction.reply('gamer included');
    } catch (err: any) {
      await interaction.reply('error while including gamer');
    }
  } else if(interaction.commandName === 'view-excluded-gamers') {
    try {
      const excludedUserGuild = await getAllExcludedUserGuild(guildId);

      await interaction.reply(formatExcludedUserGuild(excludedUserGuild));
    } catch (err: any) {
      await interaction.reply('error while viewing excluded gamers');
    }
  } else if (interaction.commandName === 'exclude-channel') {
    const channelId = interaction.options.get('channel-id')?.value as string;

    if (!channelId) {
      return;
    }

    try {
      await excludeChannelGuild(channelId, guildId);
      await interaction.reply('channel excluded');
    } catch (err: any) {
      await interaction.reply('error while excluding channel');
    }
  } else if(interaction.commandName === 'include-channel') {
    const channelId = interaction.options.get('channel-id')?.value as string;

    if (!channelId) {
      return;
    }

    try {
      await includeChannelGuild(channelId, guildId);
      await interaction.reply('channel included');
    } catch (err: any) {
      await interaction.reply('error while including channel');
    }
  } else if(interaction.commandName === 'view-excluded-channels') {
    try {
      const excludedChannelGuild = await getAllExcludedChannelGuild(guildId);

      await interaction.reply(formatExcludedChannelGuild(excludedChannelGuild));
    } catch (err: any) {
      await interaction.reply('error while viewing excluded channels');
    }
  } else if(interaction.commandName === 'toggle-adapter-status') {
    adapterIsRunning != adapterIsRunning;
    await interaction.reply(`adapter mode changed to ${adapterIsRunning ? 'running' : 'paused'}`);
  } else if(interaction.commandName === 'view-adapter-status') {
    adapterIsRunning != adapterIsRunning;
    await interaction.reply(`adapter is currently ${adapterIsRunning ? 'running' : 'paused'}`);
  }
});

function formatExcludedUserGuild(excludedUserGuild: ExcludedUserGuildEntry[]) {
  if (!excludedUserGuild || excludedUserGuild.length === 0) {
    return "no results";
  }

  let result = "userId - date\n";

  for (const exclUserGuild of excludedUserGuild) {
    result += exclUserGuild.userId + ' - ' + exclUserGuild.date + '\n';
  }
  return result;
}

function formatExcludedChannelGuild(excludedChannelGuild: ExcludedChannelGuildEntry[]) {
  if (!excludedChannelGuild || excludedChannelGuild.length === 0) {
    return "no results";
  }

  let result = "channelId - date\n";

  for (const exclChannelGuild of excludedChannelGuild) {
    result += exclChannelGuild.channelId + ' - ' + exclChannelGuild.date + '\n';
  }
  return result;
}

function getGuildOrGuildMemberRoleNames(guildOrGuildMember: Guild | GuildMember): string[] {
  return guildOrGuildMember.roles.cache.toJSON().map(role => role.name);
}

function guildOrGuildMemberHasGamerPassportRole(guildOrGuildMember: Guild | GuildMember): boolean {
  return getGuildOrGuildMemberRoleNames(guildOrGuildMember).includes(GAMER_PASSPORT_ROLE);
}

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);