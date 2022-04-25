import dotenv from 'dotenv';
import { Client, Message, MessageReaction, PartialUser, TextChannel, User } from "discord.js";
import { incrementUserGuildActivities } from "./aws-dynamodb";

dotenv.config();

const client = new Client({
  partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER'],
})

client.on("ready", () => {
  console.log("Itheum bot is ready to go!")
})

client.on("message", async (msg: Message) => {
  const userId = msg.author.id;
  const guildId = (msg.channel as TextChannel).guild.id;
  const isReply = msg.mentions.users.size !== 0;

  const messageIncrement = isReply ? 0 : 1;
  const replyIncrement = isReply ? 1 : 0;

  incrementUserGuildActivities(userId, guildId , messageIncrement, replyIncrement, 0);
})

client.on("messageReactionAdd", async (msgReaction: MessageReaction, user:User | PartialUser ) => {
  const userId = user.id;
  const guildId = (msgReaction.message.channel as TextChannel)!.guild.id;

  incrementUserGuildActivities(userId, guildId , 0, 0, 1);
})

client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);