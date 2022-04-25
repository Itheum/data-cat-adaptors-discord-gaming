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

export async function incrementUserGuildActivities(
  userId: string,
  guildId: string,
  messageIncrement = 0,
  replyIncrement = 0,
  reactionIncrement = 0,
): Promise<void> {
  const dynamoDbSingleton = getDynamoDbSingleton();

  const existingEntry = await dynamoDbSingleton.scan({
    TableName: process.env.AWS_DYNAMODB_TABLE_NAME!,
    FilterExpression: 'userId = :userId and guildId = :guildId',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':guildId': guildId
    }
  }).promise()
    .catch((err: any) => {
      console.error(`error while scanning for userId ${userId} and guildId ${guildId}`, err);
      throw err;
    });

  if (!existingEntry || existingEntry.Count === 0) {
    // add new
    try {
      await dynamoDbSingleton.put({
        TableName: process.env.AWS_DYNAMODB_TABLE_NAME!,
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
        TableName: process.env.AWS_DYNAMODB_TABLE_NAME!,
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
  return messageCount * 3 + reactionCount * 2 + reactionCount;
};

export interface UserGuildActivityEntry {
  id: string;
  userId: string;
  guildId: string;
  messageCount: number;
  replyCount: number;
  reactionCount: number;
  activityScore: number;
}