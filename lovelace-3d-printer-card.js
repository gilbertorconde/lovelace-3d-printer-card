// =============================================================================
// Lovelace 3D Printer Card  v1.0.0
// A HACS-installable Home Assistant Lovelace card for Moonraker-based printers.
//
// Install via HACS or manually:
//   Place this file in:  /config/www/lovelace-3d-printer-card/lovelace-3d-printer-card.js
//   Register as a Lovelace resource (type: module):
//     url: /local/lovelace-3d-printer-card/lovelace-3d-printer-card.js
//
// Usage:
//   type: custom:lovelace-3d-printer-card
//   name: My Printer
//   base_entity: voron_24
//   printer_type: i3          # i3 | corexy | cantilever
//
// All entity IDs are auto-derived from base_entity, with optional overrides:
//   entities:
//     progress: sensor.my_printer_print_progress
//     status: sensor.my_printer_current_print_state
//     ...
// =============================================================================

const CARD_TAG = 'lovelace-3d-printer-card';

// ── State colours ─────────────────────────────────────────────────────────────
const STATE_COLORS = {
  printing:     '#4caf50',
  paused:       '#e5c000',
  idle:         '#757575',
  ready:        '#757575',
  standby:      '#42a5f5',
  error:        '#f44336',
  cancelled:    '#f44336',
  'printing':   '#4caf50',
  'pausing':    '#e5c000',
  'resuming':   '#4caf50',
  'loading':    '#42a5f5',
  'complete':   '#4caf50',
  'startup':    '#42a5f5',
  'shutdown':   '#757575',
  'offline':    '#757575',
  'unknown':    '#757575',
};

