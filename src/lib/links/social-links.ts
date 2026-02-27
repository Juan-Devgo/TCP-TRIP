export type SocialIcon = 'github' | 'twitter' | 'discord';

export interface SocialLink {
  href: string;
  label: string;
  icon: SocialIcon;
}

export const socialLinks: SocialLink[] = [
  {
    href: 'https://github.com/Juan-Devgo/TCP-TRIP',
    label: 'GitHub',
    icon: 'github',
  },
  { href: 'https://twitter.com/tcptrip', label: 'Twitter', icon: 'twitter' },
  { href: 'https://discord.gg/tcptrip', label: 'Discord', icon: 'discord' },
];
