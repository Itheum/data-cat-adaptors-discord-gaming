import {
  calculateActivityScore,
  calculateAudioVideoScore,
  getDynamoDbSingleton
} from "../aws-dynamodb-connector";
import { UserGuildActivityEntry } from "../dynamodb-interfaces";
import dotenv from "dotenv";

dotenv.config();

(async ()=>{
  const dynamoDbSingleton = getDynamoDbSingleton();

  let existingEntry;

  try {
    existingEntry = await dynamoDbSingleton.scan({
      TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
    }).promise();
  } catch(err: any) {
    console.error(`error while scanning all entries in table ${process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME}`, err);
    throw err;
  }

  let updateCount = 0;

  for (const entry of existingEntry.Items as UserGuildActivityEntry[]) {
    entry.activityScore = calculateActivityScore(
      entry.messageCount,
      entry.replyCount,
      entry.reactionCount,
      entry.mentionedCount,
      entry.frequencyCounts,
      entry.messageLengthCounts,
    ) + calculateAudioVideoScore(entry.audioVideoActivities);

    entry.version = process.env.npm_package_version!;

    try {
      await dynamoDbSingleton.put({
        TableName: process.env.AWS_DYNAMODB_USER_ACTIVITIES_TABLE_NAME!,
        Item: entry,
      }).promise();
      console.log(`updated existing entry: userId=${entry.userId} and guildId=${entry.guildId}`);
      updateCount++;
    } catch(err: any)  {
      console.error(`error while saving new user activity for userId ${entry.userId} and guildId ${entry.guildId}`, err);
      throw err;
    }
  }

  console.log(`${(existingEntry.Items as UserGuildActivityEntry[]).length} rows to update`);
  console.log(`${updateCount} rows updated`);
})();

