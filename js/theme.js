/* NaLinha — Theme Toggle (dark/light) + Segment Themes + Custom Accent */

// Cores padrão de cada segmento (deve bater com style.css)
var SEGMENT_DEFAULTS = {
  academia: '#d4a853',
  estetica: '#e91e8c',
  sobrancelha: '#c4956a',
  unha: '#a855f7',
  salao: '#b76e79'
};

(function() {
  // Tema claro/escuro
  var saved = localStorage.getItem('nalinha_theme');
  if (!saved) {
    saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Segmento (academia, estetica, sobrancelha, unha, salao)
  var seg = localStorage.getItem('nalinha_segment') || 'academia';
  if (seg && seg !== 'academia') {
    document.documentElement.setAttribute('data-segment', seg);
  }

  // Cor personalizada — só aplica inline se for diferente do padrão do segmento
  var customColor = localStorage.getItem('nalinha_accent');
  var segDefault = SEGMENT_DEFAULTS[seg] || SEGMENT_DEFAULTS.academia;
  if (customColor && customColor.toLowerCase() !== segDefault.toLowerCase()) {
    applyInlineAccent(customColor);
  }
})();

function applyInlineAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--verde-acao', color);
  document.documentElement.style.setProperty('--accent-hover', darkenColor(color, 15));
  document.documentElement.style.setProperty('--accent-avatar', darkenColor(color, 25));
  document.documentElement.style.setProperty('--accent-soft', hexToRgba(color, 0.10));
  document.documentElement.style.setProperty('--accent-border', hexToRgba(color, 0.20));
}

function clearInlineAccent() {
  ['--accent', '--verde-acao', '--accent-hover', '--accent-avatar', '--accent-soft', '--accent-border'].forEach(function(p) {
    document.documentElement.style.removeProperty(p);
  });
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'light' ? 'dark' : 'light';
  if (next === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('nalinha_theme', next);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = next === 'light' ? '#f5f5f5' : '#000000';
  return next;
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function setSegment(seg) {
  localStorage.setItem('nalinha_segment', seg || 'academia');
  if (seg && seg !== 'academia') {
    document.documentElement.setAttribute('data-segment', seg);
  } else {
    document.documentElement.removeAttribute('data-segment');
  }
  // Limpar inline accent pra deixar o CSS do segmento resolver
  clearInlineAccent();
  // Atualizar localStorage accent pro padrão do segmento
  var segDefault = SEGMENT_DEFAULTS[seg] || SEGMENT_DEFAULTS.academia;
  localStorage.setItem('nalinha_accent', segDefault);
}

function setAccentColor(color) {
  if (!color) {
    localStorage.removeItem('nalinha_accent');
    clearInlineAccent();
    return;
  }
  localStorage.setItem('nalinha_accent', color);
  // Só aplica inline se for diferente do padrão do segmento atual
  var seg = localStorage.getItem('nalinha_segment') || 'academia';
  var segDefault = SEGMENT_DEFAULTS[seg] || SEGMENT_DEFAULTS.academia;
  if (color.toLowerCase() !== segDefault.toLowerCase()) {
    applyInlineAccent(color);
  } else {
    clearInlineAccent();
  }
}

// Sync com settings do shop (chamar após carregar shop)
function syncThemeFromSettings(settings) {
  if (!settings) return;
  if (settings.segmento) setSegment(settings.segmento);
  if (settings.accent_color) setAccentColor(settings.accent_color);
}

// Escurecer cor hex
function darkenColor(hex, pct) {
  hex = hex.replace('#', '');
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.floor(r * (1 - pct / 100)));
  g = Math.max(0, Math.floor(g * (1 - pct / 100)));
  b = Math.max(0, Math.floor(b * (1 - pct / 100)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Hex pra rgba
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}
