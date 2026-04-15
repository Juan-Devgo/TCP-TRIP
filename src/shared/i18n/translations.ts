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
      protocolBuilder: {
        title: 'Constructor de Protocolos',
        description:
          'Diseña encabezados de protocolo de red de forma visual. Define campos, tipos de datos y obtén una visualización estilo RFC en tiempo real.',
      },
      tags: {
        application: 'Aplicación',
        transport: 'Transporte',
        network: 'Red',
        subnets: 'Subredes',
        header: 'Encabezado',
        rfc: 'RFC',
        visual: 'Visual',
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
        'Conceptos complejos de redes explicados de forma gráfica e interactiva, pensados para el aula universitaria',
      practicalTools: 'Herramientas Prácticas',
      practicalToolsDesc:
        'Calculadoras y conversores que docentes y estudiantes usan en clase y en ejercicios evaluativos',
      forStudents: 'Para Estudiantes y Docentes',
      forStudentsDesc:
        'Diseñado para cursos de redes universitarios: el estudiante practica y el docente enseña con las mismas herramientas',
      protocolBuilder: 'Constructor de Protocolos',
      protocolBuilderDesc:
        'Construye encabezados de protocolo campo por campo y obtén un diagrama estilo RFC al instante, sin código ni software externo',
    },
    // Landing Page - CTA
    cta: {
      title: '¿Listo para comenzar tu viaje?',
      subtitle:
        'Explora el modelo TCP/IP, calcula subredes y construye tus propios protocolos con TCP-TRIP',
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
    // ASCII Converter
    ascii: {
      title: 'Conversor Texto ↔ ASCII',
      subtitle:
        'Convierte texto a ASCII y ASCII a texto con cambio rápido de base',
      baseLabel: 'Base ASCII:',
      swap: 'Intercambiar',
      clear: 'Limpiar',
      examples: 'Ejemplos',
      textLabel: 'Texto',
      asciiLabel: 'Valores ASCII',
      characters: 'Caracteres',
      upload: 'Subir .txt',
      download: 'Descargar .txt',
      textPlaceholder: 'Escribe texto aquí...',
      asciiPlaceholder: 'Ejemplo: 97 110 105 116 97',
      autoGroup: 'Auto',
      manualMode: 'Manual',
      manualModeHint:
        'Modo manual: separa los valores con espacios. Ej: 72 101 108 108 111',
    },
    // Subnet Calculator
    subnet: {
      title: 'Calculadora IPv4',
      subtitle:
        'Calcula información de subred basada en dirección IP y máscara de subred.',
      ipAddress: 'Dirección IP',
      ipPlaceholder: 'ej., 192.168.1.0',
      mask: 'Máscara de red',
      maskPlaceholder: 'ej., 24',
      submask: 'Máscara de subred',
      submaskPlaceholder: 'ej., 2',
      enableSubnets: 'Subredes',
      // Results table
      results: 'Resultados',
      ipAddressLabel: 'Dirección IP',
      networkAddressLabel: 'Dirección de Red',
      classLabel: 'Clase',
      netMaskLabel: 'Máscara de Red',
      subMaskLabel: 'Submáscara de Subred',
      fullMaskLabel: 'Máscara Completa',
      wildcardMaskLabel: 'Máscara Wildcard',
      broadcastAddressLabel: 'Dirección de Broadcast',
      firstHostLabel: 'Primer Host',
      lastHostLabel: 'Último Host',
      totalHostsLabel: 'Hosts Totales',
      inAddrArpaLabel: 'in-addr.arpa',
      ipv6MappedLabel: 'IPv6 Mapeado',
      ipRangeLabel: 'Rango de IPs disponibles',
      showDetails: 'Mostrar detalles',
      // Subnets
      subnetsTitle: 'Subredes',
      subnetLabel: 'Subred',
      usable: 'Utilizable',
      unusable: 'Inutilizable',
      noData: 'Ingresa datos válidos para ver los resultados',
      // Subnet unusable reasons
      firstSubnetReason:
        'La dirección de subred se confunde con la dirección de red',
      lastSubnetReason:
        'El broadcast de subred se confunde con el broadcast de red',
      // Host validation
      invalidHostRange:
        'El primer host no puede ser mayor o igual al último host. La máscara es demasiado grande para esta red.',
      // Error messages
      errInvalidIp:
        'Dirección IP inválida (formato: X.X.X.X, cada octeto entre 0-255)',
      errInvalidMask: 'Máscara inválida (debe ser un número entre 0 y 32)',
      errInvalidSubmask:
        'Submáscara inválida (debe ser un número entre 1 y {max})',
      examplesBtn: 'Ejemplos',
      clearBtn: 'Limpiar',
    },
    // Footer
    footer: {
      description:
        'Plataforma educativa para estudiantes y docentes de redes. Aprende protocolos TCP/IP de forma visual, práctica y sin barreras.',
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
      protocolBuilder: {
        title: 'Protocol Builder',
        description:
          'Design network protocol headers visually. Define fields, data types, and get an RFC-style visualization in real time.',
      },
      tags: {
        application: 'Application',
        transport: 'Transport',
        network: 'Network',
        subnets: 'Subnets',
        header: 'Header',
        rfc: 'RFC',
        visual: 'Visual',
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
        'Complex networking concepts explained graphically and interactively, built for the university classroom',
      practicalTools: 'Practical Tools',
      practicalToolsDesc:
        'Calculators and converters that students and teachers use in class and evaluations',
      forStudents: 'For Students & Teachers',
      forStudentsDesc:
        'Designed for university networking courses: students practice and teachers teach with the same tools',
      protocolBuilder: 'Protocol Builder',
      protocolBuilderDesc:
        'Build protocol headers field by field and get an RFC-style diagram instantly, no code or external software needed',
    },
    // Landing Page - CTA
    cta: {
      title: 'Ready to start your journey?',
      subtitle:
        'Explore the TCP/IP model, calculate subnets, and build your own protocols with TCP-TRIP',
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
    // ASCII Converter
    ascii: {
      title: 'Text ↔ ASCII Converter',
      subtitle: 'Convert text to ASCII and ASCII to text with fast base switch',
      baseLabel: 'ASCII base:',
      swap: 'Swap',
      clear: 'Clear',
      examples: 'Examples',
      textLabel: 'Text',
      asciiLabel: 'ASCII values',
      characters: 'Characters',
      upload: 'Upload .txt',
      download: 'Download .txt',
      textPlaceholder: 'Write text here...',
      asciiPlaceholder: 'Example: 97 110 105 116 97',
      autoGroup: 'Auto',
      manualMode: 'Manual',
      manualModeHint:
        'Manual mode: separate values with spaces. E.g: 72 101 108 108 111',
    },
    // Subnet Calculator
    subnet: {
      title: 'IPv4 Calculator',
      subtitle:
        'Calculate subnet information based on IP address and subnet mask.',
      ipAddress: 'IP Address',
      ipPlaceholder: 'e.g., 192.168.1.0',
      mask: 'Mask',
      maskPlaceholder: 'e.g., 24',
      submask: 'Subnet',
      submaskPlaceholder: 'e.g., 2',
      enableSubnets: 'Subnets',
      // Results table
      results: 'Results',
      ipAddressLabel: 'IP Address',
      networkAddressLabel: 'Network Address',
      classLabel: 'Class',
      netMaskLabel: 'Net Mask',
      subMaskLabel: 'Subnet Mask',
      fullMaskLabel: 'Full Mask',
      wildcardMaskLabel: 'Wildcard Mask',
      broadcastAddressLabel: 'Broadcast Address',
      firstHostLabel: 'First Host',
      lastHostLabel: 'Last Host',
      totalHostsLabel: 'Total Hosts',
      inAddrArpaLabel: 'in-addr.arpa',
      ipv6MappedLabel: 'IPv6 Mapped',
      ipRangeLabel: 'Available IP Range',
      showDetails: 'Show details',
      // Subnets
      subnetsTitle: 'Subnets',
      subnetLabel: 'Subnet',
      usable: 'Usable',
      unusable: 'Unusable',
      noData: 'Enter valid data to see the results',
      // Subnet unusable reasons
      firstSubnetReason: 'Subnet address conflicts with the network address',
      lastSubnetReason: 'Subnet broadcast conflicts with the network broadcast',
      // Host validation
      invalidHostRange:
        'First host cannot be greater than or equal to last host. The mask is too large for this network.',
      // Error messages
      errInvalidIp:
        'Invalid IP address (format: X.X.X.X, each octet between 0-255)',
      errInvalidMask: 'Invalid mask (must be a number between 0 and 32)',
      errInvalidSubmask:
        'Invalid submask (must be a number between 1 and {max})',
      examplesBtn: 'Examples',
      clearBtn: 'Clear',
    },
    // Footer
    footer: {
      description:
        'Educational platform for networking students and teachers. Learn TCP/IP protocols visually and practically.',
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
