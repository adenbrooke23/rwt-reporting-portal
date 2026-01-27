export interface AvatarOption {
  id: string;
  name: string;
  icon?: string;
  color: string;
  description: string;
  isInitials?: boolean;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'avatar-blue',
    name: 'Blue',
    icon: 'user--avatar',
    color: '#4589ff',
    description: 'Blue avatar'
  },
  {
    id: 'avatar-teal',
    name: 'Teal',
    icon: 'user--avatar',
    color: '#009d9a',
    description: 'Teal avatar'
  },
  {
    id: 'avatar-purple',
    name: 'Purple',
    icon: 'user--avatar',
    color: '#8a3ffc',
    description: 'Purple avatar'
  },
  {
    id: 'avatar-magenta',
    name: 'Magenta',
    icon: 'user--avatar',
    color: '#ee5396',
    description: 'Magenta avatar'
  },
  {
    id: 'avatar-initials',
    name: 'Initials',
    color: '#6f6f6f',
    description: 'Your initials',
    isInitials: true
  }
];

export function getAvatarById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find(avatar => avatar.id === id);
}
