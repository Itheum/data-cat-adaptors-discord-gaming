import dotenv from 'dotenv';
import * as Sentry from "@sentry/node";
import "@sentry/tracing";
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
  getAllExcludedChannelGuild,
  getExcludedChannelGuild,
  getGuildConfig,
  setGuildConfigLink,
} from "./aws-dynamodb-connector";
import {
  ADMIN_COMMANDS,
  GAMER_PASSPORT_PLAYER_ROLE,
  GAMER_PASSPORT_ADMIN_ROLE,
  CONNECT_ELROND_WALLET_COMMAND,
  EXCLUDE_CHANNEL_COMMAND,
  EXCLUDE_GAMER_COMMAND,
  GAMER_PASSPORT_COMMANDS,
  INCLUDE_CHANNEL_COMMAND,
  INCLUDE_GAMER_COMMAND,
  MY_PORTAL_COMMAND,
  REGISTER_FOR_GAMER_PASSPORT_COMMAND,
  TOGGLE_ADAPTER_STATUS_COMMAND,
  VIEW_ADAPTER_STATUS_COMMAND,
  VIEW_EXCLUDED_CHANNELS_COMMAND,
  VIEW_EXCLUDED_GAMERS_COMMAND,
  SET_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND,
  SET_CONNECT_ELROND_WALLET_LINK_COMMAND,
  SET_MY_PORTAL_LINK_COMMAND,
  VIEW_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND,
  VIEW_CONNECT_ELROND_WALLET_LINK_COMMAND,
  VIEW_MY_PORTAL_LINK_COMMAND
} from "./constants";

dotenv.config();

Sentry.init({
  dsn: "https://275e261875874864a10ff98509030917@o176671.ingest.sentry.io/6543206",
  tracesSampleRate: 1.0,
});

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

  // set and view guild config links
  (new SlashCommandBuilder()
    .setName(SET_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND)
    .setDescription('Sets the link for registering for gamer passport')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('The link that should be returned to the gamer')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(SET_CONNECT_ELROND_WALLET_LINK_COMMAND)
    .setDescription('Sets the link for connecting an elrond wallet')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('The link that should be returned to the gamer')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(SET_MY_PORTAL_LINK_COMMAND)
    .setDescription('Sets the link for the gamers portal')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('The link that should be returned to the gamer')
        .setRequired(true))
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND)
    .setDescription('Views the link for registering for gamer passport')
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_CONNECT_ELROND_WALLET_LINK_COMMAND)
    .setDescription('Views the link for connecting an elrond wallet')
    .setDefaultPermission(true))
    .toJSON(),
  (new SlashCommandBuilder()
    .setName(VIEW_MY_PORTAL_LINK_COMMAND)
    .setDescription('Views the link for the gamers portal')
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

let adapterIsRunning = true;

/* Setup client */

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_VOICE_STATES]
});

client.on("ready", () => {
  console.log("Itheum bot is ready to go!");
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const channelId = newState.channel?.id

  if (!(await preconditionsFulfilled(newState.guild, newState.member, userId, channelId, guildId))) {
    return;
  }

  if (!oldState.streaming && newState.streaming) {
    console.log("user is starting a screencast");
    startAudioVideoSession(userId, guildId, 'screencast');

  } else if (oldState.streaming && !newState.streaming) {
    console.log("user is ending a screencast");
    endAudioVideoSession(userId, guildId, 'screencast');
  }

  if (!oldState.selfVideo && newState.selfVideo) {
    console.log("user is starting a webcam");
    startAudioVideoSession(userId, guildId, 'video');

  } else if (oldState.selfVideo && !newState.selfVideo) {
    console.log("user is ending a webcam");
    endAudioVideoSession(userId, guildId, 'video');
  }

  if (oldState.selfMute && !newState.selfMute) {
    console.log("user is starting a microphone");
    startAudioVideoSession(userId, guildId, 'microphone');

  } else if (!oldState.selfMute && newState.selfMute) {
    console.log("user is ending a microphone");
    endAudioVideoSession(userId, guildId, 'microphone');
  }

  if (!oldState.channel && newState.channel) {
    console.log("user is joining a voice channel");
    startAudioVideoSession(userId, guildId, 'voiceChannel');

    if (!newState.selfMute) {
      console.log("with a microphone");
      startAudioVideoSession(userId, guildId, 'microphone');
    }
  } else if (oldState.channel && !newState.channel) {
    console.log("user is leaving a voice channel");
    endAudioVideoSession(userId, guildId, 'voiceChannel');

    if (!oldState.selfMute) {
      console.log("with a microphone");
      endAudioVideoSession(userId, guildId, 'microphone');
    }
  }
});

