// Restricted research plates. They are generated on the server as SVG and are ONLY
// delivered through an authenticated endpoint (no public static file exists), so a
// direct URL without a Bearer token gets 401.
import { themeBySlug } from './themes.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PLATES = [
  { n: 1, name: 'Landscape survey', caption: 'Reconstructed landscape of the region.' },
  { n: 2, name: 'Motif study', caption: 'Recurring decorative motif documented by the team.' },
  { n: 3, name: 'Emblem plate', caption: 'Symbolic emblem used in the investigation dossier.' },
];

function motifShapes(motif, t, w, h) {
  const a = t.accent, b = t.accent2;
  switch (motif) {
    case 'waves':
      return Array.from({ length: 6 }, (_, i) => {
        const y = h * 0.55 + i * 28;
        return `<path d="M0 ${y} Q ${w * 0.125} ${y - 18} ${w * 0.25} ${y} T ${w * 0.5} ${y} T ${w * 0.75} ${y} T ${w} ${y} V ${h} H 0 Z" fill="${i % 2 ? a : b}" opacity="${0.18 + i * 0.1}"/>`;
      }).join('');
    case 'mountains':
      return `<path d="M0 ${h} L ${w * 0.2} ${h * 0.45} L ${w * 0.35} ${h * 0.65} L ${w * 0.55} ${h * 0.3} L ${w * 0.75} ${h * 0.6} L ${w * 0.9} ${h * 0.42} L ${w} ${h * 0.55} V ${h} Z" fill="${b}" opacity="0.55"/>
              <path d="M0 ${h} L ${w * 0.15} ${h * 0.7} L ${w * 0.4} ${h * 0.55} L ${w * 0.6} ${h * 0.75} L ${w * 0.85} ${h * 0.6} L ${w} ${h * 0.72} V ${h} Z" fill="${a}" opacity="0.75"/>
              <path d="M${w * 0.55} ${h * 0.3} L ${w * 0.5} ${h * 0.38} L ${w * 0.6} ${h * 0.38} Z" fill="#ffffff" opacity="0.8"/>`;
    case 'dunes':
      return `<path d="M0 ${h * 0.7} C ${w * 0.25} ${h * 0.5}, ${w * 0.45} ${h * 0.85}, ${w * 0.7} ${h * 0.62} S ${w} ${h * 0.6}, ${w} ${h * 0.6} V ${h} H 0 Z" fill="${a}" opacity="0.7"/>
              <path d="M0 ${h * 0.82} C ${w * 0.3} ${h * 0.7}, ${w * 0.6} ${h * 0.95}, ${w} ${h * 0.78} V ${h} H 0 Z" fill="${b}" opacity="0.7"/>`;
    case 'columns':
      return Array.from({ length: 7 }, (_, i) => {
        const x = w * 0.12 + i * w * 0.125;
        return `<rect x="${x}" y="${h * 0.35}" width="${w * 0.05}" height="${h * 0.5}" fill="${a}" opacity="0.8"/><rect x="${x - 6}" y="${h * 0.33}" width="${w * 0.05 + 12}" height="10" fill="${b}"/>`;
      }).join('') + `<path d="M${w * 0.08} ${h * 0.33} L ${w * 0.5} ${h * 0.15} L ${w * 0.92} ${h * 0.33} Z" fill="${b}" opacity="0.85"/><rect x="${w * 0.06}" y="${h * 0.85}" width="${w * 0.88}" height="14" fill="${b}"/>`;
    case 'leaves':
      return Array.from({ length: 9 }, (_, i) => {
        const cx = (i * 97) % w, cy = h * 0.5 + ((i * 53) % (h * 0.4));
        return `<ellipse cx="${cx}" cy="${cy}" rx="70" ry="24" transform="rotate(${(i * 37) % 180} ${cx} ${cy})" fill="${i % 2 ? a : b}" opacity="0.55"/>`;
      }).join('');
    case 'tiles':
      return Array.from({ length: 48 }, (_, i) => {
        const x = (i % 8) * (w / 8), y = h * 0.4 + Math.floor(i / 8) * 40;
        return `<rect x="${x + 4}" y="${y + 4}" width="${w / 8 - 8}" height="32" rx="4" fill="${(i + Math.floor(i / 8)) % 2 ? a : b}" opacity="0.6"/>`;
      }).join('');
    case 'coins':
      return Array.from({ length: 7 }, (_, i) => `<circle cx="${w * 0.12 + i * w * 0.13}" cy="${h * 0.7 - (i % 2) * 30}" r="38" fill="${a}" opacity="0.85"/><circle cx="${w * 0.12 + i * w * 0.13}" cy="${h * 0.7 - (i % 2) * 30}" r="28" fill="none" stroke="${b}" stroke-width="3"/>`).join('');
    case 'spiral':
      return Array.from({ length: 5 }, (_, i) => {
        const cx = w * 0.12 + i * w * 0.19, cy = h * 0.7;
        return `<path d="M${cx} ${cy} m -40 0 a 40 40 0 1 1 80 0 a 30 30 0 1 1 -60 0 a 20 20 0 1 1 40 0 a 10 10 0 1 1 -20 0" fill="none" stroke="${i % 2 ? a : b}" stroke-width="6"/>`;
      }).join('');
    case 'sun':
    case 'stars':
    default:
      return Array.from({ length: 24 }, (_, i) => {
        const ang = (i / 24) * Math.PI * 2;
        return `<line x1="${w / 2}" y1="${h * 0.6}" x2="${w / 2 + Math.cos(ang) * w}" y2="${h * 0.6 + Math.sin(ang) * w}" stroke="${i % 2 ? a : b}" stroke-width="8" opacity="0.25"/>`;
      }).join('') + `<circle cx="${w / 2}" cy="${h * 0.6}" r="70" fill="${a}"/>`;
  }
}