function stateColor(status) {
  if (!status) return STATE_COLORS.idle;
  const s = status.toLowerCase();
  for (const [key, color] of Object.entries(STATE_COLORS)) {
    if (s.includes(key)) return color;
  }
  return STATE_COLORS.idle;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fmtSeconds(secs) {
  if (secs == null || isNaN(secs) || secs < 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

// Parse duration strings from Moonraker: "21m 10s", "2h 10m", "2h 30m 45s", "18s", "In 2 hours"
function parseDurationToSeconds(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const n = parseFloat(s);
  if (!isNaN(n) && s === String(n)) return n; // plain number (seconds)
  let total = 0;
  const h = s.match(/(\d+)\s*h(?:ours?)?/i);
  const m = s.match(/(\d+)\s*m(?:in(?:utes?)?)?(?!\s*s)/i) || s.match(/(\d+)\s*min/i);
  const sec = s.match(/(\d+)\s*s(?:ec(?:onds?)?)?/i) || s.match(/(\d+)\s*sec/i);
  if (h) total += parseInt(h[1], 10) * 3600;
  if (m) total += parseInt(m[1], 10) * 60;
  if (sec) total += parseInt(sec[1], 10);
  if (total > 0) return total;
  if (!isNaN(n) && n > 0) return n; // fallback: first number (e.g. "In 2 hours" -> 2)
  return null;
}

function fmtTemp(val, unit = '°C') {
  if (val == null || val === 'unknown' || val === 'unavailable') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return `${Math.round(n)}${unit}`;
}

function fmtPct(val) {
  if (val == null || val === 'unknown' || val === 'unavailable') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

function fmtETA(remainingSecs) {
  if (!remainingSecs || isNaN(remainingSecs)) return null;
  const eta = new Date(Date.now() + remainingSecs * 1000);
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncate(str, maxLen = 22) {
  if (!str) return '';
  const base = str.replace(/\.gcode$/i, '');
  if (base.length <= maxLen) return base;
  return base.slice(0, maxLen - 1) + '…';
}

function stVal(hass, entityId) {
  if (!hass || !entityId) return null;
  const st = hass.states[entityId];
  if (!st) return null;
  if (st.state === 'unknown' || st.state === 'unavailable') return null;
  return st.state;
}

function numVal(hass, entityId) {
  const v = stVal(hass, entityId);
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function durationVal(hass, entityId) {
  const v = stVal(hass, entityId);
  if (v == null) return null;
  const deviceClass = attrVal(hass, entityId, 'device_class') || '';
  const unit = (attrVal(hass, entityId, 'unit_of_measurement') || '').toLowerCase();
  const s = String(v).trim();

  // Timestamp (print_eta): ISO date → seconds from now until that time
  if (deviceClass === 'timestamp' && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = new Date(s).getTime();
    if (!isNaN(t)) return Math.max(0, (t - Date.now()) / 1000);
  }

  const n = parseFloat(v);
  if (!isNaN(n) && s === String(n)) {
    if (unit === 'min' || unit === 'minute' || unit === 'minutes') return n * 60;
    if (unit === 'h' || unit === 'hour' || unit === 'hours') return n * 3600;
    return n; // assume seconds
  }
  return parseDurationToSeconds(v);
}

function attrVal(hass, entityId, attr) {
  if (!hass || !entityId) return null;
  const st = hass.states[entityId];
  if (!st) return null;
  return st.attributes?.[attr] ?? null;
}

function friendlyLabel(entityId, prefix) {
  // Strip friendly_name prefix noise, e.g. "Gilbot Nova Macro Filament Load" → "Filament Load"
  return entityId
    .replace(/^[^.]+\./, '')          // remove domain
    .replace(prefix, '')               // remove base prefix
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// ── Arc math (same technique as AC Card) ──────────────────────────────────────
function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const start = (startDeg - 90) * Math.PI / 180;
  const end = (startDeg + sweepDeg - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// ── SVG Printer Graphics ──────────────────────────────────────────────────────
function _buildObject(progress, maxHeight, objectWidth) {
  const TOTAL_LINES = 12;
  const lineH = maxHeight / TOTAL_LINES;
  const filled = Math.round(progress * TOTAL_LINES);
  let lines = '';
  for (let i = 0; i < TOTAL_LINES; i++) {
    const lineIdx = TOTAL_LINES - 1 - i;
    const y = 0 + i * lineH;
    const isDone = lineIdx < filled;
    if (isDone) {
      lines += `<rect x="0" y="${y}" width="${objectWidth}" height="${lineH - 1}" rx="1" fill="currentColor" opacity="0.85"/>`;
    } else {
      lines += `<rect x="0" y="${y}" width="${objectWidth}" height="${lineH - 1}" rx="1" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.3" stroke-dasharray="3 2"/>`;
    }
  }
  return `<g class="print-object">${lines}</g>`;
}

function svgPrinterI3(progress, hotendOn, bedOn, chamberOn, isPrinting, nozzleX) {
  const W = 200, H = 180;
  const frameColor = 'var(--primary-text-color)';
  const accentColor = 'var(--mode-color)';
  const rodLeft = 30, rodRight = 170;
  const rodTop = 18, rodBottom = 155;
  const bedY = 140;
  const bedW = 100, bedH = 10;
  const bedX = (W - bedW) / 2;
  const objMaxH = bedY - rodTop - 36;
  const objH = Math.max(4, objMaxH * progress);
  const objY = bedY - objH;
  const filled = Math.round(progress * 12);
  const lineH = objH / 12;
  const topOfPrintedY = filled > 0 ? objY + (12 - filled) * lineH : bedY;
  const nozzleTipOffset = 18;
  const gantryY = topOfPrintedY - nozzleTipOffset;
  const nozzleXPos = 55 + (nozzleX ?? 0.5) * 90;
  const nozzleYPos = gantryY + 10;
  const objW = 56;
  const objX = W / 2 - objW / 2;
  const hotendGlow = hotendOn
    ? `<circle cx="${nozzleXPos}" cy="${nozzleYPos + 4}" r="5" fill="#ff8c00" opacity="0.5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/></circle>`
    : '';
  const bedGlow = bedOn
    ? `<ellipse cx="${bedX + bedW / 2}" cy="${bedY + bedH / 2}" rx="${bedW / 2 + 4}" ry="8" fill="#ff8c00" opacity="0.35"><animate attributeName="opacity" values="0.35;0.6;0.35" dur="2.5s" repeatCount="indefinite"/></ellipse>`
    : '';
  const chamberGlow = chamberOn
    ? `<rect x="${rodLeft - 10}" y="${rodTop - 10}" width="${rodRight - rodLeft + 20}" height="${rodBottom - rodTop + 25}" rx="8" fill="#ff8c00" opacity="0.08"><animate attributeName="opacity" values="0.08;0.18;0.08" dur="3s" repeatCount="indefinite"/></rect>`
    : '';
  const nozzleAnim = isPrinting
    ? `<animateTransform attributeName="transform" type="translate" values="0,0;3,0;0,0;-3,0;0,0" dur="4s" repeatCount="indefinite"/>`
    : '';
  const objectLines = progress > 0 ? _buildObject(progress, objH, objW - 4) : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;color:${accentColor};overflow:visible">
  ${chamberGlow}
  <rect x="${rodLeft - 6}" y="${rodTop - 8}" width="12" height="${rodBottom - rodTop + 16}" rx="3" fill="none" stroke="${frameColor}" stroke-width="2.5" opacity="0.3"/>
  <rect x="${rodRight - 6}" y="${rodTop - 8}" width="12" height="${rodBottom - rodTop + 16}" rx="3" fill="none" stroke="${frameColor}" stroke-width="2.5" opacity="0.3"/>
  <line x1="${rodLeft}" y1="${rodTop}" x2="${rodLeft}" y2="${rodBottom}" stroke="${frameColor}" stroke-width="3" opacity="0.45" stroke-linecap="round"/>
  <line x1="${rodRight}" y1="${rodTop}" x2="${rodRight}" y2="${rodBottom}" stroke="${frameColor}" stroke-width="3" opacity="0.45" stroke-linecap="round"/>
  <line x1="${rodLeft}" y1="${rodTop}" x2="${rodRight}" y2="${rodTop}" stroke="${frameColor}" stroke-width="3" opacity="0.35" stroke-linecap="round"/>
  <line x1="${rodLeft + 6}" y1="${gantryY}" x2="${rodRight - 6}" y2="${gantryY}" stroke="${frameColor}" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
  <rect x="${rodLeft - 4}" y="${gantryY - 6}" width="14" height="12" rx="2" fill="${accentColor}" opacity="0.8"/>
  <rect x="${rodRight - 10}" y="${gantryY - 6}" width="14" height="12" rx="2" fill="${accentColor}" opacity="0.8"/>
  ${bedGlow}
  <rect x="${bedX - 4}" y="${bedY}" width="${bedW + 8}" height="${bedH}" rx="3" fill="${frameColor}" opacity="0.25"/>
  <rect x="${bedX}" y="${bedY}" width="${bedW}" height="${bedH - 2}" rx="2" fill="${bedOn ? '#ff8c00' : accentColor}" opacity="${bedOn ? '0.7' : '0.4'}"/>
  <line x1="${bedX + 8}" y1="${bedY + 3}" x2="${bedX + bedW - 8}" y2="${bedY + 3}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <line x1="${bedX + 8}" y1="${bedY + 6}" x2="${bedX + bedW - 8}" y2="${bedY + 6}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <g transform="translate(${objX}, ${objY})" style="color:${accentColor}">${objectLines}</g>
  ${hotendGlow}
  <g transform="translate(${nozzleXPos}, ${gantryY})"><g>${nozzleAnim}<rect x="-7" y="0" width="14" height="10" rx="2" fill="${accentColor}" opacity="0.9"/><polygon points="-4,10 4,10 0,18" fill="${hotendOn ? '#ff8c00' : accentColor}" opacity="${hotendOn ? '1' : '0.7'}"/></g></g>
</svg>`;
}

// CoreXY: gantry fixed at top, bed (with object) moves down
function svgPrinterCoreXY(progress, hotendOn, bedOn, chamberOn, isPrinting, nozzleX) {
  const W = 200, H = 180;
  const frameColor = 'var(--primary-text-color)';
  const accentColor = 'var(--mode-color)';
  const frameLeft = 22, frameRight = 178, frameTop = 15, frameBottom = 160;
  const gantryY = 38; // fixed at top
  const bedW = 100;
  const bedX = (W - bedW) / 2;
  const bedH = 10;
  const objMaxH = 75;
  const objH = Math.max(4, objMaxH * progress);
  const filled = Math.round(progress * 12);
  const bedYTop = 55;
  const bedY = bedYTop + (filled > 0 ? objH * filled / 12 : 0);
  const objY = bedY - objH;
  const objW = 56;
  const objX = W / 2 - objW / 2;
  const nozzleXPos = 55 + (nozzleX ?? 0.5) * 90;
  const nozzleYPos = gantryY + 12;
  const hotendGlow = hotendOn
    ? `<circle cx="${nozzleXPos}" cy="${nozzleYPos + 4}" r="5" fill="#ff8c00" opacity="0.5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/></circle>`
    : '';
  const bedGlow = bedOn
    ? `<ellipse cx="${bedX + bedW / 2}" cy="${bedY + bedH / 2}" rx="${bedW / 2 + 4}" ry="8" fill="#ff8c00" opacity="0.35"><animate attributeName="opacity" values="0.35;0.6;0.35" dur="2.5s" repeatCount="indefinite"/></ellipse>`
    : '';
  const chamberGlow = chamberOn
    ? `<rect x="${frameLeft - 8}" y="${frameTop - 8}" width="${frameRight - frameLeft + 16}" height="${frameBottom - frameTop + 16}" rx="8" fill="#ff8c00" opacity="0.08"><animate attributeName="opacity" values="0.08;0.18;0.08" dur="3s" repeatCount="indefinite"/></rect>`
    : '';
  const nozzleAnim = isPrinting
    ? `<animateTransform attributeName="transform" type="translate" values="0,0;3,0;-3,0;0,0" dur="3s" repeatCount="indefinite"/>`
    : '';
  const objectLines = progress > 0 ? _buildObject(progress, objH, objW - 4) : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;color:${accentColor};overflow:visible">
  ${chamberGlow}
  <rect x="${frameLeft}" y="${frameTop}" width="${frameRight - frameLeft}" height="${frameBottom - frameTop}" rx="4" fill="none" stroke="${frameColor}" stroke-width="2.5" opacity="0.35"/>
  <rect x="${frameLeft - 4}" y="${frameTop - 4}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameRight - 6}" y="${frameTop - 4}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameLeft - 4}" y="${frameBottom - 6}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameRight - 6}" y="${frameBottom - 6}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <line x1="${frameLeft + 8}" y1="${gantryY}" x2="${frameRight - 8}" y2="${gantryY}" stroke="${frameColor}" stroke-width="4" opacity="0.6" stroke-linecap="round"/>
  <rect x="${nozzleXPos - 12}" y="${gantryY - 7}" width="24" height="14" rx="3" fill="${accentColor}" opacity="0.85"/>
  <circle cx="${frameLeft + 10}" cy="${gantryY}" r="5" fill="none" stroke="${frameColor}" stroke-width="1.5" opacity="0.4"/>
  <circle cx="${frameRight - 10}" cy="${gantryY}" r="5" fill="none" stroke="${frameColor}" stroke-width="1.5" opacity="0.4"/>
  <line x1="${bedX + 12}" y1="${bedY + bedH}" x2="${bedX + 12}" y2="${frameBottom}" stroke="${frameColor}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
  <line x1="${bedX + bedW - 12}" y1="${bedY + bedH}" x2="${bedX + bedW - 12}" y2="${frameBottom}" stroke="${frameColor}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
  ${bedGlow}
  <rect x="${bedX - 4}" y="${bedY}" width="${bedW + 8}" height="${bedH}" rx="3" fill="${frameColor}" opacity="0.25"/>
  <rect x="${bedX}" y="${bedY}" width="${bedW}" height="${bedH - 2}" rx="2" fill="${bedOn ? '#ff8c00' : accentColor}" opacity="${bedOn ? '0.7' : '0.4'}"/>
  <line x1="${bedX + 8}" y1="${bedY + 3}" x2="${bedX + bedW - 8}" y2="${bedY + 3}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <line x1="${bedX + 8}" y1="${bedY + 6}" x2="${bedX + bedW - 8}" y2="${bedY + 6}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <g transform="translate(${objX}, ${objY})" style="color:${accentColor}">${objectLines}</g>
  ${hotendGlow}
  <g transform="translate(${nozzleXPos}, ${gantryY + 7})"><g>${nozzleAnim}<polygon points="-4,0 4,0 0,10" fill="${hotendOn ? '#ff8c00' : accentColor}" opacity="${hotendOn ? '1' : '0.7'}"/></g></g>
</svg>`;
}

// Voron 2.4–style: flying gantry moves up with object
function svgPrinterCoreXYFlyingGantry(progress, hotendOn, bedOn, chamberOn, isPrinting, nozzleX) {
  const W = 200, H = 180;
  const frameColor = 'var(--primary-text-color)';
  const accentColor = 'var(--mode-color)';
  const frameLeft = 22, frameRight = 178, frameTop = 15, frameBottom = 160;
  const frameW = frameRight - frameLeft;
  const frameH = frameBottom - frameTop;
  const bedY = 130;
  const bedW = 100;
  const bedX = (W - bedW) / 2;
  const bedH = 10;
  const objMaxH = bedY - frameTop - 45;
  const objH = Math.max(4, objMaxH * progress);
  const objY = bedY - objH;
  const filled = Math.round(progress * 12);
  const lineH = objH / 12;
  const topOfPrintedY = filled > 0 ? objY + (12 - filled) * lineH : bedY;
  const nozzleTipOffset = 17;
  const railY = topOfPrintedY - nozzleTipOffset;
  const nozzleXPos = 55 + (nozzleX ?? 0.5) * 90;
  const nozzleYPos = railY + 12;
  const objW = 56;
  const objX = W / 2 - objW / 2;
  const hotendGlow = hotendOn
    ? `<circle cx="${nozzleXPos}" cy="${nozzleYPos + 4}" r="5" fill="#ff8c00" opacity="0.5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/></circle>`
    : '';
  const bedGlow = bedOn
    ? `<ellipse cx="${bedX + bedW / 2}" cy="${bedY + bedH / 2}" rx="${bedW / 2 + 4}" ry="8" fill="#ff8c00" opacity="0.35"><animate attributeName="opacity" values="0.35;0.6;0.35" dur="2.5s" repeatCount="indefinite"/></ellipse>`
    : '';
  const chamberGlow = chamberOn
    ? `<rect x="${frameLeft - 8}" y="${frameTop - 8}" width="${frameW + 16}" height="${frameH + 16}" rx="8" fill="#ff8c00" opacity="0.08"><animate attributeName="opacity" values="0.08;0.18;0.08" dur="3s" repeatCount="indefinite"/></rect>`
    : '';
  const nozzleAnim = isPrinting
    ? `<animateTransform attributeName="transform" type="translate" values="0,0;3,0;-3,0;0,0" dur="3s" repeatCount="indefinite"/>`
    : '';
  const objectLines = progress > 0 ? _buildObject(progress, objH, objW - 4) : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;color:${accentColor};overflow:visible">
  ${chamberGlow}
  <rect x="${frameLeft}" y="${frameTop}" width="${frameW}" height="${frameH}" rx="4" fill="none" stroke="${frameColor}" stroke-width="2.5" opacity="0.35"/>
  <rect x="${frameLeft - 4}" y="${frameTop - 4}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameRight - 6}" y="${frameTop - 4}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameLeft - 4}" y="${frameBottom - 6}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <rect x="${frameRight - 6}" y="${frameBottom - 6}" width="10" height="10" rx="2" fill="${accentColor}" opacity="0.6"/>
  <line x1="${frameLeft + 8}" y1="${railY}" x2="${frameRight - 8}" y2="${railY}" stroke="${frameColor}" stroke-width="4" opacity="0.6" stroke-linecap="round"/>
  <rect x="${nozzleXPos - 12}" y="${railY - 7}" width="24" height="14" rx="3" fill="${accentColor}" opacity="0.85"/>
  <circle cx="${frameLeft + 10}" cy="${railY}" r="5" fill="none" stroke="${frameColor}" stroke-width="1.5" opacity="0.4"/>
  <circle cx="${frameRight - 10}" cy="${railY}" r="5" fill="none" stroke="${frameColor}" stroke-width="1.5" opacity="0.4"/>
  <line x1="${frameLeft + 12}" y1="${railY + 20}" x2="${frameLeft + 12}" y2="${bedY + 5}" stroke="${frameColor}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
  <line x1="${frameRight - 12}" y1="${railY + 20}" x2="${frameRight - 12}" y2="${bedY + 5}" stroke="${frameColor}" stroke-width="1.5" opacity="0.3" stroke-dasharray="4 3"/>
  ${bedGlow}
  <rect x="${bedX - 4}" y="${bedY}" width="${bedW + 8}" height="${bedH}" rx="3" fill="${frameColor}" opacity="0.25"/>
  <rect x="${bedX}" y="${bedY}" width="${bedW}" height="${bedH - 2}" rx="2" fill="${bedOn ? '#ff8c00' : accentColor}" opacity="${bedOn ? '0.7' : '0.4'}"/>
  <line x1="${bedX + 8}" y1="${bedY + 3}" x2="${bedX + bedW - 8}" y2="${bedY + 3}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <line x1="${bedX + 8}" y1="${bedY + 6}" x2="${bedX + bedW - 8}" y2="${bedY + 6}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <g transform="translate(${objX}, ${objY})" style="color:${accentColor}">${objectLines}</g>
  ${hotendGlow}
  <g transform="translate(${nozzleXPos}, ${railY + 7})"><g>${nozzleAnim}<polygon points="-4,0 4,0 0,10" fill="${hotendOn ? '#ff8c00' : accentColor}" opacity="${hotendOn ? '1' : '0.7'}"/></g></g>
</svg>`;
}

function svgPrinterCantilever(progress, hotendOn, bedOn, chamberOn, isPrinting, nozzleX) {
  const W = 200, H = 180;
  const frameColor = 'var(--primary-text-color)';
  const accentColor = 'var(--mode-color)';
  const uprightX = 35;
  const uprightTop = 15;
  const uprightBottom = 160;
  const baseY = 155;
  const baseLeft = 20;
  const baseRight = 175;
  const bedY = 140;
  const bedW = 110;
  const bedX = (W - bedW) / 2;
  const bedH = 10;
  const objMaxH = bedY - uprightTop - 36;
  const objH = Math.max(4, objMaxH * progress);
  const objY = bedY - objH;
  const filled = Math.round(progress * 12);
  const lineH = objH / 12;
  const topOfPrintedY = filled > 0 ? objY + (12 - filled) * lineH : bedY;
  const nozzleTipOffset = 23;
  const armY = topOfPrintedY - nozzleTipOffset;
  const armRight = baseRight - 5;
  const nozzleXPos = 70 + (nozzleX ?? 0.5) * 80;
  const objW = 60;
  const objX = W / 2 - objW / 2;
  const hotendGlow = hotendOn
    ? `<circle cx="${nozzleXPos}" cy="${armY + 16}" r="5" fill="#ff8c00" opacity="0.5"><animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite"/></circle>`
    : '';
  const bedGlow = bedOn
    ? `<ellipse cx="${bedX + bedW / 2}" cy="${bedY + bedH / 2}" rx="${bedW / 2 + 4}" ry="8" fill="#ff8c00" opacity="0.35"><animate attributeName="opacity" values="0.35;0.6;0.35" dur="2.5s" repeatCount="indefinite"/></ellipse>`
    : '';
  const chamberGlow = chamberOn
    ? `<rect x="${baseLeft - 8}" y="${uprightTop - 8}" width="${baseRight - baseLeft + 16}" height="${uprightBottom - uprightTop + 20}" rx="8" fill="#ff8c00" opacity="0.08"><animate attributeName="opacity" values="0.08;0.18;0.08" dur="3s" repeatCount="indefinite"/></rect>`
    : '';
  const nozzleAnim = isPrinting
    ? `<animateTransform attributeName="transform" type="translate" values="0,0;4,0;0,0;-4,0;0,0" dur="3.5s" repeatCount="indefinite"/>`
    : '';
  const objectLines = progress > 0 ? _buildObject(progress, objH, objW - 4) : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;color:${accentColor};overflow:visible">
  ${chamberGlow}
  <rect x="${baseLeft}" y="${baseY}" width="${baseRight - baseLeft}" height="12" rx="4" fill="${frameColor}" opacity="0.25"/>
  <line x1="${baseLeft + 6}" y1="${baseY}" x2="${baseLeft + 6}" y2="${uprightBottom}" stroke="${frameColor}" stroke-width="3" opacity="0.3" stroke-linecap="round"/>
  <rect x="${uprightX - 5}" y="${uprightTop}" width="12" height="${uprightBottom - uprightTop}" rx="3" fill="${frameColor}" opacity="0.2"/>
  <line x1="${uprightX}" y1="${uprightTop}" x2="${uprightX}" y2="${uprightBottom}" stroke="${frameColor}" stroke-width="3.5" opacity="0.65" stroke-linecap="round"/>
  <rect x="${uprightX - 9}" y="${uprightTop - 6}" width="18" height="10" rx="3" fill="${accentColor}" opacity="0.7"/>
  <rect x="${uprightX - 3}" y="${armY - 6}" width="14" height="12" rx="2" fill="${accentColor}" opacity="0.8"/>
  <line x1="${uprightX + 6}" y1="${armY}" x2="${armRight}" y2="${armY}" stroke="${frameColor}" stroke-width="4" opacity="0.7" stroke-linecap="round"/>
  <rect x="${nozzleXPos - 10}" y="${armY - 7}" width="20" height="14" rx="3" fill="${accentColor}" opacity="0.9"/>
  ${bedGlow}
  <rect x="${bedX - 4}" y="${bedY}" width="${bedW + 8}" height="${bedH}" rx="3" fill="${frameColor}" opacity="0.25"/>
  <rect x="${bedX}" y="${bedY}" width="${bedW}" height="${bedH - 2}" rx="2" fill="${bedOn ? '#ff8c00' : accentColor}" opacity="${bedOn ? '0.7' : '0.4'}"/>
  <line x1="${bedX + 10}" y1="${bedY + 3}" x2="${bedX + bedW - 10}" y2="${bedY + 3}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <line x1="${bedX + 10}" y1="${bedY + 6}" x2="${bedX + bedW - 10}" y2="${bedY + 6}" stroke="${accentColor}" stroke-width="1" opacity="0.4"/>
  <g transform="translate(${objX}, ${objY})" style="color:${accentColor}">${objectLines}</g>
  ${hotendGlow}
  <g transform="translate(${nozzleXPos}, ${armY + 7})"><g>${nozzleAnim}<rect x="-5" y="0" width="10" height="8" rx="1" fill="${accentColor}" opacity="0.9"/><polygon points="-4,8 4,8 0,16" fill="${hotendOn ? '#ff8c00' : accentColor}" opacity="${hotendOn ? '1' : '0.7'}"/></g></g>
</svg>`;
}

function renderPrinterSVG(printerType, progress, hotendTarget, bedTarget, chamberTarget, isPrinting, nozzleX) {
  const isTargetSet = (t) => t != null && !isNaN(Number(t)) && Number(t) > 0;
  const hotendOn = isTargetSet(hotendTarget);
  const bedOn = isTargetSet(bedTarget);
  const chamberOn = isTargetSet(chamberTarget);
  // Progress: accept 0–100 or 0–1
  const p = (progress != null && !isNaN(progress) && progress > 0 && progress <= 1)
    ? Math.min(1, Math.max(0, progress))
    : Math.min(1, Math.max(0, (progress || 0) / 100));
  const nx = Math.min(1, Math.max(0, nozzleX ?? 0.5));
  switch ((printerType || 'i3').toLowerCase()) {
    case 'corexy': return svgPrinterCoreXY(p, hotendOn, bedOn, chamberOn, isPrinting, nx);
    case 'corexy-flying-gantry': return svgPrinterCoreXYFlyingGantry(p, hotendOn, bedOn, chamberOn, isPrinting, nx);
    case 'cantilever': return svgPrinterCantilever(p, hotendOn, bedOn, chamberOn, isPrinting, nx);
    default: return svgPrinterI3(p, hotendOn, bedOn, chamberOn, isPrinting, nx);
  }
}

// ── Progress arc (non-interactive, display-only) ──────────────────────────────
function progressArcSVG(pct) {
  const cx = 36, cy = 36, r = 28;
  const startDeg = 135, sweepTotal = 270;
  const sweep = sweepTotal * Math.min(1, Math.max(0, pct / 100));
  const track = arcPath(cx, cy, r, startDeg, sweepTotal);
  const fill = sweep > 0 ? arcPath(cx, cy, r, startDeg, sweep) : '';
  return `<svg viewBox="0 0 72 72" width="72" height="72" style="flex-shrink:0">
    <path d="${track}" fill="none" stroke="var(--divider-color,rgba(255,255,255,.1))" stroke-width="5" stroke-linecap="round"/>
    ${fill ? `<path d="${fill}" fill="none" stroke="var(--mode-color)" stroke-width="5" stroke-linecap="round"/>` : ''}
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-family="'Share Tech Mono',monospace" fill="var(--primary-text-color)" font-weight="600">${Math.round(pct || 0)}%</text>
  </svg>`;
}

// ── Main Card Class ───────────────────────────────────────────────────────────
class PrinterCard3D extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._entities = {};
    this._cameras = [];
    this._macros = [];
    this._heaters = [];
    this._fans = [];
    this._openSheet = null;
    this._confirmEmergency = false;
    this._confirmTimer = null;
    this._animFrame = null;
    this._nozzleX = 0.5;
    this._nozzleDir = 1;
    this._animRunning = false;
    this._camerasOpen = false;
    this._dragging = false;
    this._thumbFailed = false;
    this._thumbLoaded = false;
    this._lastThumbSrc = null;
    this._bound_click = this._onClick.bind(this);
    this._bound_change = this._onChange.bind(this);
    this._bound_pointerdown = this._onPointerDown.bind(this);
    this._bound_pointerup = this._onPointerUp.bind(this);
  }

  setConfig(config) {
    if (!config.base_entity) throw new Error('lovelace-3d-printer-card: base_entity is required');
    this._config = config;
    if (!this.shadowRoot.innerHTML) this._initialRender();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this._config) return;
    this._crawlEntities();
    const isPrinting = ['printing', 'paused'].includes(this._effectiveStatus());
    // Always re-render when printing so SVG gantry/progress updates are visible
    if (prev && !isPrinting && !this._entitiesChanged(prev, hass)) return;
    this._render();
  }

  // ── Entity crawler ──────────────────────────────────────────────────────────
  // Single pass over all hass.states entries that include the base prefix.
  // Classifies each into a well-known role or a dynamic bucket (macros/heaters/fans/cameras).

  _crawlEntities() {
    if (!this._hass || !this._config) return;
    const b = this._config.base_entity;

    // Label helper: use friendly_name, strip device prefix + temperature suffixes
    const devicePrefix = new RegExp(`^(${this._config.name || b})\\s+`, 'i');
    const label = (st, id) => {
      const fn = st.attributes?.friendly_name;
      if (fn) {
        return fn
          .replace(devicePrefix, '')
          .replace(/\s+temperature$/i, '')
          .replace(/\s+temp$/i, '')
          .trim();
      }
      return id.replace(/^[^.]+\./, '').replace(new RegExp(`^${b}_`), '').replace(/_/g, ' ').trim();
    };

    // Well-known sensor suffixes → role key
    const SENSOR_ROLES = [
      [['current_print_state'],                                       'status'],
      [['printer_state'],                                             'printer_state'],
      [['progress'],                                                   'progress'],
      [['print_duration'],                                             'duration'],
      [['print_time_left', 'print_eta'],                                'eta'],
      [['filename'],                                                   'filename'],
      [['current_layer'],                                              'current_layer'],
      [['total_layer', 'total_layers'],                                'total_layers'],
      [['filament_used'],                                              'filament_used'],
      [['current_print_message'],   'current_print_message'],
      [['current_display_message'], 'current_display_message'],
      [['extruder_temperature', 'extruder_temp'],                      'hotend'],
      [['bed_temperature', 'bed_temp'],                                'bed'],
      [['toolhead_position_x'],                                        'position_x'],
      [['toolhead_position_y'],                                        'position_y'],
      [['toolhead_position_z'],                                        'position_z'],
      [['object_height'],                                              'object_height'],
    ];

    // Well-known number suffixes → role key
    const NUMBER_ROLES = [
      [['extruder_target'],       'hotend_target'],
      [['bed_target'],            'bed_target'],
      [['heater_chamber_target'], 'chamber_target'],
      [['speed_factor'],          'speed_factor'],
      [['flow_factor'],           'flow_factor'],
    ];

    // Well-known button suffixes → role key
    const BUTTON_ROLES = [
      [['cancel_print'],   'cancel'],
      [['pause_print'],    'pause'],
      [['resume_print'],   'resume'],
      [['emergency_stop'], 'emergency'],
      [['home_all_axes'],  'home_all'],
      [['home_x_axis'],    'home_x'],
      [['home_y_axis'],    'home_y'],
      [['home_z_axis'],    'home_z'],
      [['firmware_restart'], 'fw_restart'],
      [['host_restart'],     'host_restart'],
      [['server_restart'],   'server_restart'],
      [['host_shutdown'],    'host_shutdown'],
      [['restart_klipper'],  'klipper_restart'],
    ];

    const matchRole = (suffix, roleTable) => {
      for (const [patterns, role] of roleTable) {
        for (const p of patterns) {
          if (suffix === p || suffix.endsWith('_' + p)) return role;
        }
      }
      return null;
    };

    // Reset all dynamic buckets
    this._entities = {};
    this._macros = [];
    this._heaters = [];
    this._fans = [];
    this._serviceButtons = [];
    // cameras populated separately below (preserve rotation config)

    const tempTargetIds = new Set(); // number entities claimed as temp targets

    // Two-pass: first pass claims well-known roles and macros/cameras/thumbnail.
    // Second pass handles remaining temp sensors and fans (need to know claimed targets).
    const remainingSensors = []; // [id, st, suffix] for unclaimed temp sensors

    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.includes(b)) continue;
      // Skip hidden entities
      if (st.attributes?.hidden === true) continue;

      const domain = id.split('.')[0];
      const suffix = id.replace(/^[^.]+\./, '').replace(new RegExp(`^${b}_`), '');

      if (domain === 'sensor') {
        const role = matchRole(suffix, SENSOR_ROLES);
        if (role) {
          // Prefer a valid-state entity over an unknown/unavailable one
          const existing = this._entities[role];
          const isNewGood = st.state !== 'unknown' && st.state !== 'unavailable';
          if (!existing) {
            if (isNewGood) this._entities[role] = id;
          } else {
            const existingSt = this._hass.states[existing];
            const isExistingBad = !existingSt || existingSt.state === 'unknown' || existingSt.state === 'unavailable';
            // Prefer canonical temp sensors over short aliases (extruder_temperature > extruder_temp, bed_temperature > bed_temp)
            const preferNew = (role === 'hotend' && id.includes('extruder_temperature') && existing.includes('extruder_temp'))
              || (role === 'bed' && id.includes('bed_temperature') && existing.includes('bed_temp'))
              || (role === 'eta' && id.includes('print_time_left') && existing.includes('print_eta'));
            if ((isExistingBad && isNewGood) || preferNew) this._entities[role] = id;
          }
        } else {
          // Collect unclaimed temp sensors for second pass
          const unit = st.attributes?.unit_of_measurement;
          if (unit === '°C' || unit === '°F') remainingSensors.push([id, st, suffix]);
        }

      } else if (domain === 'number') {
        const role = matchRole(suffix, NUMBER_ROLES);
        if (role) {
          if (!this._entities[role]) this._entities[role] = id;
        }
        // Fans/outputs handled in second pass

      } else if (domain === 'button') {
        // System/action buttons — well-known roles first
        const role = matchRole(suffix, BUTTON_ROLES);
        if (role) {
          if (!this._entities[role]) this._entities[role] = id;
        } else if (suffix.includes('macro_')) {
          // Macro buttons
          const macroLabel = label(st, id)
            .replace(/^macro\s+/i, '')
            .trim();
          this._macros.push({ entity_id: id, label: macroLabel });
        } else if (suffix.startsWith('restart_') || suffix.startsWith('stop_') || suffix.startsWith('start_')) {
          // Service control buttons (restart_klipper, restart_moonraker, restart_crowsnest, etc.)
          this._serviceButtons.push({ entity_id: id, label: label(st, id) });
        }

      } else if (domain === 'camera') {
        if (suffix === 'thumbnail' || id.endsWith('_thumbnail')) {
          if (!this._entities.thumbnail) this._entities.thumbnail = id;
        }
        // Live cameras handled below
      }
    }

    // Sort macros by label
    this._macros.sort((a, b) => a.label.localeCompare(b.label));
    this._serviceButtons.sort((a, b) => a.label.localeCompare(b.label));

    // Core temp entity IDs (already in stats bar — exclude from misc heaters list)
    const coreTemps = new Set([this._entities.hotend, this._entities.bed].filter(Boolean));
    const coreTargets = new Set([this._entities.hotend_target, this._entities.bed_target].filter(Boolean));

    // Second pass: unclaimed temp sensors → heaters list
    for (const [sensorId, st, suffix] of remainingSensors) {
      if (coreTemps.has(sensorId)) continue;

      const targetId = sensorId
        .replace(/^sensor\./, 'number.')
        .replace(/_temperature$/, '_target')
        .replace(/_temp$/, '_target');

      if (coreTargets.has(targetId)) continue; // alias of hotend/bed

      const targetSt = this._hass.states[targetId];
      const lbl = label(st, sensorId);

      if (targetSt) {
        tempTargetIds.add(targetId);
        this._heaters.push({
          entity_id: sensorId,
          label: lbl,
          current: parseFloat(st.state) || null,
          target: parseFloat(targetSt.state) || null,
          min_temp: parseFloat(targetSt.attributes?.min ?? 0),
          max_temp: parseFloat(targetSt.attributes?.max ?? 300),
          target_entity: targetId,
          readonly: false,
        });
      } else {
        this._heaters.push({
          entity_id: sensorId,
          label: lbl,
          current: parseFloat(st.state) || null,
          target: null,
          min_temp: null,
          max_temp: null,
          target_entity: null,
          readonly: true,
        });
      }
    }

    // Fans/outputs: number entities matching fan/filter/exhaust/output_pin patterns,
    // not already claimed as a well-known role or temp target
    const claimedNumbers = new Set(Object.values(this._entities).filter(id => id?.startsWith('number.')));
    const fanPattern = /fan|filter|exhaust|output_pin/i;
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith('number.') || !id.includes(b)) continue;
      if (st.attributes?.hidden === true) continue;
      if (claimedNumbers.has(id) || tempTargetIds.has(id)) continue;
      if (!fanPattern.test(id)) continue;
      this._fans.push({
        entity_id: id,
        label: label(st, id),
        value: (st.state === 'unknown' || st.state === 'unavailable') ? 0 : (parseFloat(st.state) || 0),
        min: parseFloat(st.attributes?.min ?? 0),
        max: parseFloat(st.attributes?.max ?? 100),
        step: parseFloat(st.attributes?.step ?? 1),
        unit: st.attributes?.unit_of_measurement || '%',
      });
    }

    // Live cameras: auto-discover from hass.states, merge rotation from config
    const rotationConfig = {};
    for (const c of (this._config.cameras || [])) {
      const entry = typeof c === 'string' ? { entity: c, rotate: 0 } : c;
      if (entry.entity) rotationConfig[entry.entity] = entry.rotate || 0;
    }
    this._cameras = [];
    for (const [id, st] of Object.entries(this._hass.states)) {
      if (!id.startsWith('camera.') || !id.includes(b)) continue;
      if (st.attributes?.hidden === true) continue;
      if (id === this._entities.thumbnail) continue; // already claimed as thumbnail
      this._cameras.push({
        entity: id,
        label: label(st, id),
        rotate: rotationConfig[id] ?? 0,
      });
    }
    this._cameras.sort((a, b) => a.entity.localeCompare(b.entity));
  }

  _entitiesChanged(prev, next) {
    for (const id of Object.values(this._entities)) {
      if (!id) continue;
      if (prev.states[id] !== next.states[id]) return true;
    }
    // Track optional power switch
    const ps = this._config?.power_switch;
    if (ps && prev.states[ps] !== next.states[ps]) return true;
    for (const cam of this._cameras) {
      if (prev.states[cam.entity] !== next.states[cam.entity]) return true;
    }
    // Check macro/heater/fan entities (broad pass on base prefix)
    const b = this._config.base_entity;
    for (const id of Object.keys(next.states)) {
      if (id.includes(b) && prev.states[id] !== next.states[id]) return true;
    }
    return false;
  }

  _entityExists(key) {
    const id = this._entities[key];
    if (!id || !this._hass) return false;
    return !!this._hass.states[id];
  }

  _stVal(key) { return stVal(this._hass, this._entities[key]); }
  _numVal(key) { return numVal(this._hass, this._entities[key]); }

  // Combines printer_state (ready/startup/shutdown/error) with current_print_state (standby/printing/paused/complete/cancelled/error)
  _effectiveStatus() {
    const printerState = (this._stVal('printer_state') || '').toLowerCase();
    const printState = (this._stVal('status') || '').toLowerCase();
    if (printerState === 'error' || printerState === 'shutdown' || printerState === 'startup') return printerState;
    return printState || printerState || 'idle';
  }

  _isPrinting() {
    const s = this._effectiveStatus();
    return s === 'printing';
  }

  _isPaused() {
    const s = this._effectiveStatus();
    return s === 'paused';
  }

  // ── Animation ───────────────────────────────────────────────────────────────

  _startNozzleAnim() {
    if (this._animRunning) return;
    this._animRunning = true;
    const tick = () => {
      if (!this._isPrinting()) { this._animRunning = false; return; }
      this._nozzleX += this._nozzleDir * 0.004;
      if (this._nozzleX >= 1) { this._nozzleX = 1; this._nozzleDir = -1; }
      if (this._nozzleX <= 0) { this._nozzleX = 0; this._nozzleDir = 1; }
      const svgEl = this.shadowRoot.querySelector('.printer-svg-wrap');
      if (svgEl) {
        svgEl.innerHTML = renderPrinterSVG(
          this._config.printer_type,
          this._numVal('progress') || 0,
          this._numVal('hotend_target'),
          this._numVal('bed_target'),
          this._numVal('chamber_target') ?? this._heaters.find(h => h.entity_id?.toLowerCase().includes('chamber'))?.target ?? null,
          true,
          this._nozzleX
        );
      }
      this._animFrame = requestAnimationFrame(tick);
    };
    this._animFrame = requestAnimationFrame(tick);
  }

  _stopNozzleAnim() {
    this._animRunning = false;
    if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null; }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  _initialRender() {
    this.shadowRoot.innerHTML = `<style>${this._css()}</style><div class="card"></div>`;
    this.shadowRoot.addEventListener('click', this._bound_click);
    this.shadowRoot.addEventListener('input', this._bound_change);
    this.shadowRoot.addEventListener('change', this._bound_change);
    this.shadowRoot.addEventListener('pointerdown', this._bound_pointerdown);
    this.shadowRoot.addEventListener('pointerup', this._bound_pointerup);
    this.shadowRoot.addEventListener('pointercancel', this._bound_pointerup);
  }

  _onPointerDown(e) {
    if (e.target && e.target.type === 'range') this._dragging = true;
  }

  _onPointerUp(e) {
    if (!this._dragging) return;
    this._dragging = false;
    // Commit the slider value to HA on release
    const el = e.target;
    if (!el || el.type !== 'range') return;
    const val = parseFloat(el.value);
    if (el.dataset.action === 'set-fan') {
      this._hass.callService('number', 'set_value', { entity_id: el.dataset.entity, value: val });
    } else if (el.dataset.action === 'mv-speed-factor') {
      this._setNumber('speed_factor', val);
    }
  }

  _render() {
    if (!this._config || !this._hass) return;
    // Never blow away the DOM while the user is dragging a slider
    if (this._dragging) return;
    const card = this.shadowRoot.querySelector('.card');
    if (!card) return;

    // Resolve all entities from hass (single pass crawler)
    this._crawlEntities();

    const status = this._effectiveStatus();
    const mc = stateColor(status);
    card.style.setProperty('--mode-color', mc);
    card.style.setProperty('--chip-bg', hexA(mc, 0.15));

    card.innerHTML = this._html();

    if (this._isPrinting()) this._startNozzleAnim();
    else this._stopNozzleAnim();

    // Restore open sheet
    if (this._openSheet) {
      const sheet = this.shadowRoot.querySelector(`.sheet[data-sheet="${this._openSheet}"]`);
      const overlay = this.shadowRoot.querySelector('.overlay');
      if (sheet && overlay) { sheet.classList.add('open'); overlay.classList.add('visible'); }
    }

    // Restore camera accordion
    if (this._camerasOpen) {
      const section = this.shadowRoot.querySelector('.cameras-section');
      if (section) { section.classList.add('open'); this._wireCameraStreams(); }
    }

    // Thumbnail img: only show after onload (valid image); onerror shows fallback
    const thumbImg = this.shadowRoot.querySelector('.thumb-img');
    if (thumbImg) {
      thumbImg.onload = () => {
        if (this._thumbLoaded) return;
        this._thumbLoaded = true;
        this._thumbFailed = false;
        this._render();
      };
      thumbImg.onerror = () => {
        if (this._thumbFailed) return;
        this._thumbFailed = true;
        this._thumbLoaded = false;
        this._render();
      };
    }
  }

  // ── HTML template ───────────────────────────────────────────────────────────

  _html() {
    const cfg = this._config;
    const status = this._effectiveStatus();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    const progress = this._numVal('progress') || 0;
    const hotendTemp = this._numVal('hotend');
    const hotendTarget = this._numVal('hotend_target');
    const bedTemp = this._numVal('bed');
    const bedTarget = this._numVal('bed_target');
    const chamberHeater = this._heaters.find(h => h.entity_id && h.entity_id.toLowerCase().includes('chamber'));
    const chamberTemp = chamberHeater?.current ?? null;
    const durationSecs = durationVal(this._hass, this._entities.duration) ?? this._numVal('duration');
    const currentLayer = this._numVal('current_layer');
    const totalLayers = this._numVal('total_layers');
    const filename = this._stVal('filename');
    const speedFactor = this._numVal('speed_factor');
    const flowFactor = this._numVal('flow_factor');
    const filamentRaw = this._numVal('filament_used');
    const filamentUnit = attrVal(this._hass, this._entities.filament_used, 'unit_of_measurement');
    const filamentUsed = filamentRaw != null
      ? (filamentUnit === 'm' || filamentRaw < 100 ? filamentRaw : filamentRaw / 1000)
      : null;
    const isPrinting = this._isPrinting();
    const isPaused = this._isPaused();
    const isActive = isPrinting || isPaused;
    const movementDisabled = isPrinting && !isPaused; // disable home/jog when printing (allow when paused)

    // Thumbnail: only show after confirming the URL returns a valid image (onload); fall back to icon on error
    const thumbEntityId = this._entities.thumbnail;
    const thumbState = thumbEntityId ? this._hass.states[thumbEntityId] : null;
    const thumbToken = thumbState?.attributes?.access_token || '';
    const thumbT = Math.floor(Date.now() / 5000) * 5000; // 5s cache buster so URL is stable for load check
    const thumbSrc = thumbEntityId
      ? `${location.origin}/api/camera_proxy/${thumbEntityId}?token=${thumbToken}&t=${thumbT}`
      : '';
    if (!thumbEntityId || !(isPrinting || isPaused)) this._lastThumbSrc = null;
    else if (thumbSrc && this._lastThumbSrc !== thumbSrc) {
      this._lastThumbSrc = thumbSrc;
      this._thumbLoaded = false;
      this._thumbFailed = false;
    }
    const hasThumb = !!(thumbEntityId && (isPrinting || isPaused));
    const showThumb = hasThumb && this._thumbLoaded && !this._thumbFailed;

    // ETA — prefer parsed print_time_left; fallback to calculated from duration/progress
    let etaSecs = durationVal(this._hass, this._entities.eta) ?? this._numVal('eta');
    if (!etaSecs && durationSecs != null && progress > 0) {
      etaSecs = (durationSecs / (progress / 100)) - durationSecs;
    }

    const name = cfg.name || 'Printer';
    const cameras = this._cameras;
    const camCount = cameras.length;

    const hasMacros = this._macros.length > 0;
    const hasMovement = this._entityExists('home_all') || this._entityExists('home_x') || this._entityExists('position_x');
    const hasMisc = this._heaters.length > 0 || this._fans.length > 0 || this._entityExists('hotend') || this._entityExists('bed');
    const hasSystem = this._entityExists('fw_restart') || this._entityExists('host_restart') || this._entityExists('server_restart') || this._entityExists('host_shutdown') || this._entityExists('klipper_restart') || this._serviceButtons.length > 0;

    // Power switch (optional config entity)
    const powerEntityId = this._config.power_switch || null;
    const powerState = powerEntityId ? this._hass.states[powerEntityId] : null;
    const powerOn = powerState?.state === 'on';

    const layerStr = (currentLayer != null && totalLayers != null)
      ? `${Math.round(currentLayer)} / ${Math.round(totalLayers)}`
      : (currentLayer != null ? `Layer ${Math.round(currentLayer)}` : null);

    const hotendStr = hotendTemp != null
      ? (hotendTarget ? `${Math.round(hotendTemp)}°/${Math.round(hotendTarget)}°` : fmtTemp(hotendTemp))
      : null;
    const bedStr = bedTemp != null
      ? (bedTarget ? `${Math.round(bedTemp)}°/${Math.round(bedTarget)}°` : fmtTemp(bedTemp))
      : null;

    const hasPause    = this._entityExists('pause');
    const hasResume   = this._entityExists('resume');
    const hasCancel   = this._entityExists('cancel');
    const hasEmergency = this._entityExists('emergency');

    // Message banner — combine current_print_message and current_display_message; hide if both empty
    const printMsg = this._stVal('current_print_message');
    const displayMsg = this._stVal('current_display_message');
    const validMsg = (v) => v && v.toLowerCase() !== 'none' && isNaN(parseFloat(v));
    const parts = [printMsg, displayMsg].filter(validMsg);
    const msgText = parts.length > 0 ? parts.join(' · ') : null;
    const isErrorState = status.toLowerCase().includes('error') || status.toLowerCase().includes('cancel');
    const msgColor = stateColor(status);

    // Position values for movement sheet and SVG
    const posX = this._numVal('position_x');
    const posY = this._numVal('position_y');
    const posZ = this._numVal('position_z');

    return `
      <!-- Header -->
      <div class="header">
        <div class="printer-name">${name}</div>
        <div class="header-right">
          ${hasEmergency ? `<button class="power-btn estop-btn ${this._confirmEmergency ? 'estop-confirm' : ''}" data-action="emergency" title="${this._confirmEmergency ? 'Confirm emergency stop?' : 'Emergency Stop'}">${ICON_EMERGENCY}</button>` : ''}
          ${powerEntityId ? `<button class="power-btn ${powerOn ? 'power-on' : 'power-off'}" data-action="toggle-power" data-entity="${powerEntityId}" title="${powerOn ? 'Turn off printer' : 'Turn on printer'}">${ICON_POWER}</button>` : ''}
          <div class="state-chip">
            <span class="state-dot"></span>
            <span class="state-label">${statusLabel}</span>
          </div>
        </div>
      </div>

      <!-- Message banner -->
      ${msgText ? `<div class="msg-banner" style="background:${hexA(msgColor, 0.13)};border-color:${hexA(msgColor, 0.35)}">
        <span class="msg-icon">${isErrorState ? ICON_EMERGENCY : ICON_INFO}</span>
        <span class="msg-text">${msgText}</span>
      </div>` : ''}

      <!-- Printer SVG -->
      <div class="printer-section">
        <div class="printer-svg-wrap">
          ${renderPrinterSVG(cfg.printer_type, progress, hotendTarget, bedTarget, this._numVal('chamber_target') ?? chamberHeater?.target ?? null, isPrinting, this._nozzleX)}
        </div>
      </div>

      <!-- Stats bar -->
      <div class="stats-bar">
        ${hotendStr ? `<div class="stat-item">
          <span class="stat-icon">${ICON_HOTEND}</span>
          <span class="stat-val hotend-val">${hotendStr}</span>
          <span class="stat-label">Hotend</span>
        </div>` : ''}
        ${bedStr ? `<div class="stat-item">
          <span class="stat-icon">${ICON_BED}</span>
          <span class="stat-val bed-val">${bedStr}</span>
          <span class="stat-label">Bed</span>
        </div>` : ''}
        ${this._heaters.filter(h => !h.readonly && h.target_entity).map(h => {
          const cur = h.current != null ? Math.round(h.current) + '°' : '—';
          const val = h.target != null ? `${cur}/${Math.round(h.target)}°` : cur;
          return `<div class="stat-item">
          <span class="stat-icon">${ICON_THERMOMETER}</span>
          <span class="stat-val" style="color:#a78bfa">${val}</span>
          <span class="stat-label">${h.label}</span>
        </div>`;
        }).join('')}
        ${speedFactor != null ? `<div class="stat-item">
          <span class="stat-icon">${ICON_SPEED}</span>
          <span class="stat-val">${fmtPct(speedFactor)}</span>
          <span class="stat-label">Speed</span>
        </div>` : ''}
        ${flowFactor != null ? `<div class="stat-item">
          <span class="stat-icon">${ICON_FLOW}</span>
          <span class="stat-val">${fmtPct(flowFactor)}</span>
          <span class="stat-label">Flow</span>
        </div>` : ''}
      </div>

      <div class="sep"></div>

      <!-- Tile grid -->
      <div class="tiles">
        <!-- Progress tile -->
        <div class="tile tile-progress ${isActive ? '' : 'tile-dim'}">
          <div class="tile-arc">${progressArcSVG(progress)}</div>
          <div class="tile-info">
            <div class="tile-primary">${Math.round(progress)}%</div>
            ${layerStr ? `<div class="tile-secondary">${layerStr} layers</div>` : ''}
            ${filamentUsed != null ? `<div class="tile-secondary">${filamentUsed.toFixed(2)}m used</div>` : ''}
          </div>
        </div>

        <!-- ETA tile -->
        <div class="tile ${!isActive ? 'tile-dim' : ''}">
          <div class="tile-icon">${ICON_ETA}</div>
          <div class="tile-label">ETA</div>
          <div class="tile-value">
            ${etaSecs != null ? `<span class="mono">${fmtSeconds(etaSecs)}</span>` : '<span class="na">—</span>'}
          </div>
        </div>

        <!-- Elapsed tile -->
        <div class="tile ${!isActive ? 'tile-dim' : ''}">
          <div class="tile-icon">${ICON_ELAPSED}</div>
          <div class="tile-label">Elapsed</div>
          <div class="tile-value">
            ${durationSecs != null ? `<span class="mono">${fmtSeconds(durationSecs)}</span>` : '<span class="na">—</span>'}
          </div>
        </div>

        <!-- File tile — with optional thumbnail -->
        <div class="tile tile-file ${!filename ? 'tile-dim' : ''} ${hasThumb ? 'tile-has-thumb' : ''} ${isActive && showThumb ? 'tile-file-active' : ''}">
          ${hasThumb ? `<div class="thumb-wrap ${showThumb ? 'thumb-loaded' : ''} ${this._thumbFailed ? 'thumb-failed' : ''}">
            <img class="thumb-img" src="${thumbSrc}" alt="thumbnail"/>
            <div class="tile-icon thumb-fallback">${ICON_FILE}</div>
          </div>` : `<div class="tile-icon">${ICON_FILE}</div>`}
          <div class="tile-file-info">
            <div class="tile-label">File</div>
            <div class="tile-value tile-filename">
              ${filename ? `<span class="filename">${truncate(filename, 36)}</span>` : '<span class="na">—</span>'}
            </div>
          </div>
        </div>
      </div>

      <div class="sep"></div>

      <!-- Print controls (only when print is running) -->
      ${isActive && (hasPause || hasResume || hasCancel) ? `<div class="controls controls-print">
        ${isPrinting && hasPause ? `<button class="ctrl-btn ctrl-pause" data-action="pause">${ICON_PAUSE} Pause</button>` : ''}
        ${isPaused && hasResume ? `<button class="ctrl-btn ctrl-resume" data-action="resume">${ICON_PLAY} Resume</button>` : ''}
        ${hasCancel ? `<button class="ctrl-btn ctrl-cancel" data-action="cancel">${ICON_STOP} Cancel</button>` : ''}
      </div>` : ''}

      <!-- Other controls -->
      <div class="controls">
        ${hasMacros ? `<button class="ctrl-btn ctrl-tune" data-action="open-macros">${ICON_MACRO} Macros</button>` : ''}
        ${hasMovement ? `<button class="ctrl-btn ctrl-tune" data-action="open-movement">${ICON_MOVE} Move</button>` : ''}
        ${hasMisc ? `<button class="ctrl-btn ctrl-tune" data-action="open-misc">${ICON_THERMOMETER} Misc</button>` : ''}
        ${hasSystem ? `<button class="ctrl-btn ctrl-system" data-action="open-system">${ICON_MORE} More</button>` : ''}
      </div>

      <!-- Camera toggle button -->
      ${camCount > 0 ? `<button class="camera-btn ${this._camerasOpen ? 'active' : ''}" data-action="toggle-cameras">
        ${ICON_CAMERA}
        <span>Cameras</span>
        <span class="cam-badge">${camCount}</span>
        <span class="cam-chevron ${this._camerasOpen ? 'open' : ''}">${ICON_CHEVRON}</span>
      </button>
      <div class="cameras-section">
        <div class="camera-views">
          ${cameras.map((cam, i) => `<div class="cam-view">
            <div class="cam-label">${cam.label || `Camera ${i + 1}`}</div>
            <div class="cam-stream-wrap" style="--cam-rotate:${cam.rotate}deg">
              <ha-camera-stream class="cam-stream" data-cam-idx="${i}" allow-exoplayer muted></ha-camera-stream>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Overlay -->
      <div class="overlay" data-action="close-sheet"></div>

      <!-- Macros sheet -->
      ${hasMacros ? `<div class="sheet" data-sheet="macros">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${ICON_MACRO} Macros</div>
        <div class="sheet-scroll">
        <div class="macro-list ${movementDisabled ? 'disabled' : ''}">
          ${this._macros.map(m => `<button class="macro-btn" data-action="run-macro" data-entity="${m.entity_id}" ${movementDisabled ? 'disabled' : ''}>
            ${ICON_PLAY} ${m.label}
          </button>`).join('')}
        </div>
        </div>
      </div>` : ''}

      <!-- Movement sheet -->
      ${hasMovement ? `<div class="sheet" data-sheet="movement">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${ICON_MOVE} Movement</div>
        <div class="sheet-scroll">

        ${(posX != null || posY != null || posZ != null) ? `<div class="pos-bar ${movementDisabled ? 'disabled' : ''}">
          ${posX != null ? `<div class="pos-item"><span class="pos-axis pos-x">X</span><span class="pos-val mono">${posX.toFixed(1)}</span></div>` : ''}
          ${posY != null ? `<div class="pos-item"><span class="pos-axis pos-y">Y</span><span class="pos-val mono">${posY.toFixed(1)}</span></div>` : ''}
          ${posZ != null ? `<div class="pos-item"><span class="pos-axis pos-z">Z</span><span class="pos-val mono">${posZ.toFixed(1)}</span></div>` : ''}
        </div>` : ''}

        <div class="home-row ${movementDisabled ? 'disabled' : ''}">
          ${this._entityExists('home_all') ? `<button class="home-btn" data-action="home-axis" data-axis="all" ${movementDisabled ? 'disabled' : ''}>${ICON_HOME} All</button>` : ''}
          ${this._entityExists('home_x') ? `<button class="home-btn home-x" data-action="home-axis" data-axis="x" ${movementDisabled ? 'disabled' : ''}>X</button>` : ''}
          ${this._entityExists('home_y') ? `<button class="home-btn home-y" data-action="home-axis" data-axis="y" ${movementDisabled ? 'disabled' : ''}>Y</button>` : ''}
          ${this._entityExists('home_z') ? `<button class="home-btn home-z" data-action="home-axis" data-axis="z" ${movementDisabled ? 'disabled' : ''}>Z</button>` : ''}
        </div>

        <div class="jog-section ${movementDisabled ? 'disabled' : ''}">
          <!-- XY jog cross -->
          <div class="jog-xy">
            <div class="jog-xy-top">
              ${[100,10,1].map(d => `<button class="jog-btn" data-action="jog" data-axis="y" data-dist="${d}" ${movementDisabled ? 'disabled' : ''}>+${d}</button>`).join('')}
            </div>
            <div class="jog-xy-mid">
              ${[100,10,1].map(d => `<button class="jog-btn" data-action="jog" data-axis="x" data-dist="-${d}" ${movementDisabled ? 'disabled' : ''}>-${d}</button>`).join('')}
              <div class="jog-center">${ICON_MOVE}</div>
              ${[1,10,100].map(d => `<button class="jog-btn" data-action="jog" data-axis="x" data-dist="${d}" ${movementDisabled ? 'disabled' : ''}>+${d}</button>`).join('')}
            </div>
            <div class="jog-xy-bot">
              ${[1,10,100].map(d => `<button class="jog-btn" data-action="jog" data-axis="y" data-dist="-${d}" ${movementDisabled ? 'disabled' : ''}>-${d}</button>`).join('')}
            </div>
          </div>

          <!-- Z jog column -->
          <div class="jog-z">
            <div class="jog-z-label pos-z">Z</div>
            ${[10,1,0.1].map(d => `<button class="jog-btn jog-z-btn" data-action="jog" data-axis="z" data-dist="${d}" ${movementDisabled ? 'disabled' : ''}>+${d}</button>`).join('')}
            <div class="jog-z-sep"></div>
            ${[0.1,1,10].map(d => `<button class="jog-btn jog-z-btn" data-action="jog" data-axis="z" data-dist="-${d}" ${movementDisabled ? 'disabled' : ''}>-${d}</button>`).join('')}
          </div>
        </div>

        ${this._entityExists('speed_factor') ? `<div class="tune-row" style="margin-top:12px">
          <div class="tune-row-header">
            <span class="tune-row-label">${ICON_SPEED} Speed</span>
            <span class="tune-row-val mono" id="mv-speed-val">${fmtPct(speedFactor)}</span>
          </div>
          <input type="range" class="tune-slider" data-action="mv-speed-factor" min="10" max="200" step="1" value="${Math.round(speedFactor || 100)}"/>
        </div>` : ''}
        </div>
      </div>` : ''}

      <!-- Misc sheet (heaters + fans) -->
      ${hasMisc ? `<div class="sheet" data-sheet="misc">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${ICON_THERMOMETER} Misc</div>
        <div class="sheet-scroll">
        <div class="temps-body">

          ${(this._heaters.length > 0 || this._entityExists('hotend') || this._entityExists('bed')) ? `
          <div class="temps-section-label">Temperatures</div>
          ${this._entityExists('hotend') ? `<div class="temp-row">
            <div class="temp-row-info"><span class="temp-row-name">Hotend</span></div>
            <div class="temp-row-ctrl">
              <span class="temp-current mono">${hotendTemp != null ? hotendTemp.toFixed(1) + '°' : '—'}</span>
              ${this._entityExists('hotend_target') ? `
              <span class="temp-arrow">→</span>
              <input type="number" class="temp-input"
                data-action="set-temp"
                data-entity="${this._entities.hotend}"
                data-target-entity="${this._entities.hotend_target}"
                min="0" max="300" step="1"
                value="${hotendTarget != null ? Math.round(hotendTarget) : 0}"
              />
              <span class="temp-unit">°C</span>` : ''}
            </div>
          </div>` : ''}
          ${this._entityExists('bed') ? `<div class="temp-row">
            <div class="temp-row-info"><span class="temp-row-name">Bed</span></div>
            <div class="temp-row-ctrl">
              <span class="temp-current mono">${bedTemp != null ? bedTemp.toFixed(1) + '°' : '—'}</span>
              ${this._entityExists('bed_target') ? `
              <span class="temp-arrow">→</span>
              <input type="number" class="temp-input"
                data-action="set-temp"
                data-entity="${this._entities.bed}"
                data-target-entity="${this._entities.bed_target}"
                min="0" max="150" step="1"
                value="${bedTarget != null ? Math.round(bedTarget) : 0}"
              />
              <span class="temp-unit">°C</span>` : ''}
            </div>
          </div>` : ''}
          ${this._heaters.map(h => `<div class="temp-row">
            <div class="temp-row-info">
              <span class="temp-row-name">${h.label}</span>
              ${h.state != null ? `<span class="temp-row-state ${h.state !== 'off' ? 'temp-state-active' : ''}">${h.state}</span>` : ''}
            </div>
            <div class="temp-row-ctrl">
              <span class="temp-current mono">${h.current != null ? h.current.toFixed(1) + '°' : '—'}</span>
              ${h.readonly ? '' : `
              <span class="temp-arrow">→</span>
              <input type="number" class="temp-input"
                data-action="set-temp"
                data-entity="${h.entity_id}"
                data-target-entity="${h.target_entity || ''}"
                min="${h.min_temp}" max="${h.max_temp}" step="1"
                value="${h.target != null ? Math.round(h.target) : 0}"
              />
              <span class="temp-unit">°C</span>`}
            </div>
          </div>`).join('')}` : ''}

          ${this._fans.length > 0 ? `
          <div class="temps-section-label" style="margin-top:${this._heaters.length > 0 ? '14px' : '0'}">Fans &amp; Outputs</div>
          ${this._fans.map(f => `<div class="fan-row">
            <div class="fan-row-info">
              <span class="fan-name">${f.label}</span>
              <span class="fan-val mono" id="fan-val-${f.entity_id.replace(/\./g, '-')}">${f.value}${f.unit}</span>
            </div>
            <input type="range" class="tune-slider"
              data-action="set-fan"
              data-entity="${f.entity_id}"
              data-display="fan-val-${f.entity_id.replace(/\./g, '-')}"
              data-unit="${f.unit}"
              min="${f.min}" max="${f.max}" step="${f.step}"
              value="${f.value}"
            />
          </div>`).join('')}` : ''}

        </div>
        </div>
        </div>` : ''}

      <!-- System sheet -->
      ${hasSystem ? `<div class="sheet" data-sheet="system">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${ICON_MORE} System</div>
        <div class="sheet-scroll">
        <div class="system-body">

          ${(this._entityExists('fw_restart') || this._entityExists('klipper_restart')) ? `
          <div class="sys-section-label">Klipper Control</div>
          ${this._entityExists('klipper_restart') ? `<button class="system-btn" data-action="system-action" data-entity="${this._entities.klipper_restart}">${ICON_RESTART} Restart Klipper</button>` : ''}
          ${this._entityExists('fw_restart') ? `<button class="system-btn" data-action="system-action" data-entity="${this._entities.fw_restart}">${ICON_RESTART} Firmware Restart</button>` : ''}
          ` : ''}

          ${this._serviceButtons.length > 0 ? `
          <div class="sys-section-label">Service Control</div>
          ${this._serviceButtons.map(b => `<button class="system-btn system-btn-service" data-action="system-action" data-entity="${b.entity_id}">${ICON_RESTART} ${b.label}</button>`).join('')}
          ` : ''}

          ${(this._entityExists('host_restart') || this._entityExists('host_shutdown') || this._entityExists('server_restart')) ? `
          <div class="sys-section-label">Host Control</div>
          ${this._entityExists('server_restart') ? `<button class="system-btn" data-action="system-action" data-entity="${this._entities.server_restart}">${ICON_RESTART} Server Restart</button>` : ''}
          ${this._entityExists('host_restart') ? `<button class="system-btn system-btn-danger" data-action="system-action" data-entity="${this._entities.host_restart}">${ICON_EMERGENCY} Reboot Host</button>` : ''}
          ${this._entityExists('host_shutdown') ? `<button class="system-btn system-btn-danger" data-action="system-action" data-entity="${this._entities.host_shutdown}">${ICON_EMERGENCY} Shutdown Host</button>` : ''}
          ` : ''}

        </div>
        </div>
      </div>` : ''}
    `;
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  _onClick(e) {
    const el = e.composedPath().find(n => n.dataset && n.dataset.action);
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
      case 'toggle-cameras':  this._toggleCameras(); break;
      case 'toggle-power': {
        const pId = el.dataset.entity;
        if (pId) this._hass.callService('switch', 'toggle', { entity_id: pId });
        break;
      }
      case 'open-macros':     this._openSheetPanel('macros'); break;
      case 'open-movement':   this._openSheetPanel('movement'); break;
      case 'open-misc':       this._openSheetPanel('misc'); break;
      case 'open-system':     this._openSheetPanel('system'); break;
      case 'close-sheet':     this._closeSheet(); break;
      case 'pause':           this._pressButton('pause'); break;
      case 'resume':          this._pressButton('resume'); break;
      case 'cancel':          this._pressButton('cancel'); break;
      case 'emergency':       this._handleEmergency(); break;
      case 'run-macro':       this._runMacro(el.dataset.entity); break;
      case 'home-axis':       this._homeAxis(el.dataset.axis); break;
      case 'jog':             this._jog(el.dataset.axis, parseFloat(el.dataset.dist)); break;
      case 'system-action':   this._pressEntityButton(el.dataset.entity); break;
    }
  }

  _onChange(e) {
    const el = e.target;
    if (!el.dataset.action) return;
    const val = parseFloat(el.value);

    switch (el.dataset.action) {
      case 'mv-speed-factor': {
        const d = this.shadowRoot.querySelector('#mv-speed-val');
        if (d) d.textContent = `${val}%`;
        break;
      }
      case 'set-fan': {
        // Only update the display label during drag; service call fires on pointerup
        const displayId = el.dataset.display;
        const unit = el.dataset.unit || '%';
        const d = this.shadowRoot.querySelector(`#${displayId}`);
        if (d) d.textContent = `${val}${unit}`;
        break;
      }
      case 'set-temp': {
        if (e.type === 'change') {
          const targetEntity = el.dataset.targetEntity;
          if (targetEntity) {
            // sensor + number pair — set via number.set_value on the target entity
            this._hass.callService('number', 'set_value', { entity_id: targetEntity, value: val });
          } else {
            // climate entity — set via climate.set_temperature
            this._hass.callService('climate', 'set_temperature', {
              entity_id: el.dataset.entity,
              temperature: val,
            });
          }
        }
        break;
      }
    }
  }

  // ── Sheet management ────────────────────────────────────────────────────────

  _openSheetPanel(name) {
    this._openSheet = name;
    const sheet = this.shadowRoot.querySelector(`.sheet[data-sheet="${name}"]`);
    const overlay = this.shadowRoot.querySelector('.overlay');
    if (sheet) sheet.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (sheet) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const card = this.shadowRoot.querySelector('.card');
          if (!card) return;
          const cardRect = card.getBoundingClientRect();
          if (cardRect.bottom > window.innerHeight) {
            this.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 50);
      });
    }
  }

  _closeSheet() {
    this._openSheet = null;
    this.shadowRoot.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
    const overlay = this.shadowRoot.querySelector('.overlay');
    if (overlay) overlay.classList.remove('visible');
  }

  _toggleCameras() {
    this._camerasOpen = !this._camerasOpen;
    const section = this.shadowRoot.querySelector('.cameras-section');
    const btn = this.shadowRoot.querySelector('.camera-btn');
    const chevron = this.shadowRoot.querySelector('.cam-chevron');
    if (!section) return;
    if (this._camerasOpen) {
      section.classList.add('open');
      btn?.classList.add('active');
      chevron?.classList.add('open');
      this._wireCameraStreams();
    } else {
      section.classList.remove('open');
      btn?.classList.remove('active');
      chevron?.classList.remove('open');
    }
  }

  _wireCameraStreams() {
    this.shadowRoot.querySelectorAll('.cam-stream[data-cam-idx]').forEach(el => {
      const idx = parseInt(el.dataset.camIdx, 10);
      const cam = this._cameras[idx];
      if (!cam || !this._hass) return;
      const stateObj = this._hass.states[cam.entity];
      if (!stateObj) return;
      el.hass = this._hass;
      el.stateObj = stateObj;
    });
  }

  // ── Service calls ───────────────────────────────────────────────────────────

  _pressButton(key) {
    const id = this._entities[key];
    if (!id || !this._hass) return;
    this._hass.callService('button', 'press', { entity_id: id });
  }

  _pressEntityButton(entityId) {
    if (!entityId || !this._hass) return;
    this._hass.callService('button', 'press', { entity_id: entityId });
  }

  _setNumber(key, val) {
    const id = this._entities[key];
    if (!id || !this._hass) return;
    this._hass.callService('number', 'set_value', { entity_id: id, value: val });
  }

  _runMacro(entityId) {
    if (!entityId || !this._hass) return;
    this._hass.callService('button', 'press', { entity_id: entityId });
  }

  _homeAxis(axis) {
    const keyMap = { all: 'home_all', x: 'home_x', y: 'home_y', z: 'home_z' };
    this._pressButton(keyMap[axis]);
  }

  _jog(axis, dist) {
    if (!this._hass || !axis || isNaN(dist)) return;
    // Use moonraker REST API via HA script service or direct gcode service
    // Most moonraker integrations expose a script or button for relative moves.
    // We send a MOVE gcode via the moonraker.send_gcode HA service if available,
    // otherwise fall back to calling the firmware_restart as a no-op placeholder.
    const gcodeMap = { x: 'X', y: 'Y', z: 'Z' };
    const axis_letter = gcodeMap[axis.toLowerCase()];
    if (!axis_letter) return;
    const gcode = `G91\nG0 ${axis_letter}${dist} F3000\nG90`;
    // Try moonraker gcode service first
    if (this._hass.services?.moonraker?.send_gcode || this._hass.services?.klipper?.send_gcode) {
      const domain = this._hass.services?.moonraker?.send_gcode ? 'moonraker' : 'klipper';
      this._hass.callService(domain, 'send_gcode', { gcode });
    } else {
      // Fallback: call a HA script named <base>_jog_<axis>_<dist> if it exists
      const scriptId = `script.${this._config.base_entity}_jog`;
      if (this._hass.states[scriptId]) {
        this._hass.callService('script', 'turn_on', { entity_id: scriptId, variables: { axis, distance: dist } });
      }
    }
  }

  _handleEmergency() {
    if (!this._confirmEmergency) {
      this._confirmEmergency = true;
      this._render();
      this._confirmTimer = setTimeout(() => {
        this._confirmEmergency = false;
        this._render();
      }, 4000);
    } else {
      clearTimeout(this._confirmTimer);
      this._confirmEmergency = false;
      this._pressButton('emergency');
    }
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  _css() {
    return `
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

:host { display: block; }

.card {
  background: var(--card-background-color, var(--ha-card-background-color, #1c1c1e));
  border-radius: var(--ha-card-border-radius, 12px);
  box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.35));
  padding: 16px;
  font-family: var(--primary-font-family, Roboto, sans-serif);
  color: var(--primary-text-color);
  overflow: hidden;
  position: relative;
}

/* ── Message banner ── */
.msg-banner { display:flex; align-items:flex-start; gap:8px; margin:-4px 0 10px; padding:9px 12px; border-radius:8px; border:1px solid transparent; }
.msg-icon { color:var(--primary-text-color); flex-shrink:0; margin-top:1px; opacity:.8; }
.msg-text { font-size:.82rem; font-weight:500; color:var(--primary-text-color); line-height:1.4; word-break:break-word; }

/* ── Header ── */
.header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.header-right { display:flex; align-items:center; gap:8px; }
/* Power button */
.power-btn { display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; border:1.5px solid; cursor:pointer; background:transparent; transition:all .18s; padding:0; }
.power-on  { border-color:rgba(76,175,80,.5); color:#4caf50; }
.power-on:hover  { background:rgba(76,175,80,.15); border-color:#4caf50; }
.power-off { border-color:rgba(var(--rgb-secondary-text-color,130,130,130),.4); color:var(--secondary-text-color); }
.power-off:hover { background:rgba(244,67,54,.1); border-color:#f44336; color:#f44336; }
.estop-btn { border-color:rgba(244,67,54,.45); color:#ff6b6b; }
.estop-btn:hover { background:rgba(244,67,54,.15); border-color:#f44336; }
.estop-confirm { background:rgba(244,67,54,.4) !important; color:#fff !important; border-color:#f44336 !important; animation:pulse-red .6s ease infinite; }
.printer-name { font-size:1.05rem; font-weight:600; letter-spacing:.02em; }
.state-chip { display:flex; align-items:center; gap:6px; background:var(--chip-bg); border:1px solid var(--mode-color); border-radius:20px; padding:4px 10px; }
.state-dot { width:7px; height:7px; border-radius:50%; background:var(--mode-color); flex-shrink:0; }
.state-label { font-size:.78rem; font-weight:600; color:var(--mode-color); letter-spacing:.04em; text-transform:uppercase; }

/* ── Printer SVG ── */
.printer-section { display:flex; justify-content:center; align-items:center; margin:8px 0; }
.printer-svg-wrap { width:100%; max-width:200px; height:180px; }

/* ── Stats bar ── */
.stats-bar { display:flex; justify-content:space-around; gap:4px; margin:8px 0 12px; flex-wrap:wrap; }
.stat-item { display:flex; flex-direction:column; align-items:space-between; gap:2px; flex:1; min-width:56px; }
.stat-icon { color:var(--secondary-text-color); line-height:1; opacity:.7; text-align:center;}
.stat-val { font-family:'Share Tech Mono',monospace; font-size:.85rem; font-weight:600; color:var(--primary-text-color); text-align:center;}
.hotend-val { color:#ff8c66; }
.bed-val    { color:#66b2ff; }
.stat-label { font-size:.68rem; color:var(--secondary-text-color); opacity:.7; text-transform:uppercase; letter-spacing:.06em; text-align:center; }

/* ── Separator ── */
.sep { height:1px; background:var(--divider-color,rgba(255,255,255,.08)); margin:8px 0; }

/* ── Tiles ── */
.tiles { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:8px 0; }
.tile { background:var(--secondary-background-color,rgba(255,255,255,.04)); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:4px; transition:opacity .3s; }
.tile-dim { opacity:.45; }
.tile-progress { grid-column:span 2; flex-direction:row; align-items:center; gap:12px; }
.tile-arc { flex-shrink:0; }
.tile-info { display:flex; flex-direction:column; gap:2px; }
.tile-primary { font-family:'Share Tech Mono',monospace; font-size:1.4rem; font-weight:700; color:var(--mode-color); }
.tile-secondary { font-size:.78rem; color:var(--secondary-text-color); opacity:.75; }
.tile-icon { color:var(--mode-color); opacity:.8; line-height:1; }
.tile-label { font-size:.68rem; color:var(--secondary-text-color); opacity:.65; text-transform:uppercase; letter-spacing:.06em; }
.tile-value { font-size:.88rem; font-weight:600; margin-top:2px; }
.tile-sub { font-size:.72rem; color:var(--secondary-text-color); opacity:.65; }
.tile-filename { overflow:hidden; }
.filename { font-size:.78rem; font-family:'Share Tech Mono',monospace; word-break:break-all; }

/* ── File tile with thumbnail ── */
.tile-file { grid-column: span 2; flex-direction: row; align-items: center; gap: 10px; }
.tile-has-thumb { }
.tile-file-active .thumb-img { width: 100px; height: 76px; }
.thumb-wrap { position:relative; flex-shrink:0; }
.thumb-wrap .thumb-img { display:none; }
.thumb-wrap .thumb-fallback { display:flex; width:72px; height:56px; align-items:center; justify-content:center; border-radius:6px; background:rgba(0,0,0,.2); }
.thumb-wrap.thumb-loaded .thumb-img { display:block; }
.thumb-wrap.thumb-loaded .thumb-fallback { display:none; }
.thumb-wrap.thumb-failed .thumb-img { display:none; }
.thumb-wrap.thumb-failed .thumb-fallback { display:flex; }
.tile-file-active .thumb-wrap .thumb-fallback { width:100px; height:76px; }
.thumb-img { width: 72px; height: 56px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: rgba(0,0,0,.3); }
.tile-file-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }

.mono { font-family:'Share Tech Mono',monospace; }
.na { opacity:.35; }

/* ── Controls ── */
.controls { display:flex; gap:8px; flex-wrap:wrap; margin:8px 0; justify-content:center; }
.ctrl-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; border:none; cursor:pointer; font-family:var(--primary-font-family,Roboto,sans-serif); font-size:.82rem; font-weight:600; transition:all .18s; background:var(--secondary-background-color,rgba(255,255,255,.06)); color:var(--primary-text-color); }
.ctrl-btn:hover { filter:brightness(1.2); }
.ctrl-btn:active { transform:scale(0.97); }
.ctrl-pause    { background:rgba(229,192,0,.15); color:#e5c000; border:1px solid rgba(229,192,0,.3); }
.ctrl-resume   { background:rgba(76,175,80,.15); color:#4caf50; border:1px solid rgba(76,175,80,.3); }
.ctrl-cancel   { background:rgba(244,67,54,.15); color:#f44336; border:1px solid rgba(244,67,54,.3); }
.ctrl-emergency { background:rgba(244,67,54,.12); color:#ff6b6b; border:1px solid rgba(244,67,54,.25); }
.ctrl-emergency.confirm { background:rgba(244,67,54,.4); color:#fff; border-color:#f44336; animation:pulse-red .6s ease infinite; }
.ctrl-tune { background:var(--chip-bg); color:var(--mode-color); border:1px solid var(--mode-color); }
@keyframes pulse-red { 0%,100% { box-shadow:0 0 0 0 rgba(244,67,54,.5); } 50% { box-shadow:0 0 0 6px rgba(244,67,54,0); } }

/* ── Camera button ── */
.camera-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:10px; margin-top:4px; border-radius:10px; border:1px solid var(--divider-color,rgba(255,255,255,.1)); background:var(--secondary-background-color,rgba(255,255,255,.04)); color:var(--primary-text-color); cursor:pointer; font-family:var(--primary-font-family,Roboto,sans-serif); font-size:.88rem; font-weight:600; transition:all .18s; }
.camera-btn:hover, .camera-btn.active { background:var(--chip-bg); border-color:var(--mode-color); color:var(--mode-color); }
.cam-badge { background:var(--mode-color); color:var(--card-background-color,#1c1c1e); border-radius:10px; font-size:.72rem; font-weight:700; padding:1px 7px; min-width:18px; text-align:center; }
.cam-chevron { margin-left:auto; display:flex; align-items:center; transition:transform .25s cubic-bezier(.4,0,.2,1); }
.cam-chevron.open { transform:rotate(180deg); }
.cameras-section { overflow:hidden; max-height:0; transition:max-height .4s cubic-bezier(.4,0,.2,1); }
.cameras-section.open { max-height:9999px; }

/* ── Overlay ── */
.overlay { position:absolute; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(2px); opacity:0; pointer-events:none; transition:opacity .25s; z-index:10; border-radius:var(--ha-card-border-radius,12px); }
.overlay.visible { opacity:1; pointer-events:all; }

/* ── Bottom sheet ── */
.sheet { position:absolute; left:0; right:0; bottom:0; background:var(--card-background-color,#1c1c1e); border-radius:16px 16px 0 0; padding:12px 16px 24px; z-index:20; transform:translateY(100%); transition:transform .3s cubic-bezier(.4,0,.2,1); box-shadow:0 -4px 24px rgba(0,0,0,.4); max-height:72vh; display:flex; flex-direction:column; }
.sheet.open { transform:translateY(0); }
.sheet-handle { width:36px; height:4px; background:var(--divider-color,rgba(255,255,255,.15)); border-radius:2px; margin:0 auto 12px; flex-shrink:0; }
.sheet-title { display:flex; align-items:center; gap:8px; font-size:.95rem; font-weight:600; margin-bottom:16px; color:var(--mode-color); flex-shrink:0; }
.sheet-scroll { flex:1; overflow-y:auto; padding-bottom:20px; }

/* ── Camera views ── */
.camera-views { display:flex; flex-direction:column; gap:12px; padding-top:8px; }
.cam-view { border-radius:10px; overflow:hidden; background:rgba(0,0,0,.3); }
.cam-label { font-size:.72rem; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--secondary-text-color); padding:6px 10px 4px; opacity:.7; }
.cam-stream-wrap { overflow:hidden; border-radius:0 0 10px 10px; aspect-ratio:16/9; background:#000; position:relative; }
.cam-stream { display:block; width:100%; height:100%; transform:rotate(var(--cam-rotate,0deg)); transform-origin:center center; }
.cam-stream-wrap[style*="90deg"] .cam-stream, .cam-stream-wrap[style*="270deg"] .cam-stream { transform:rotate(var(--cam-rotate,0deg)) scale(1.78); }

/* ── Tune rows (speed/flow sheet) ── */
.tune-rows { display:flex; flex-direction:column; gap:16px; }
.tune-row {}
.tune-row-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.tune-row-label { display:flex; align-items:center; gap:6px; font-size:.85rem; font-weight:600; color:var(--secondary-text-color); }
.tune-row-val { font-size:.88rem; font-weight:700; color:var(--mode-color); }
.tune-slider { width:99%; appearance:none; height:4px; border-radius:2px; background:var(--divider-color,rgba(255,255,255,.15)); outline:none; cursor:pointer; accent-color:var(--mode-color); }
.tune-slider::-webkit-slider-thumb { appearance:none; width:18px; height:18px; border-radius:50%; background:var(--mode-color); cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.4); }

/* ── Macros sheet ── */
.macro-list { display:flex; flex-direction:column; gap:6px; max-height:55vh; overflow-y:auto; }
.macro-btn { display:flex; align-items:center; gap:8px; width:100%; padding:10px 14px; border-radius:8px; border:1px solid var(--divider-color,rgba(255,255,255,.1)); background:var(--secondary-background-color,rgba(255,255,255,.04)); color:var(--primary-text-color); cursor:pointer; font-family:var(--primary-font-family,Roboto,sans-serif); font-size:.85rem; font-weight:600; text-align:left; transition:all .18s; }
.macro-btn:hover { background:var(--chip-bg); border-color:var(--mode-color); color:var(--mode-color); }
.macro-btn:active { transform:scale(0.98); }

/* ── Movement sheet ── */
.pos-bar { display:flex; gap:16px; margin-bottom:14px; padding:8px 12px; background:var(--secondary-background-color,rgba(255,255,255,.04)); border-radius:8px; }
.pos-item { display:flex; align-items:center; gap:6px; }
.pos-axis { font-size:.75rem; font-weight:700; padding:2px 5px; border-radius:4px; }
.pos-x { background:rgba(244,67,54,.2); color:#f44336; }
.pos-y { background:rgba(76,175,80,.2); color:#4caf50; }
.pos-z { background:rgba(33,150,243,.2); color:#2196f3; }
.pos-val { font-size:.85rem; font-weight:600; }

.home-row { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px; }
.home-btn { display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:8px; border:1px solid var(--divider-color,rgba(255,255,255,.1)); background:var(--secondary-background-color,rgba(255,255,255,.04)); color:var(--primary-text-color); cursor:pointer; font-family:var(--primary-font-family,Roboto,sans-serif); font-size:.82rem; font-weight:600; transition:all .18s; }
.home-btn:hover { background:var(--chip-bg); border-color:var(--mode-color); color:var(--mode-color); }
.home-x { color:#f44336; border-color:rgba(244,67,54,.3); background:rgba(244,67,54,.08); }
.home-y { color:#4caf50; border-color:rgba(76,175,80,.3); background:rgba(76,175,80,.08); }
.home-z { color:#2196f3; border-color:rgba(33,150,243,.3); background:rgba(33,150,243,.08); }

.jog-section { display:flex; gap:12px; align-items:flex-start; }
.jog-xy { display:flex; flex-direction:column; gap:4px; flex:1; }
.jog-xy-top, .jog-xy-bot { display:flex; gap:4px; justify-content:center; }
.jog-xy-mid { display:flex; gap:4px; align-items:center; justify-content:center; }
.jog-center { display:flex; align-items:center; justify-content:center; width:36px; height:36px; opacity:.4; flex-shrink:0; }

.jog-z { display:flex; flex-direction:column; gap:4px; align-items:center; width:52px; flex-shrink:0; }
.jog-z-label { font-size:.75rem; font-weight:700; padding:2px 8px; border-radius:4px; background:rgba(33,150,243,.2); color:#2196f3; margin-bottom:2px; }
.jog-z-sep { height:4px; }

.jog-btn { padding:5px 7px; border-radius:6px; border:1px solid var(--divider-color,rgba(255,255,255,.1)); background:var(--secondary-background-color,rgba(255,255,255,.04)); color:var(--primary-text-color); cursor:pointer; font-family:'Share Tech Mono',monospace; font-size:.72rem; font-weight:600; transition:all .15s; min-width:32px; text-align:center; }
.jog-btn:hover { background:var(--chip-bg); border-color:var(--mode-color); color:var(--mode-color); }
.jog-btn:active { transform:scale(0.95); }
.jog-z-btn { width:100%; }
.jog-section.disabled, .home-row.disabled, .pos-bar.disabled, .macro-list.disabled { opacity:.5; pointer-events:none; }

/* ── Temps & Fans sheet ── */
.temps-body { display:flex; flex-direction:column; gap:0; }
.temps-section-label { font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--secondary-text-color); opacity:.6; margin-bottom:6px; }

.temp-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 0; border-bottom:1px solid var(--divider-color,rgba(255,255,255,.06)); }
.temp-row-info { display:flex; flex-direction:column; gap:1px; min-width:0; }
.temp-row-name { font-size:.85rem; font-weight:600; }
.temp-row-state { font-size:.7rem; color:var(--secondary-text-color); opacity:.6; text-transform:uppercase; }
.temp-state-active { color:#ff8c66; opacity:1; }
.temp-arrow { font-size:.75rem; color:var(--secondary-text-color); opacity:.4; }
.temp-row-ctrl { display:flex; align-items:center; gap:6px; flex-shrink:0; }
.temp-current { font-size:.85rem; color:var(--mode-color); min-width:42px; text-align:right; }
.temp-input { width:52px; padding:4px 6px; border-radius:6px; border:1px solid var(--divider-color,rgba(255,255,255,.15)); background:var(--secondary-background-color,rgba(255,255,255,.06)); color:var(--primary-text-color); font-family:'Share Tech Mono',monospace; font-size:.85rem; text-align:center; outline:none; }
.temp-input:focus { border-color:var(--mode-color); }
.temp-unit { font-size:.75rem; color:var(--secondary-text-color); opacity:.6; }

.fan-row { padding:8px 0; border-bottom:1px solid var(--divider-color,rgba(255,255,255,.06)); }
.fan-row-info { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.fan-name { font-size:.85rem; font-weight:600; }
.fan-val { font-size:.82rem; color:var(--mode-color); }

/* ── System sheet ── */
.system-body { display:flex; flex-direction:column; gap:6px; }
.sys-section-label { font-size:.7rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--secondary-text-color); opacity:.55; margin-top:10px; margin-bottom:2px; padding:0 2px; }
.sys-section-label:first-child { margin-top:0; }
.system-warning { font-size:.75rem; color:var(--secondary-text-color); opacity:.65; margin-bottom:4px; padding:7px 10px; border-radius:6px; background:rgba(244,67,54,.06); border:1px solid rgba(244,67,54,.15); }
.ctrl-system { background:rgba(244,67,54,.08); color:#ff6b6b; border:1px solid rgba(244,67,54,.2); }
.system-btn { display:flex; align-items:center; gap:8px; width:100%; padding:10px 14px; border-radius:8px; border:1px solid rgba(var(--rgb-primary-text-color,200,200,200),.12); background:rgba(var(--rgb-primary-text-color,200,200,200),.05); color:var(--primary-text-color); cursor:pointer; font-family:var(--primary-font-family,Roboto,sans-serif); font-size:.85rem; font-weight:500; text-align:left; transition:all .18s; }
.system-btn:hover { background:rgba(var(--rgb-primary-text-color,200,200,200),.1); }
.system-btn:active { transform:scale(0.98); }
.system-btn-service { color:var(--secondary-text-color); font-weight:400; }
.system-btn-danger { border-color:rgba(244,67,54,.3); background:rgba(244,67,54,.06); color:#ff6b6b; font-weight:600; }
.system-btn-danger:hover { background:rgba(244,67,54,.18); border-color:#f44336; }
    `;
  }

  getCardSize() { return 6; }
}

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
const ICON_HOTEND = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32-2.59 2.08-3.61 5.75-2.39 8.9.04.1.08.2.08.33 0 .22-.15.42-.35.5-.23.1-.47.04-.66-.12a.6.6 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5.14.6.41 1.2.71 1.73 1.08 1.73 2.95 2.97 4.96 3.22 2.14.27 4.43-.12 6.07-1.6 1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6-1.12.4-2.24-.16-2.9-.82 1.19-.28 1.9-1.16 2.11-2.05.17-.8-.15-1.46-.28-2.23-.12-.74-.1-1.37.17-2.06.19.38.39.76.63 1.06.77 1 1.98 1.44 2.24 2.8.04.14.06.28.06.43.03.82-.33 1.72-.93 2.27"/></svg>`;
const ICON_BED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 7H5v2H3V4H1v16h2v-3h18v3h2V11a4 4 0 0 0-4-4m-8 4H7v-2h4zm6 0h-4v-2h4z"/></svg>`;
const ICON_SPEED = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`;
const ICON_FLOW = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m1 14.93V15a1 1 0 0 0-2 0v1.93A8 8 0 0 1 4.07 11H6a1 1 0 0 0 0-2H4.07A8 8 0 0 1 11 4.07V6a1 1 0 0 0 2 0V4.07A8 8 0 0 1 19.93 11H18a1 1 0 0 0 0 2h1.93A8 8 0 0 1 13 16.93M12 11a1 1 0 1 0 1 1 1 1 0 0 0-1-1"/></svg>`;
const ICON_ETA = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const ICON_ELAPSED = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20a8 8 0 0 0 8-8 8 8 0 0 0-8-8 8 8 0 0 0-8 8 8 8 0 0 0 8 8m0-18a10 10 0 0 1 10 10 10 10 0 0 1-10 10C6.47 22 2 17.5 2 12A10 10 0 0 1 12 2m.5 5v5.25l4.5 2.67-.75 1.23L11 13V7z"/></svg>`;
const ICON_FILE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm4 18H6V4h7v5h5z"/></svg>`;
const ICON_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M14 19h4V5h-4M6 19h4V5H6v14z"/></svg>`;
const ICON_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_STOP = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 18H6V6h12v12z"/></svg>`;
const ICON_EMERGENCY = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2 1 21z"/></svg>`;
const ICON_CAMERA = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m8 3a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5m0 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3z"/></svg>`;
const ICON_TUNE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17v2h6v-2H3M3 5v2h10V5H3m10 16v-2h8v-2h-8v-2h-2v6h2M7 9v2H3v2h4v2h2V9H7m14 4v-2H11v2h10m-6-4h2V7h4V5h-4V3h-2v6z"/></svg>`;
const ICON_CHEVRON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
const ICON_MACRO = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2H3v2h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2v-2H8v-5a2 2 0 0 0-2-2 2 2 0 0 0 2-2V5h2V3zm8 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5h-2V3z"/></svg>`;
const ICON_MOVE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 6v5h5l-6 6-6-6h5V6h2M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10A10 10 0 0 1 2 12 10 10 0 0 1 12 2m0 2a8 8 0 0 0-8 8 8 8 0 0 0 8 8 8 8 0 0 0 8-8 8 8 0 0 0-8-8z"/></svg>`;
const ICON_THERMOMETER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0m-3-9a1 1 0 0 1 1 1v3h-2V5a1 1 0 0 1 1-1z"/></svg>`;
const ICON_HOME = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
const ICON_INFO = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/></svg>`;
const ICON_MORE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m0-6a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2m0-6a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2z"/></svg>`;
const ICON_POWER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.56 5.44l-1.45 1.45A6.97 6.97 0 0 1 17 12a5 5 0 0 1-5 5 5 5 0 0 1-5-5c0-2.04 1.1-3.8 2.71-4.77L8.27 5.79A8.97 8.97 0 0 0 5 12a7 7 0 0 0 7 7 7 7 0 0 0 7-7c0-2.57-1.36-4.81-3.44-6.11zM13 3h-2v10h2V3z"/></svg>`;
const ICON_RESTART = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 0 0-8 8 8 8 0 0 0 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18a6 6 0 0 1-6-6 6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;

// ── Register ──────────────────────────────────────────────────────────────────
customElements.define(CARD_TAG, PrinterCard3D);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: '3D Printer Card',
  description: 'A feature-rich card for Moonraker-based 3D printers with animated SVG visualization.',
  preview: false,
});
