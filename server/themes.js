// Theme profiles for the 20 investigation topics (+ the neutral "atlas" base theme).
// Each profile becomes a [data-theme="<slug>"] block of CSS custom properties
// (see scripts/build-themes.mjs) and also colors the protected SVG plates.

export const THEMES = [
  { slug: 'atlas', name: 'Atlas (neutral)', mode: 'dark', motif: 'stars',
    bg: '#14161d', surface: '#1d2029', surface2: '#262a36', text: '#ece8df', muted: '#a9a69f',
    accent: '#d6b26a', accent2: '#7fa7d9', onAccent: '#1a1408', border: '#363a48',
    display: "'Cinzel', serif", body: "'Lora', serif" },

  { slug: 'mali-empire', name: 'Mali Empire', mode: 'dark', motif: 'sun',
    bg: '#1f140b', surface: '#2c1d10', surface2: '#3a2716', text: '#f3e6cc', muted: '#c4b08e',
    accent: '#e0ad35', accent2: '#c2683a', onAccent: '#24170a', border: '#4e3620',
    display: "'Cinzel', serif", body: "'Lora', serif" },

  { slug: 'minoan', name: 'Minoan Civilization', mode: 'light', motif: 'spiral',
    bg: '#f5f0e5', surface: '#fffaf0', surface2: '#ebe2d0', text: '#1d2b3a', muted: '#4f5b66',
    accent: '#1d5c99', accent2: '#ad3f26', onAccent: '#ffffff', border: '#d8ccb4',
    display: "'Marcellus', serif", body: "'Spectral', serif" },

  { slug: 'kush', name: 'Kingdom of Kush', mode: 'dark', motif: 'columns',
    bg: '#191512', surface: '#241e19', surface2: '#30281f', text: '#f0e6d8', muted: '#bba98f',
    accent: '#d6944a', accent2: '#4fa391', onAccent: '#1d1309', border: '#463a2e',
    display: "'Cinzel', serif", body: "'Source Serif 4', serif" },

  { slug: 'khmer', name: 'Khmer Empire', mode: 'dark', motif: 'leaves',
    bg: '#10201a', surface: '#162b23', surface2: '#1f382e', text: '#e8eadf', muted: '#a9b8a8',
    accent: '#d2a457', accent2: '#8fc28a', onAccent: '#1a1406', border: '#2d4a3e',
    display: "'Philosopher', sans-serif", body: "'Lora', serif" },

  { slug: 'saba', name: 'Kingdom of Saba', mode: 'light', motif: 'dunes',
    bg: '#f6eedd', surface: '#fffaf0', surface2: '#ece0c6', text: '#3a1f17', muted: '#6a4b3e',
    accent: '#992d20', accent2: '#8a6a1f', onAccent: '#ffffff', border: '#dccaa6',
    display: "'Cormorant Garamond', serif", body: "'Lora', serif" },

  { slug: 'etruscan', name: 'Etruscan Civilization', mode: 'light', motif: 'columns',
    bg: '#f3e3d3', surface: '#fbf1e6', surface2: '#e8d2bc', text: '#3b1e14', muted: '#6d4636',
    accent: '#a84a28', accent2: '#7a5c22', onAccent: '#ffffff', border: '#d9bca2',
    display: "'Cinzel', serif", body: "'Cormorant Garamond', serif" },

  { slug: 'hittite', name: 'Hittite Empire', mode: 'dark', motif: 'tiles',
    bg: '#1b1d22', surface: '#24272e', surface2: '#2e323b', text: '#e6e1d6', muted: '#a8a69e',
    accent: '#c98a46', accent2: '#8ea0ba', onAccent: '#1b1208', border: '#3d424d',
    display: "'Marcellus', serif", body: "'Source Serif 4', serif" },

  { slug: 'kiribati', name: 'Kiribati', mode: 'light', motif: 'waves',
    bg: '#eaf7f8', surface: '#ffffff', surface2: '#d6eef0', text: '#0e3340', muted: '#3d6470',
    accent: '#06728a', accent2: '#c77a12', onAccent: '#ffffff', border: '#b9dfe3',
    display: "'Josefin Sans', sans-serif", body: "'Nunito Sans', sans-serif" },

  { slug: 'lesotho', name: 'Lesotho', mode: 'light', motif: 'mountains',
    bg: '#eef2f7', surface: '#ffffff', surface2: '#dde5ef', text: '#1e2a3a', muted: '#4c5a6b',
    accent: '#2a5aa0', accent2: '#2f7a3f', onAccent: '#ffffff', border: '#c8d3e1',
    display: "'Josefin Sans', sans-serif", body: "'Source Serif 4', serif" },

  { slug: 'transnistria', name: 'Transnistria', mode: 'dark', motif: 'tiles',
    bg: '#1c1b1b', surface: '#262525', surface2: '#302e2e', text: '#ece6dc', muted: '#aaa59c',
    accent: '#ec6a5f', accent2: '#5fb073', onAccent: '#1c0a08', border: '#423f3f',
    display: "'Josefin Sans', sans-serif", body: "'Nunito Sans', sans-serif" },

  { slug: 'socotra', name: 'Socotra Island', mode: 'light', motif: 'leaves',
    bg: '#f5efe6', surface: '#fffaf3', surface2: '#eadfcf', text: '#2f2320', muted: '#634f48',
    accent: '#9c1f29', accent2: '#3f6b4b', onAccent: '#ffffff', border: '#dbcbb5',
    display: "'Playfair Display', serif", body: "'Lora', serif" },

  { slug: 'mustang', name: 'Kingdom of Mustang', mode: 'light', motif: 'mountains',
    bg: '#f4ead8', surface: '#fdf6ea', surface2: '#e9dcc3', text: '#2d1f1a', muted: '#5f4b40',
    accent: '#a83c27', accent2: '#2a5aa0', onAccent: '#ffffff', border: '#d9c7a6',
    display: "'Philosopher', sans-serif", body: "'Spectral', serif" },

  { slug: 'lapita', name: 'Lapita Culture', mode: 'dark', motif: 'waves',
    bg: '#22180f', surface: '#2d2116', surface2: '#3a2b1d', text: '#efe2cf', muted: '#c0ab91',
    accent: '#d68c56', accent2: '#68b5b1', onAccent: '#211208', border: '#4c3a28',
    display: "'IM Fell English', serif", body: "'Lora', serif" },

  { slug: 'nabataean', name: 'Nabataean Kingdom', mode: 'light', motif: 'dunes',
    bg: '#f6e6dc', surface: '#fdf3ec', surface2: '#ecd3c3', text: '#3d211b', muted: '#6b4539',
    accent: '#a84a35', accent2: '#7a4c2f', onAccent: '#ffffff', border: '#dfbfab',
    display: "'Cinzel', serif", body: "'Cormorant Garamond', serif" },

  { slug: 'khiva', name: 'Khanate of Khiva', mode: 'dark', motif: 'tiles',
    bg: '#0f2230', surface: '#152d3e', surface2: '#1d3a4f', text: '#e9f1f2', muted: '#a6bcc4',
    accent: '#33c0c8', accent2: '#e6b84e', onAccent: '#06191c', border: '#2a4a60',
    display: "'Philosopher', sans-serif", body: "'Source Serif 4', serif" },

  { slug: 'sao-tome', name: 'São Tomé and Príncipe', mode: 'light', motif: 'leaves',
    bg: '#eef5ec', surface: '#ffffff', surface2: '#dceadb', text: '#1d2a1c', muted: '#4a5c48',
    accent: '#256f31', accent2: '#7a4a2a', onAccent: '#ffffff', border: '#c3d9c1',
    display: "'Playfair Display', serif", body: "'Nunito Sans', sans-serif" },

  { slug: 'dilmun', name: 'Dilmun Civilization', mode: 'light', motif: 'waves',
    bg: '#f3f1ec', surface: '#ffffff', surface2: '#e6e2d8', text: '#1f2b33', muted: '#4f5c63',
    accent: '#2f6b7e', accent2: '#8a6a32', onAccent: '#ffffff', border: '#d4cfc2',
    display: "'Marcellus', serif", body: "'Spectral', serif" },

  { slug: 'lydia', name: 'Kingdom of Lydia', mode: 'dark', motif: 'coins',
    bg: '#1c1524', surface: '#261d31', surface2: '#30253e', text: '#efe8f4', muted: '#b4a8c0',
    accent: '#ddb64f', accent2: '#ad83d6', onAccent: '#1f1606', border: '#433556',
    display: "'Cinzel', serif", body: "'Cormorant Garamond', serif" },

  { slug: 'palau', name: 'Palau', mode: 'light', motif: 'waves',
    bg: '#e9f6f1', surface: '#ffffff', surface2: '#d4ece3', text: '#0f2f2a', muted: '#3f6159',
    accent: '#0d7a64', accent2: '#c2502f', onAccent: '#ffffff', border: '#b6dccf',
    display: "'Josefin Sans', sans-serif", body: "'Nunito Sans', sans-serif" },

  { slug: 'kanem-bornu', name: 'Kanem–Bornu Empire', mode: 'dark', motif: 'dunes',
    bg: '#141a2e', surface: '#1b2239', surface2: '#242d48', text: '#eee6d6', muted: '#adaab5',
    accent: '#ddaa52', accent2: '#8197e0', onAccent: '#1e1506', border: '#323d5e',
    display: "'Cinzel', serif", body: "'Source Serif 4', serif" },
];

export const THEME_SLUGS = THEMES.map((t) => t.slug);
export const themeBySlug = (slug) => THEMES.find((t) => t.slug === slug) || THEMES[0];
