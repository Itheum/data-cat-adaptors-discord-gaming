// Roles
export const GAMER_PASSPORT_PLAYER_ROLE = 'Gamer Passport Gamer';
export const GAMER_PASSPORT_ADMIN_ROLE = 'Gamer Passport Admin';

// Commands
export const EXCLUDE_GAMER_COMMAND = 'exclude-gamer';
export const INCLUDE_GAMER_COMMAND = 'include-gamer';
export const VIEW_EXCLUDED_GAMERS_COMMAND = 'view-excluded-gamers';
export const EXCLUDE_CHANNEL_COMMAND = 'exclude-channel';
export const INCLUDE_CHANNEL_COMMAND = 'include-channel';
export const VIEW_EXCLUDED_CHANNELS_COMMAND = 'view-excluded-channels';
export const TOGGLE_ADAPTER_STATUS_COMMAND = 'toggle-adapter-status';
export const VIEW_ADAPTER_STATUS_COMMAND = 'view-adapter-status';
export const SET_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND = 'set-register-for-gamer-pp-link';
export const SET_MY_PORTAL_LINK_COMMAND = 'set-my-portal-link';
export const SET_CONNECT_ELROND_WALLET_LINK_COMMAND = 'set-connect-elrond-wallet-link';
export const VIEW_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND = 'view-register-for-gamer-pp-link';
export const VIEW_MY_PORTAL_LINK_COMMAND = 'view-my-portal-link';
export const VIEW_CONNECT_ELROND_WALLET_LINK_COMMAND = 'view-connect-elrond-wallet-link';
export const REGISTER_FOR_GAMER_PASSPORT_COMMAND = 'register-for-gamer-passport';
export const MY_PORTAL_COMMAND = 'my-portal';
export const CONNECT_ELROND_WALLET_COMMAND = 'connect-elrond-wallet';

// Role commands
export const ADMIN_COMMANDS = [
  EXCLUDE_GAMER_COMMAND, INCLUDE_GAMER_COMMAND, VIEW_EXCLUDED_GAMERS_COMMAND, EXCLUDE_CHANNEL_COMMAND,
  INCLUDE_CHANNEL_COMMAND, VIEW_EXCLUDED_CHANNELS_COMMAND, TOGGLE_ADAPTER_STATUS_COMMAND, VIEW_ADAPTER_STATUS_COMMAND,
  SET_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND, SET_MY_PORTAL_LINK_COMMAND, SET_CONNECT_ELROND_WALLET_LINK_COMMAND,
  VIEW_REGISTER_FOR_GAMER_PASSPORT_LINK_COMMAND, VIEW_MY_PORTAL_LINK_COMMAND, VIEW_CONNECT_ELROND_WALLET_LINK_COMMAND,
];
export const GAMER_PASSPORT_COMMANDS = [
  REGISTER_FOR_GAMER_PASSPORT_COMMAND, MY_PORTAL_COMMAND, CONNECT_ELROND_WALLET_COMMAND
];