client.on("messageCreate", async (msg: Message) => {
  const userId = msg.author.id;
  const channelId = msg.channel.id;
  const guildId = (msg.channel as TextChannel).guild.id;

  if (!(await preconditionsFulfilled(msg.guild, msg.member, userId, channelId, guildId))) {
    return;
  }

  const isReply = msg.mentions.users.size !== 0;

  let mentionedUsers = [] as string[];

  if (isReply) {
    mentionedUsers = msg.mentions.users.map(ele => ele.id);
  }

  const messageIncrement = isReply ? 0 : 1;
  const replyIncrement = isReply ? 1 : 0;

  updateUserGuildMentions(mentionedUsers, guildId);
  updateUserGuildActivities(userId, guildId , messageIncrement, replyIncrement, 0, 0, msg.content.length);
});

client.on("messageReactionAdd", async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
  const userId = user.id;
  const channelId = reaction.message.channel.id;
  const guildId = (reaction.message.channel as TextChannel).guild.id;
  const guildMember = reaction.message.guild?.members.cache.toJSON().find(member => member.user.id === userId);

  if (!(await preconditionsFulfilled(reaction.message.guild, guildMember, userId, channelId, guildId))) {
    return;
  }

  updateUserGuildActivities(userId, guildId , 0, 0, 1, 0, 0);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (!interaction.isCommand()) {
    console.log("interaction is no command");
    return;
  }

  if (ADMIN_COMMANDS.includes(interaction.commandName)) {
    if (!guildMemberHasGamerPassportAdminRole(interaction.member as GuildMember | null)) {
      console.log("user is not allowed to perform command");
      await interaction.reply(`only ${GAMER_PASSPORT_ADMIN_ROLE} is allowed to perform this command`);
      return;
    }
  } else if (GAMER_PASSPORT_COMMANDS.includes(interaction.commandName)) {
    if (!guildOrGuildMemberHasGamerPassportPlayerRole(interaction.member as GuildMember | null)) {
      console.log("user is not allowed to perform command");
      await interaction.reply(`only ${GAMER_PASSPORT_PLAYER_ROLE} is allowed to perform this command`);
      return;
    }
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    console.log("can't read guild id of interaction");
    return;
  }

  if (interaction.commandName === EXCLUDE_GAMER_COMMAND) {
    const userId = interaction.options.get('user-id')?.value as string;

    if (!userId) {
      console.log("user id is needed for excluding a user");
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
      console.log("user id is needed for including a user");
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
      console.log("channel id is needed for excluding a channel");
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
      console.log("channel id is needed for including a channel");
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
    adapterIsRunning = !adapterIsRunning;
    console.log(`adapter set to ${adapterIsRunning ? 'running' : 'paused'}`);
    await interaction.reply(`adapter mode changed to ${adapterIsRunning ? 'running' : 'paused'}`);

  } else if(interaction.commandName === VIEW_ADAPTER_STATUS_COMMAND) {
    await interaction.reply(`adapter is currently ${adapterIsRunning ? 'running' : 'paused'}`);

  } else if(interaction.commandName === REGISTER_FOR_GAMER_PASSPORT_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(`head over to ${guildConfig.links.registerForGamerPassport}`);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  } else if(interaction.commandName === MY_PORTAL_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(`head over to ${guildConfig.links.myPortal}`);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  } else if(interaction.commandName === CONNECT_ELROND_WALLET_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(`head over to ${guildConfig.links.connectElrondWallet}`);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  } else if(interaction.commandName === SET_MY_PORTAL_LINK_COMMAND) {
    const link = interaction.options.get('link')?.value as string;

    if (!link) {
      console.log("link is needed for setting it");
      return;
    }

    try {
      await setGuildConfigLink(guildId, link, 'my-portal');
      await interaction.reply('link set');
    } catch (err: any) {
      await interaction.reply('error while setting link');
    }
  } else if(interaction.commandName === SET_CONNECT_ELROND_WALLET_LINK_COMMAND) {
    const link = interaction.options.get('link')?.value as string;

    if (!link) {
      console.log("link is needed for setting it");
      return;
    }

    try {
      await setGuildConfigLink(guildId, link, 'connect-elrond-wallet');
      await interaction.reply('link set');
    } catch (err: any) {
      await interaction.reply('error while setting link');
    }
  } else if(interaction.commandName === SET_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND) {
    const link = interaction.options.get('link')?.value as string;

    if (!link) {
      console.log("link is needed for setting it");
      return;
    }

    try {
      await setGuildConfigLink(guildId, link, 'register-for-gamer-passport');
      await interaction.reply('link set');
    } catch (err: any) {
      await interaction.reply('error while setting link');
    }
  } else if(interaction.commandName === VIEW_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(guildConfig.links.registerForGamerPassport);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  } else if(interaction.commandName === VIEW_MY_PORTAL_LINK_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(guildConfig.links.myPortal);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  } else if(interaction.commandName === VIEW_CONNECT_ELROND_WALLET_LINK_COMMAND) {
    try {
      const guildConfig = await getGuildConfig(guildId);
      await interaction.reply(guildConfig.links.connectElrondWallet);
    } catch (err: any) {
      await interaction.reply('N/A');
    }
  }
});