export function renderPlate(topic, n) {
  const t = { ...themeBySlug(topic.theme) };
  if (topic.accent) t.accent = topic.accent;
  const w = 800, h = 500;
  const plate = PLATES.find((p) => p.n === n) || PLATES[0];
  let art;
  if (n === 1) {
    art = `<rect width="${w}" height="${h}" fill="url(#sky)"/>${motifShapes(t.motif, t, w, h)}`;
  } else if (n === 2) {
    art = `<rect width="${w}" height="${h}" fill="${t.surface2}"/><g transform="translate(0,-${h * 0.25})">${motifShapes('tiles', t, w, h)}</g><g opacity="0.9">${motifShapes(t.motif, t, w, h)}</g>`;
  } else {
    const rays = Array.from({ length: 16 }, (_, i) => {
      const ang = (i / 16) * Math.PI * 2;
      return `<polygon points="${w / 2},${h / 2} ${w / 2 + Math.cos(ang - 0.08) * 200},${h / 2 + Math.sin(ang - 0.08) * 200} ${w / 2 + Math.cos(ang + 0.08) * 200},${h / 2 + Math.sin(ang + 0.08) * 200}" fill="${i % 2 ? t.accent : t.accent2}" opacity="0.5"/>`;
    }).join('');
    art = `<rect width="${w}" height="${h}" fill="${t.bg}"/>${rays}
      <circle cx="${w / 2}" cy="${h / 2}" r="120" fill="${t.surface}" stroke="${t.accent}" stroke-width="8"/>
      <circle cx="${w / 2}" cy="${h / 2}" r="92" fill="none" stroke="${t.accent2}" stroke-width="3" stroke-dasharray="6 8"/>
      <text x="${w / 2}" y="${h / 2 + 22}" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="${t.accent}">${String(topic.number || '★').padStart(2, '0')}</text>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(plate.name)} - ${esc(topic.title)}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.surface2}"/><stop offset="1" stop-color="${t.bg}"/></linearGradient></defs>
  ${art}
  <rect x="0" y="${h - 56}" width="${w}" height="56" fill="${t.bg}" opacity="0.88"/>
  <text x="24" y="${h - 22}" font-family="Georgia, serif" font-size="22" fill="${t.text}">Plate ${['I', 'II', 'III'][n - 1] || n} · ${esc(plate.name)} — ${esc(topic.title).slice(0, 48)}</text>
  <text x="${w - 24}" y="${h - 22}" text-anchor="end" font-family="monospace" font-size="14" fill="${t.muted}">RESTRICTED · CHRONICLE ATLAS</text>
</svg>`;
}
