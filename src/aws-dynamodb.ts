import AWS from "aws-sdk";
import { v4 } from 'uuid';

let dynamoDb: AWS.DynamoDB.DocumentClient | null = null;

function getDynamoDbSingleton(): AWS.DynamoDB.DocumentClient {
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

  const existingEntry = await dynamoDbSingleton.scan({
    TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
  }).promise()
    .catch((err: any) => {
      console.error(`error while scanning all entries for guildId ${guildId} in table ${process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME}`, err);
      throw err;
    });

  if (existingEntry && existingEntry.Items) {
    return existingEntry.Items as ExcludedUserGuildEntry[];
  }
  return [];
}

export async function getExcludedUserGuild(userId: string, guildId: string): Promise<ExcludedUserGuildEntry> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const existingEntry = await dynamoDbSingleton.scan({
    TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
    FilterExpression: 'userId = :userId and guildId = :guildId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':guildId': guildId
    }
  }).promise()
    .catch((err: any) => {
      console.error(`error while scanning for userId ${userId} and guildId ${guildId} in table ${process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME}`, err);
      throw err;
    });

  if (existingEntry && existingEntry.Count && existingEntry.Items && existingEntry.Count === 1 ) {
    return existingEntry.Items[0] as ExcludedUserGuildEntry;
  }
  throw new Error(`no entry found for userId ${userId} and guildId ${guildId}`);
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

  try {
    await dynamoDbSingleton.put({
      TableName: process.env.AWS_DYNAMODB_EXCLUDED_USER_TABLE_NAME!,
      Item: {
        id: v4(),
        userId,
        guildId,
        date: new Date().toISOString(),
      } as ExcludedUserGuildEntry,
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

  // todo improve: sort and limit by DB query, not by code
  const existingEntries = await dynamoDbSingleton.scan({
    TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
    FilterExpression: 'guildId = :guildId',
    ExpressionAttributeValues: {
      ':guildId': guildId
    },
  }).promise()
    .catch((err: any) => {
      console.error(`error while scanning for most ${n} active users`, err);
      throw err;
    });

  if (existingEntries && existingEntries.Items) {
    return (existingEntries.Items as UserGuildActivityEntry[]).sort(activityScoreSort).slice(0, n);
  }
  return [];
}

export async function incrementUserGuildActivities(
  userId: string,
  guildId: string,
  messageIncrement = 0,
  replyIncrement = 0,
  reactionIncrement = 0,
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const existingEntry = await dynamoDbSingleton.scan({
    TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
    FilterExpression: 'userId = :userId and guildId = :guildId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':guildId': guildId
    }
  }).promise()
    .catch((err: any) => {
      console.error(`error while scanning for userId ${userId} and guildId ${guildId} in table ${process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME}`, err);
      throw err;
    });

  if (!existingEntry || existingEntry.Count === 0) {
    // add new
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
          activityScore: calculateActivityScore(messageIncrement, replyIncrement, reactionIncrement),
        } as UserGuildActivityEntry,
      }).promise();
      console.log(`inserted new entry: userId=${userId} and guildId=${guildId}`);
    } catch(err: any) {
      console.error(`error while saving new user activity for userId ${userId} and guildId ${guildId}`, err);
      throw err;
    }
  } else {
    // update existing
    const entry = existingEntry.Items![0] as UserGuildActivityEntry;

    entry.messageCount += messageIncrement;
    entry.replyCount += replyIncrement;
    entry.reactionCount += reactionIncrement;
    entry.activityScore = calculateActivityScore(entry.messageCount, entry.replyCount, entry.reactionCount);

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

const calculateActivityScore = (messageCount: number, replyCount: number, reactionCount: number) => {
  return messageCount * 3 + replyCount * 2 + reactionCount;
};

const activityScoreSort = (a: UserGuildActivityEntry, b: UserGuildActivityEntry): number => {
  return a.activityScore > b.activityScore ? -1 : 1;
}

export interface UserGuildActivityEntry {
  id: string;
  userId: string;
  guildId: string;
  messageCount: number;
  replyCount: number;
  reactionCount: number;
  activityScore: number;
}

export interface ExcludedUserGuildEntry {
  id: string;
  userId: string;
  guildId: string;
  date: string;
}