import AWS from "aws-sdk";
import { v4 } from 'uuid';
import {
  AudioVideoActivities,
  ExcludedUserGuildEntry,
  UserGuildActivityEntry,
  MessageLengthCounts,
  FrequencyCounts,
} from "./dynamodb-interfaces";

const ONE_MINUTE_IN_S = 60;
const ONE_HOUR_IN_S = ONE_MINUTE_IN_S * 60;
const ONE_S_IN_MS = 1000;

let dynamoDb: AWS.DynamoDB.DocumentClient | null = null;

export function getDynamoDbSingleton(): AWS.DynamoDB.DocumentClient {
  if (!dynamoDb) {
    console.log('set up dynamo db client instance');

    dynamoDb = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    });
  }
  return dynamoDb;
}

export async function getAllExcludedUserGuild(guildId: string): Promise<ExcludedUserGuildEntry[]> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    const existingEntry = await dynamoDbSingleton.scan({
      TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
    }).promise();

    if (existingEntry && existingEntry.Items) {
      return existingEntry.Items as ExcludedUserGuildEntry[];
    }
    return [];
  } catch(err: any) {
    console.error(`error while scanning all entries for guildId ${guildId} in table ${process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME}`, err);
    throw err;
  }
}

export async function getExcludedUserGuild(userId: string, guildId: string): Promise<ExcludedUserGuildEntry> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    const existingEntry = await dynamoDbSingleton.scan({
      TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
      FilterExpression: 'userId = :userId and guildId = :guildId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':guildId': guildId
      }
    }).promise();

    if (existingEntry && existingEntry.Count && existingEntry.Items && existingEntry.Count === 1) {
      return existingEntry.Items[0] as ExcludedUserGuildEntry;
    }
    return {} as ExcludedUserGuildEntry;
  } catch(err: any) {
    console.error(`error while scanning for userId ${userId} and guildId ${guildId} in table ${process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME}`, err);
    throw err;
  }
}

export async function excludeUserGuild(userId: string, guildId: string): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    await getExcludedUserGuild(userId, guildId);
    console.log(`userId=${userId} and guildId=${guildId} already excluded`);
    return;
  } catch (err: any) {
    // user doesn't exist, continue
  }

  const item: ExcludedUserGuildEntry = {
      id: v4(),
      userId,
      guildId,
      date: new Date().toISOString(),
    };

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
      Item: item,
    }).promise();
    console.log(`excluded userId=${userId} and guildId=${guildId}`);
  } catch(err: any) {
    console.error(`error while saving new user exclusion for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function includeUserGuild(userId: string, guildId: string): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    const existingEntry = await getExcludedUserGuild(userId, guildId);

    await dynamoDbSingleton.delete({
      TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
      Key: {
        id: existingEntry.id,
      },
    }).promise();
    console.log(`included userId=${userId} and guildId=${guildId}`);
  } catch(err: any) {
    console.error(`error while deleting user exclusion for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function getNMostActiveUsers(n = 1, guildId: string): Promise<UserGuildActivityEntry[]> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    // todo improve: sort and limit by DB query, not by code
    const existingEntries = await dynamoDbSingleton.scan({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      FilterExpression: 'guildId = :guildId',
      ExpressionAttributeValues: {
        ':guildId': guildId
      },
    }).promise();

    if (existingEntries && existingEntries.Items) {
      return (existingEntries.Items as UserGuildActivityEntry[]).sort(activityScoreSort).slice(0, n);
    }
    return [];
  } catch(err: any) {
    console.error(`error while scanning for most ${n} active users`, err);
    throw err;
  }
}

export async function updateUserGuildMentions(
  userIds: string[],
  guildId: string,
): Promise<void> {
  userIds.forEach(userId => updateUserGuildActivities(userId, guildId, 0, 0,0, 1, 0));
}

