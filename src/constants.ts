// Roles
export const OWNER_ROLE = 'Owner';
export const DATA_AUDITORS_ROLE = 'Data Auditors';
export const GAMER_PASSPORT_ROLE = 'Gamer Passport';
export const ADMIN_ROLES = [OWNER_ROLE, DATA_AUDITORS_ROLE];

// Commands
export const EXCLUDE_GAMER_COMMAND = 'exclude-gamer';
export const INCLUDE_GAMER_COMMAND = 'include-gamer';
export const VIEW_EXCLUDED_GAMERS_COMMAND = 'view-excluded-gamers';
export const EXCLUDE_CHANNEL_COMMAND = 'exclude-channel';
export const INCLUDE_CHANNEL_COMMAND = 'include-channel';
export const VIEW_EXCLUDED_CHANNELS_COMMAND = 'view-excluded-channels';
export const TOGGLE_ADAPTER_STATUS_COMMAND = 'toggle-adapter-status';
export const VIEW_ADAPTER_STATUS_COMMAND = 'view-adapter-status';
export const REGISTER_FOR_GAMER_PASSPORT_COMMAND = 'register-for-gamer-passport';
export const MY_PORTAL_COMMAND = 'my-portal';
export const CONNECT_ELROND_WALLET_COMMAND = 'connect-elrond-wallet';

// Role commands
export const ADMIN_COMMANDS = [
  EXCLUDE_GAMER_COMMAND, INCLUDE_GAMER_COMMAND, VIEW_EXCLUDED_GAMERS_COMMAND, EXCLUDE_CHANNEL_COMMAND,
  INCLUDE_CHANNEL_COMMAND, VIEW_EXCLUDED_CHANNELS_COMMAND, TOGGLE_ADAPTER_STATUS_COMMAND, VIEW_ADAPTER_STATUS_COMMAND
];
export const GAMER_PASSPORT_COMMANDS = [
  REGISTER_FOR_GAMER_PASSPORT_COMMAND, MY_PORTAL_COMMAND, CONNECT_ELROND_WALLET_COMMAND
];