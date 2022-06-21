export interface UserGuildActivityEntry {
  userId: string;
  guildId: string;
  messageCount: number;
  replyCount: number; // user mentions/replies to other user (actively)
  reactionCount: number;
  mentionedCount: number; // user got mentioned/replied to by some other user (passively)
  frequencyCounts: FrequencyCounts; // how many times a user showed up: very often - rarely
  messageLengthCounts: MessageLengthCounts; // lengths of user messages: very short - long
  audioVideoActivities: AudioVideoActivities;
  activityScore: number;
  updatedAt: number;
  version: string;
}

export interface FrequencyCounts {
  veryHigh: number,
  high: number,
  middle: number,
  low: number,
}

export interface MessageLengthCounts {
  veryShort: number,
  short: number,
  middle: number,
  long: number,
}

export interface AudioVideoActivities {
  joinedVoiceChannelAt: number;
  enabledMicrophoneAt: number;
  enabledVideoAt: number;
  enabledScreencastAt: number;
  totalTimeInVoiceChannel: number; // in minutes
  totalTimeWithMicrophone: number; // in minutes
  totalTimeWithVideo: number; // in minutes
  totalTimeWithScreencast: number; // in minutes
}

export interface ExcludedUserGuildEntry {
  id: string;
  userId: string;
  guildId: string;
  date: string;
}