export const languages = {
  es: 'Español',
  en: 'English',
} as const;

export type Language = keyof typeof languages;

export const defaultLang: Language = 'es';

export const translations = {
  es: {
    // Navbar
    nav: {
      baseConverter: 'Conversor de Bases',
      tcpIpTools: 'Herramientas TCP/IP',
      subnetCalculator: 'Calculadora de Subredes',
    },
    // Landing Page - Hero
    hero: {
      tagline: 'Tu viaje interactivo al mundo de los',
      networkProtocols: 'protocolos de red',
      learnTcpIp: 'Aprende',
      visualPractical: 'de forma visual y práctica.',
      startJourney: 'Comenzar el viaje',
      viewOnGithub: 'Ver en GitHub',
    },
    // Landing Page - Features
    features: {
      title: 'Herramientas Interactivas',
      subtitle:
        'Explora nuestras herramientas diseñadas para facilitar el aprendizaje de redes',
      baseConverter: {
        title: 'Conversor de Bases',
        description:
          'Convierte números entre binario, octal, decimal y hexadecimal. Perfecto para entender direcciones IP y máscaras de subred.',
      },
      tcpIpModel: {
        title: 'Modelo TCP/IP',
        description:
          'Explora las capas del modelo TCP/IP de forma interactiva. Aprende sobre HTTP, DNS, DHCP, SSH y más protocolos.',
      },
      subnetCalculator: {
        title: 'Calculadora de Subredes',
        description:
          'Calcula subredes, máscaras y rangos de direcciones IP. Herramienta esencial para diseño de redes.',
      },
      tags: {
        application: 'Aplicación',
        transport: 'Transporte',
        network: 'Red',
        subnets: 'Subredes',
      },
    },
    // Landing Page - TCP/IP Layers
    layers: {
      title: 'Modelo TCP/IP',
      subtitle:
        'Comprende cómo los datos viajan a través de las diferentes capas de red',
      application: {
        name: 'Capa de Aplicación',
        protocols: 'HTTP, HTTPS, DNS, DHCP, SSH, FTP, SMTP',
      },
      transport: {
        name: 'Capa de Transporte',
        protocols: 'TCP, UDP - Control de flujo y puertos',
      },
      network: {
        name: 'Capa de Red',
        protocols: 'IP - Direccionamiento y enrutamiento',
      },
      dataLink: {
        name: 'Capa de Acceso a Red',
        protocols: 'MAC - Enlace físico',
      },
      physical: {
        name: 'Capa Física',
        protocols: 'Ethernet, Wi-Fi - Medios físicos y transmisión de bits',
      },
    },
    // Landing Page - Why TCP-TRIP
    whyTcpTrip: {
      title: '¿Por qué',
      visualLearning: 'Aprendizaje Visual',
      visualLearningDesc:
        'Conceptos complejos explicados de forma gráfica e interactiva',
      practicalTools: 'Herramientas Prácticas',
      practicalToolsDesc:
        'Calculadoras y conversores para trabajo real con redes',
      forStudents: 'Para Estudiantes',
      forStudentsDesc:
        'Diseñado especialmente para estudiantes de ingeniería y sistemas',
      openSource: 'Open Source',
      openSourceDesc: 'Código abierto y gratuito para toda la comunidad',
    },
    // Landing Page - CTA
    cta: {
      title: '¿Listo para comenzar tu viaje?',
      subtitle:
        'Explora el fascinante mundo de los protocolos de red con TCP-TRIP',
      button: 'Explorar ahora',
    },
    // Number Base Converter
    converter: {
      title: 'Conversor de Bases Numéricas',
      subtitle: 'Convierte entre binario, octal, decimal y hexadecimal',
      from: 'De:',
      to: 'A:',
      lengthError: 'La longitud no puede ser mayor a',
    },
    // Subnet Calculator
    subnet: {
      title: 'Calculadora de Subredes',
      subtitle:
        'Calcula información de subred basada en dirección IP y máscara de subred.',
      ipAddress: 'Dirección IP',
      ipPlaceholder: 'ej., 192.168.1.1',
      subnetMask: 'Máscara de Subred',
      maskPlaceholder: 'ej., 255.255.255.0',
      calculate: 'Calcular Subred',
    },
    // Footer
    footer: {
      description:
        'Herramientas de red para desarrolladores y profesionales de TI. Rápidas, confiables y fáciles de usar.',
      tools: 'Herramientas',
      resources: 'Recursos',
      documentation: 'Documentación',
      apiReference: 'Referencia API',
      examples: 'Ejemplos',
      connect: 'Conectar',
      copyleft: 'TCP TRIP copyleft.',
      privacy: 'Política de Privacidad',
      terms: 'Términos de Servicio',
    },
    // TCP/IP Pages
    tcpIp: {
      title: 'TCP/IP',
      appLayer: 'Capa de Aplicación',
      transportLayer: 'Capa de Transporte',
      networkLayer: 'Capa de Red',
      dataLinkLayer: 'Capa de Enlace de Datos',
      physicalLayer: 'Capa Física',
    },
  },
  en: {
    // Navbar
    nav: {
      baseConverter: 'Base Converter',
      tcpIpTools: 'TCP/IP Tools',
      subnetCalculator: 'Subnet Calculator',
    },
    // Landing Page - Hero
    hero: {
      tagline: 'Your interactive journey into the world of',
      networkProtocols: 'network protocols',
      learnTcpIp: 'Learn',
      visualPractical: 'in a visual and practical way.',
      startJourney: 'Start the journey',
      viewOnGithub: 'View on GitHub',
    },
    // Landing Page - Features
    features: {
      title: 'Interactive Tools',
      subtitle: 'Explore our tools designed to facilitate network learning',
      baseConverter: {
        title: 'Base Converter',
        description:
          'Convert numbers between binary, octal, decimal, and hexadecimal. Perfect for understanding IP addresses and subnet masks.',
      },
      tcpIpModel: {
        title: 'TCP/IP Model',
        description:
          'Explore the TCP/IP model layers interactively. Learn about HTTP, DNS, DHCP, SSH, and more protocols.',
      },
      subnetCalculator: {
        title: 'Subnet Calculator',
        description:
          'Calculate subnets, masks, and IP address ranges. Essential tool for network design.',
      },
      tags: {
        application: 'Application',
        transport: 'Transport',
        network: 'Network',
        subnets: 'Subnets',
      },
    },
    // Landing Page - TCP/IP Layers
    layers: {
      title: 'TCP/IP Model',
      subtitle:
        'Understand how data travels through the different network layers',
      application: {
        name: 'Application Layer',
        protocols: 'HTTP, HTTPS, DNS, DHCP, SSH, FTP, SMTP',
      },
      transport: {
        name: 'Transport Layer',
        protocols: 'TCP, UDP - Flow control and ports',
      },
      network: {
        name: 'Network Layer',
        protocols: 'IP - Addressing and routing',
      },
      dataLink: {
        name: 'Network Access Layer',
        protocols: 'MAC - Physical link',
      },
      physical: {
        name: 'Physical Layer',
        protocols: 'Ethernet, Wi-Fi - Physical media and bit transmission',
      },
    },
    // Landing Page - Why TCP-TRIP
    whyTcpTrip: {
      title: 'Why',
      visualLearning: 'Visual Learning',
      visualLearningDesc:
        'Complex concepts explained graphically and interactively',
      practicalTools: 'Practical Tools',
      practicalToolsDesc: 'Calculators and converters for real network work',
      forStudents: 'For Students',
      forStudentsDesc:
        'Specially designed for engineering and systems students',
      openSource: 'Open Source',
      openSourceDesc: 'Free and open source for the entire community',
    },
    // Landing Page - CTA
    cta: {
      title: 'Ready to start your journey?',
      subtitle:
        'Explore the fascinating world of network protocols with TCP-TRIP',
      button: 'Explore now',
    },
    // Number Base Converter
    converter: {
      title: 'Number Base Converter',
      subtitle: 'Convert between binary, octal, decimal, and hexadecimal',
      from: 'From:',
      to: 'To:',
      lengthError: 'Length cannot be greater than',
    },
    // Subnet Calculator
    subnet: {
      title: 'Subnet Calculator',
      subtitle:
        'Calculate subnet information based on IP address and subnet mask.',
      ipAddress: 'IP Address',
      ipPlaceholder: 'e.g., 192.168.1.1',
      subnetMask: 'Subnet Mask',
      maskPlaceholder: 'e.g., 255.255.255.0',
      calculate: 'Calculate Subnet',
    },
    // Footer
    footer: {
      description:
        'Network tools for developers and IT professionals. Fast, reliable, and easy to use.',
      tools: 'Tools',
      resources: 'Resources',
      documentation: 'Documentation',
      apiReference: 'API Reference',
      examples: 'Examples',
      connect: 'Connect',
      copyleft: 'TCP TRIP copyleft.',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
    // TCP/IP Pages
    tcpIp: {
      title: 'TCP/IP',
      appLayer: 'Application Layer',
      transportLayer: 'Transport Layer',
      networkLayer: 'Network Layer',
      dataLinkLayer: 'Data Link Layer',
      physicalLayer: 'Physical Layer',
    },
  },
} as const;

export type TranslationKey = keyof typeof translations.es;