export async function updateUserGuildActivities(
  userId: string,
  guildId: string,
  messageIncrement = 0,
  replyIncrement = 0,
  reactionIncrement = 0,
  mentionedIncrement = 0,
  messageLength = 0,
): Promise<void> {
  const existingEntry = await getExistingEntry(userId, guildId);

  if (!existingEntry || existingEntry.Count === 0) {
    await addNewUserGuildActivityEntry(
      userId,
      guildId,
      messageIncrement,
      replyIncrement,
      reactionIncrement,
      mentionedIncrement,
      messageLength,
    );
  } else {
    await updateExistingUserGuildActivityEntry(
      userId,
      guildId,
      existingEntry,
      messageIncrement,
      replyIncrement,
      reactionIncrement,
      mentionedIncrement,
      messageLength,
    );
  }
}

export async function addNewUserGuildActivityEntry(
  userId: string,
  guildId: string,
  messageIncrement = 0,
  replyIncrement = 0,
  reactionIncrement = 0,
  mentionedIncrement = 0,
  messageLength = 0,
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const frequencyCounts: FrequencyCounts = {
    veryHigh: 0,
    high: 0,
    middle: 0,
    low: 0,
  };
  frequencyCounts[getFrequencyCountType(Date.now())] += 1;

  const messageLengthCounts: MessageLengthCounts = {
    veryShort: 0,
    short: 0,
    middle: 0,
    long: 0,
  };

  if (messageLength > 0) {
    messageLengthCounts[getMessageLengthType(messageLength)] += 1;
  }

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      Item: {
        id: v4(),
        userId,
        guildId,
        messageCount: messageIncrement,
        replyCount: replyIncrement,
        reactionCount: reactionIncrement,
        mentionedCount: mentionedIncrement,
        frequencyCounts: frequencyCounts,
        messageLengthCounts: messageLengthCounts,
        activityScore: calculateActivityScore(messageIncrement, replyIncrement, reactionIncrement, mentionedIncrement, frequencyCounts, messageLengthCounts),
        updatedAt: Date.now(),
      } as UserGuildActivityEntry,
    }).promise();
    console.log(`inserted new entry: userId=${userId} and guildId=${guildId}`);
  } catch(err: any) {
    console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function addNewAudioVideoSession(
  userId: string,
  guildId: string,
  type: 'voiceChannel' | 'microphone' | 'video' | 'screencast'
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const audioVideoActivities = {
    joinedVoiceChannelAt: 0,
    enabledMicrophoneAt: 0,
    enabledVideoAt: 0,
    enabledScreencastAt: 0,
    totalTimeInVoiceChannel: 0,
    totalTimeWithMicrophone: 0,
    totalTimeWithVideo: 0,
    totalTimeWithScreencast: 0,
  };

  if (type === 'voiceChannel') {
    audioVideoActivities.joinedVoiceChannelAt = Date.now();
  } else if (type === 'microphone') {
    audioVideoActivities.enabledMicrophoneAt = Date.now();
  } else if (type === 'video') {
    audioVideoActivities.enabledVideoAt = Date.now();
  } else if (type === 'screencast') {
    audioVideoActivities.enabledScreencastAt = Date.now();
  }

  const item: UserGuildActivityEntry = {
      id: v4(),
      userId,
      guildId,
      messageCount: 0,
      replyCount: 0,
      reactionCount: 0,
      mentionedCount: 0,
      frequencyCounts: {
        veryHigh: 0,
        high: 0,
        middle: 0,
        low: 0,
      },
      messageLengthCounts: {
        veryShort: 0,
        short: 0,
        middle: 0,
        long: 0,
      },
      audioVideoActivities: audioVideoActivities,
      activityScore: 0,
      updatedAt: Date.now(),
      version: process.env.npm_package_version!,
    };

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      Item: item,
    }).promise();
    console.log(`inserted new entry: userId=${userId} and guildId=${guildId}`);
  } catch(err: any) {
    console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function updateExistingAudioVideoSession(
  userId: string,
  guildId: string,
  existingEntry: AWS.DynamoDB.DocumentClient.ScanOutput,
  type: 'voiceChannel' | 'microphone' | 'video' | 'screencast'
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const entry = existingEntry.Items![0] as UserGuildActivityEntry;

  if (!entry.audioVideoActivities) {
    entry.audioVideoActivities = {
      joinedVoiceChannelAt: 0,
      enabledMicrophoneAt: 0,
      enabledVideoAt: 0,
      enabledScreencastAt: 0,
      totalTimeInVoiceChannel: 0,
      totalTimeWithMicrophone: 0,
      totalTimeWithScreencast: 0,
      totalTimeWithVideo: 0,
    }
  }

  if (type === 'voiceChannel') {
    entry.audioVideoActivities.joinedVoiceChannelAt = Date.now();
  } else if (type === 'microphone') {
    entry.audioVideoActivities.enabledMicrophoneAt = Date.now();
  } else if (type === 'video') {
    entry.audioVideoActivities.enabledVideoAt = Date.now();
  } else if (type === 'screencast') {
    entry.audioVideoActivities.enabledScreencastAt = Date.now();
  }
  entry.updatedAt = Date.now();

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      Item: entry,
    }).promise();
    console.log(`updated existing entry: userId=${userId} and guildId=${guildId}`);
  } catch(err: any)  {
    console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function updateExistingUserGuildActivityEntry(
  userId: string,
  guildId: string,
  existingEntry: AWS.DynamoDB.DocumentClient.ScanOutput,
  messageIncrement = 0,
  replyIncrement = 0,
  reactionIncrement = 0,
  mentionedIncrement = 0,
  messageLength = 0,
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const entry = existingEntry.Items![0] as UserGuildActivityEntry;

  if (!entry.frequencyCounts) {
    entry.frequencyCounts = {
      veryHigh: 0,
      high: 0,
      middle: 0,
      low: 0,
    };
  }

  if (!entry.messageLengthCounts) {
    entry.messageLengthCounts = {
      veryShort: 0,
      short: 0,
      middle: 0,
      long: 0,
    };
  }

  if (messageLength > 0) {
    entry.messageLengthCounts[getMessageLengthType(messageLength)] += 1;
  }

  if (!entry.mentionedCount) {
    entry.mentionedCount = 0;
  }

  entry.messageCount += messageIncrement;
  entry.replyCount += replyIncrement;
  entry.reactionCount += reactionIncrement;
  entry.mentionedCount += mentionedIncrement;
  entry.frequencyCounts[getFrequencyCountType(entry.updatedAt)] += 1;
  entry.updatedAt = Date.now();
  entry.activityScore = calculateActivityScore(
    entry.messageCount,
    entry.replyCount,
    entry.reactionCount,
    entry.mentionedCount,
    entry.frequencyCounts,
    entry.messageLengthCounts,
  ) + calculateAudioVideoScore(entry.audioVideoActivities);

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      Item: entry,
    }).promise();
    console.log(`updated existing entry: userId=${userId} and guildId=${guildId}`);
  } catch(err: any)  {
    console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
    throw err;
  }
}

