export interface AvatarOption {
  id: string;
  name: string;
  icon?: string; // For Carbon icon-based avatars
  color: string; // Carbon color token
  description: string;
  isInitials?: boolean; // Special flag for initials option
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'avatar-blue',
    name: 'Blue',
    icon: 'user--avatar',
    color: '#4589ff', // Carbon blue-60
    description: 'Blue avatar'
  },
  {
    id: 'avatar-teal',
    name: 'Teal',
    icon: 'user--avatar',
    color: '#009d9a', // Carbon teal-60
    description: 'Teal avatar'
  },
  {
    id: 'avatar-purple',
    name: 'Purple',
    icon: 'user--avatar',
    color: '#8a3ffc', // Carbon purple-60
    description: 'Purple avatar'
  },
  {
    id: 'avatar-magenta',
    name: 'Magenta',
    icon: 'user--avatar',
    color: '#ee5396', // Carbon magenta-60
    description: 'Magenta avatar'
  },
  {
    id: 'avatar-initials',
    name: 'Initials',
    color: '#6f6f6f', // Carbon gray-60
    description: 'Your initials',
    isInitials: true
  }
];

export function getAvatarById(id: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find(avatar => avatar.id === id);
}
