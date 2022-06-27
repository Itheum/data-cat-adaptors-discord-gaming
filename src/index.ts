import dotenv from 'dotenv';
import { ExcludedChannelGuildEntry, ExcludedUserGuildEntry } from "./dynamodb-interfaces";
import { REST } from "@discordjs/rest";
import { SlashCommandBuilder } from "@discordjs/builders"
import { Routes } from "discord-api-types/v9";
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
import {
  ADMIN_COMMANDS,
  ADMIN_ROLES,
  CONNECT_ELROND_WALLET_COMMAND,
  EXCLUDE_CHANNEL_COMMAND,
  EXCLUDE_GAMER_COMMAND, GAMER_PASSPORT_COMMANDS, GAMER_PASSPORT_ROLE,
  INCLUDE_CHANNEL_COMMAND,
  INCLUDE_GAMER_COMMAND, MY_PORTAL_COMMAND,
  REGISTER_FOR_GAMER_PASSPORT_COMMAND,
  TOGGLE_ADAPTER_STATUS_COMMAND,
  VIEW_ADAPTER_STATUS_COMMAND,
  VIEW_EXCLUDED_CHANNELS_COMMAND,
  VIEW_EXCLUDED_GAMERS_COMMAND
} from "./constants";

dotenv.config();

/* Register commands */

const commands = [
  // include, exclude and list excluded gamers
  (new SlashCommandBuilder()
    .setName(EXCLUDE_GAMER_COMMAND)
    .setDescription('Excludes gamer from being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be excluded')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(INCLUDE_GAMER_COMMAND)
    .setDescription('Includes gamer for being tracked')
    .addStringOption(option =>
      option.setName('user-id')
        .setDescription('The id of the user to be included')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_EXCLUDED_GAMERS_COMMAND)
    .setDescription('Views excluded gamers from being tracked')
    .setDefaultPermission(true))
    .toJSON(),

  // include, exclude and list excluded channels
  (new SlashCommandBuilder()
    .setName(EXCLUDE_CHANNEL_COMMAND)
    .setDescription('Excludes channel from being tracked')
    .addStringOption(option =>
      option.setName('channel-id')
        .setDescription('The id of the channel to be excluded')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(INCLUDE_CHANNEL_COMMAND)
    .setDescription('Includes channel for being tracked')
    .addStringOption(option =>
      option.setName('channel-id')
        .setDescription('The id of the channel to be included')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_EXCLUDED_CHANNELS_COMMAND)
    .setDescription('Views excluded channels from being tracked')
    .setDefaultPermission(true))
    .toJSON(),

  // toggle and view adapter status
  (new SlashCommandBuilder()
    .setName(TOGGLE_ADAPTER_STATUS_COMMAND)
    .setDescription('Toggles adapter status (running/paused)')
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_ADAPTER_STATUS_COMMAND)
    .setDescription('Views the adapter status (running/paused)')
    .setDefaultPermission(true))
    .toJSON(),

  // register for gamer passport, show my portal and connect Elrond wallet
  (new SlashCommandBuilder()
    .setName(REGISTER_FOR_GAMER_PASSPORT_COMMAND)
    .setDescription('Returns a link for registering for the gamer passport')
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(MY_PORTAL_COMMAND)
    .setDescription('Returns a link for viewing user portal')
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(CONNECT_ELROND_WALLET_COMMAND)
    .setDescription('Returns a link for connecting Elrond wallet')
    .setDefaultPermission(true))
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

  if (ADMIN_COMMANDS.includes(interaction.commandName)) {
    if (!guildMemberHasAdminRole(interaction!.member! as GuildMember)) {
      await interaction.reply(`only ${ADMIN_ROLES.toString()} are allowed to perform this command`);
      return;
    }
  } else if (GAMER_PASSPORT_COMMANDS.includes(interaction.commandName)) {
    if (!guildOrGuildMemberHasGamerPassportRole(interaction!.member! as GuildMember)) {
      await interaction.reply(`only ${GAMER_PASSPORT_ROLE} is allowed to perform this command`);
      return;
    }
  }

  const guildId = interaction.guildId!;

  if (interaction.commandName === EXCLUDE_GAMER_COMMAND) {
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
  } else if(interaction.commandName === INCLUDE_GAMER_COMMAND) {
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
  } else if(interaction.commandName === VIEW_EXCLUDED_GAMERS_COMMAND) {
    try {
      const excludedUserGuild = await getAllExcludedUserGuild(guildId);

      await interaction.reply(formatExcludedUserGuild(excludedUserGuild));
    } catch (err: any) {
      await interaction.reply('error while viewing excluded gamers');
    }
  } else if (interaction.commandName === EXCLUDE_CHANNEL_COMMAND) {
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
  } else if(interaction.commandName === INCLUDE_CHANNEL_COMMAND) {
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
  } else if(interaction.commandName === VIEW_EXCLUDED_CHANNELS_COMMAND) {
    try {
      const excludedChannelGuild = await getAllExcludedChannelGuild(guildId);

      await interaction.reply(formatExcludedChannelGuild(excludedChannelGuild));
    } catch (err: any) {
      await interaction.reply('error while viewing excluded channels');
    }
  } else if(interaction.commandName === TOGGLE_ADAPTER_STATUS_COMMAND) {
    adapterIsRunning != adapterIsRunning;
    await interaction.reply(`adapter mode changed to ${adapterIsRunning ? 'running' : 'paused'}`);

  } else if(interaction.commandName === VIEW_ADAPTER_STATUS_COMMAND) {
    adapterIsRunning != adapterIsRunning;
    await interaction.reply(`adapter is currently ${adapterIsRunning ? 'running' : 'paused'}`);

  } else if(interaction.commandName === REGISTER_FOR_GAMER_PASSPORT_COMMAND) {
    await interaction.reply(`head over to https://itheum.com/gamerpassport`);

  } else if(interaction.commandName === MY_PORTAL_COMMAND) {
    await interaction.reply(`head over to https://itheum.com/gamerpassport`);

  } else if(interaction.commandName === CONNECT_ELROND_WALLET_COMMAND) {
    await interaction.reply(`head over to https://itheum.com/gamerpassport`);
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

function guildMemberHasAdminRole(guildMember: GuildMember): boolean {
  return getGuildOrGuildMemberRoleNames(guildMember).some(role => ADMIN_ROLES.includes(role));
}

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);