async function preconditionsFulfilled(guild: Guild | null | undefined, member: GuildMember | null | undefined, userId: string, channelId: string | null | undefined, guildId: string): Promise<boolean> {
  if (!guild) {
    console.log("guild is null or undefined");
    return false;
  }

  if (!member) {
    console.log("member is null or undefined");
    return false;
  }

  if (!channelId) {
    console.log("channelId is null or undefined");
    return false;
  }

  if (!adapterIsRunning) {
    console.log("adapter is not running");
    return false;
  }

  if (guildOrGuildMemberHasGamerPassportPlayerRole(guild) && !guildOrGuildMemberHasGamerPassportPlayerRole(member)) {
    console.log(`guild has ${GAMER_PASSPORT_PLAYER_ROLE} but user hasn't`);
    return false;
  }

  try {
    await getExcludedUserGuild(userId, guildId);
    console.log("user is excluded");
    return false;
  } catch (err: any) {
    // user is not excluded, continue
  }

  try {
    await getExcludedChannelGuild(channelId, guildId);
    console.log("channel is excluded");
    return false;
  } catch (err: any) {
    // channel is not excluded, continue
  }

  return true;
}

function formatExcludedUserGuild(excludedUserGuild: ExcludedUserGuildEntry[]): string {
  if (!excludedUserGuild || excludedUserGuild.length === 0) {
    return "no results";
  }

  let result = "userId - date\n";

  for (const exclUserGuild of excludedUserGuild) {
    result += exclUserGuild.userId + ' - ' + exclUserGuild.date + '\n';
  }
  return result;
}

function formatExcludedChannelGuild(excludedChannelGuild: ExcludedChannelGuildEntry[]): string {
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
  if (!guildOrGuildMember.roles || !guildOrGuildMember.roles.cache) {
    console.log('guildOrGuildMember has no roles');
    return [];
  }
  return guildOrGuildMember.roles.cache.toJSON().map(role => role.name);
}

function guildOrGuildMemberHasGamerPassportPlayerRole(guildOrGuildMember: Guild | GuildMember | null): boolean {
  if (!guildOrGuildMember) {
    console.log('guildOrGuildMember is null or undefined');
    return false;
  }
  return getGuildOrGuildMemberRoleNames(guildOrGuildMember).includes(GAMER_PASSPORT_PLAYER_ROLE);
}

function guildMemberHasGamerPassportAdminRole(guildMember: GuildMember | null): boolean {
  if (!guildMember) {
    console.log('guildMember is null or undefined');
    return false;
  }
  return getGuildOrGuildMemberRoleNames(guildMember).includes(GAMER_PASSPORT_ADMIN_ROLE);
}

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);