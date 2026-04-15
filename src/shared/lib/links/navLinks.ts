import type { Language } from '../../i18n/translations';

export interface NavLinkItem {
  href: string;
  label: string;
}

export interface NavLinkGroup {
  category: string;
  href: string;
  links: NavLinkItem[];
}

const navLinksByLanguage: Record<Language, NavLinkGroup[]> = {
  es: [
    {
      category: 'Conversores',
      href: '/converters',
      links: [
        {
          href: '/converters/base-converter',
          label: 'Conversor de bases numéricas',
        },
        { href: '/converters/ascii-converter', label: 'Conversor ASCII' },
      ],
    },
    {
      category: 'Calculadoras',
      href: '/calculators',
      links: [
        {
          href: '/calculators/base-calculator',
          label: 'Calculadora de bases numéricas',
        },
        {
          href: '/calculators/Ipv4Calculator',
          label: 'Calculadora de IPv4',
        },
        { href: '/calculators/ipv6-calculator', label: 'Calculadora de IPv6' },
        {
          href: '/calculators/tcp-checksum',
          label: 'Suma de comprobación TCP',
        },
        {
          href: '/calculators/ip-fragmentation',
          label: 'Fragmentación de datagramas IP',
        },
      ],
    },
    {
      category: 'TCP/IP',
      href: '/tcp-ip',
      links: [
        { href: '/tcp-ip/AppLayer', label: 'Capa de aplicación' },
        { href: '/tcp-ip/TransportLayer', label: 'Capa de transporte' },
        { href: '/tcp-ip/NetworkLayer', label: 'Capa de red' },
        { href: '/tcp-ip/DataLinkLayer', label: 'Capa de enlace de datos' },
        { href: '/tcp-ip/PhysicalLayer', label: 'Capa física' },
      ],
    },
    {
      category: 'Crea un Protocolo',
      href: '/protocol-creator',
      links: [],
    },
    {
      category: 'Mis Protocolos',
      href: '/my-protocols',
      links: [],
    },
    {
      category: 'Mensajes',
      href: '/messages',
      links: [],
    },
  ],
  en: [
    {
      category: 'Converters',
      href: '/converters',
      links: [
        { href: '/converters/base-converter', label: 'Number base converter' },
        { href: '/converters/ascii-converter', label: 'ASCII converter' },
      ],
    },
    {
      category: 'Calculators',
      href: '/calculators',
      links: [
        {
          href: '/calculators/base-calculator',
          label: 'Number base calculator',
        },
        { href: '/calculators/Ipv4Calculator', label: 'IPv4 calculator' },
        { href: '/calculators/ipv6-calculator', label: 'IPv6 calculator' },
        { href: '/calculators/tcp-checksum', label: 'TCP checksum' },
        {
          href: '/calculators/ip-fragmentation',
          label: 'IP datagram fragmentation',
        },
      ],
    },
    {
      category: 'TCP/IP',
      href: '/tcp-ip',
      links: [
        { href: '/tcp-ip/AppLayer', label: 'Application layer' },
        { href: '/tcp-ip/TransportLayer', label: 'Transport layer' },
        { href: '/tcp-ip/NetworkLayer', label: 'Network layer' },
        { href: '/tcp-ip/DataLinkLayer', label: 'Data link layer' },
        { href: '/tcp-ip/PhysicalLayer', label: 'Physical layer' },
      ],
    },
    {
      category: 'Create a Protocol',
      href: '/protocol-creator',
      links: [],
    },
    {
      category: 'My Protocols',
      href: '/my-protocols',
      links: [],
    },
    {
      category: 'Messages',
      href: '/messages',
      links: [],
    },
  ],
};

export function getNavLinks(lang: Language): NavLinkGroup[] {
  return navLinksByLanguage[lang];
}