export async function startAudioVideoSession(
  userId: string,
  guildId: string,
  type: 'voiceChannel' | 'microphone' | 'video' | 'screencast'
): Promise<void> {
  const existingEntry = await getExistingEntry(userId, guildId);

  if (!existingEntry || existingEntry.Count === 0) {
    await addNewAudioVideoSession(
      userId,
      guildId,
      type,
    );
  } else {
    await updateExistingAudioVideoSession(
      userId,
      guildId,
      existingEntry,
      type,
    );
  }
}

export async function endAudioVideoSession(
  userId: string,
  guildId: string,
  type: 'voiceChannel' | 'microphone' | 'video' | 'screencast'
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const existingEntry = await getExistingEntry(userId, guildId);

  if (existingEntry) {
    const entry = existingEntry.Items![0] as UserGuildActivityEntry;

    if (type === 'voiceChannel') {
      entry.audioVideoActivities.totalTimeInVoiceChannel += Math.round((Date.now() - entry.audioVideoActivities.joinedVoiceChannelAt) / (ONE_S_IN_MS * ONE_MINUTE_IN_S));
    } else if (type === 'microphone') {
      entry.audioVideoActivities.totalTimeWithMicrophone += Math.round((Date.now() - entry.audioVideoActivities.enabledMicrophoneAt) / (ONE_S_IN_MS * ONE_MINUTE_IN_S));
    } else if (type === 'video') {
      entry.audioVideoActivities.totalTimeWithVideo += Math.round((Date.now() - entry.audioVideoActivities.enabledVideoAt) / (ONE_S_IN_MS * ONE_MINUTE_IN_S));
    } else if (type === 'screencast') {
      entry.audioVideoActivities.totalTimeWithScreencast = Math.round((Date.now() - entry.audioVideoActivities.enabledScreencastAt) / (ONE_S_IN_MS * ONE_MINUTE_IN_S));
    }
    entry.updatedAt = Date.now();

    entry.activityScore = calculateActivityScore(
      entry.messageCount,
      entry.replyCount,
      entry.replyCount,
      entry.mentionedCount,
      entry.frequencyCounts,
      entry.messageLengthCounts,
    ) + calculateAudioVideoScore(entry.audioVideoActivities);

    try {
      await dynamoDbSingleton.put({
        TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
        Item: entry,
      }).promise();
      console.log(`updated existing entry: userId=${userId} and guildId=${guildId}`);
    } catch(err: any)  {
      console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
      throw err;
    }
  }
}

export async function getExistingEntry (userId: string, guildId: string): Promise<AWS.DynamoDB.DocumentClient.ScanOutput> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  try {
    return dynamoDbSingleton.scan({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
      FilterExpression: 'userId = :userId and guildId = :guildId',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':guildId': guildId
      }
    }).promise();
  } catch(err: any) {
    console.error(`error while scanning for userId ${userId} and guildId ${guildId} in table ${process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME}`, err);
    throw err;
  }
}

export function calculateActivityScore (
  messageCount: number,
  replyCount: number,
  reactionCount: number,
  mentionedCount: number,
  frequencyCounts: FrequencyCounts,
  messageLengthCounts: MessageLengthCounts,
) {
  if (!messageCount) {
    messageCount = 0;
  }
  if (!replyCount) {
    replyCount = 0;
  }
  if (!reactionCount) {
    reactionCount = 0;
  }
  if (!mentionedCount) {
    mentionedCount = 0;
  }
  if (!frequencyCounts) {
    frequencyCounts = {
      veryHigh: 0,
      high: 0,
      middle: 0,
      low: 0,
    }
  }
  if (!messageLengthCounts) {
    messageLengthCounts = {
      veryShort: 0,
      short: 0,
      middle: 0,
      long: 0,
    }
  }
  return Math.round(
    messageCount * 3 +
    replyCount * 2 +
    reactionCount +
    mentionedCount * 0.5 +
    frequencyCounts.veryHigh +
    frequencyCounts.high * 0.5 +
    frequencyCounts.middle * 0.2 +
    frequencyCounts.low * 0.05 +
    messageLengthCounts.veryShort * 0.05 +
    messageLengthCounts.short * 0.2 +
    messageLengthCounts.middle * 0.5 +
    messageLengthCounts.long
  );
}

export function calculateAudioVideoScore(audioVideoActivities: AudioVideoActivities) {
  if (!audioVideoActivities) {
    return 0;
  }
  return Math.round(
    audioVideoActivities.totalTimeWithScreencast * 3 +
    audioVideoActivities.totalTimeWithVideo * 2 +
    audioVideoActivities.totalTimeWithMicrophone +
    audioVideoActivities.totalTimeInVoiceChannel * 0.25
  );
}

export function activityScoreSort(a: UserGuildActivityEntry, b: UserGuildActivityEntry): number {
  return a.activityScore > b.activityScore ? -1 : 1;
}

export function getFrequencyCountType(lastUpdate: number|undefined): keyof FrequencyCounts {
  // in case the entry has no updatedAt yet
  if (!lastUpdate) {
    return "veryHigh";
  }

  const timeSpan = Date.now() - lastUpdate;

  if (timeSpan < 12 * ONE_HOUR_IN_S) {
    return "veryHigh";
  } else if (timeSpan < 24 * ONE_HOUR_IN_S) {
    return "high";
  } else if (timeSpan < 48 * ONE_HOUR_IN_S) {
    return "middle"
  } else {
    return "low";
  }
}

export function getMessageLengthType (messageLength: number): keyof MessageLengthCounts {
  if (messageLength < 50) {
    return "veryShort";
  } else if (messageLength < 150) {
    return "short";
  } else if (messageLength < 300) {
    return "middle"
  } else {
    return "long";
  }
}