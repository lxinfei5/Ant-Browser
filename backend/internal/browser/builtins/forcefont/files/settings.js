/* Force Font shared settings (content script + popup). Isolated world only. */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'forceFontSettings';
  const USER_SETTINGS_FILE = 'user-settings.json';
  const CJK_ALIAS = 'FF CJK';

  const CJK_UNICODE_RANGE =
    'U+2E80-2EFF, U+3000-303F, U+3400-4DBF, U+4E00-9FFF, ' +
    'U+F900-FAFF, U+FF00-FFEF, U+20000-2A6DF, ' +
    'U+2013-2014, U+2018-201D, U+2026';

  const CJK_TAIL = [
    '"Microsoft YaHei"',
    '"Microsoft YaHei UI"',
    '"PingFang SC"',
    '"Hiragino Sans GB"',
    '"Noto Sans CJK SC"',
    '"Source Han Sans SC"',
    '"WenQuanYi Micro Hei"',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Noto Color Emoji"',
    '"Segoe UI Symbol"',
    'sans-serif'
  ];

  const PRESETS = {
    default: {
      latinFont: 'Monaco',
      latinFallbacks: ['Consolas'],
      cjkFont: 'Microsoft YaHei',
      cjkLocals: {
        300: ['Microsoft YaHei Light'],
        400: ['Microsoft YaHei'],
        700: ['Microsoft YaHei Bold']
      },
      cjkSizeAdjust: '95%'
    },
    typewriter: {
      latinFont: 'American Typewriter',
      latinFallbacks: ['Georgia', 'Times New Roman'],
      cjkFont: 'Source Han Serif SC',
      cjkLocals: {
        300: [
          'Source Han Serif SC Light',
          'Source Han Serif CN Light',
          'Noto Serif CJK SC Light',
          '思源宋体 Light'
        ],
        400: [
          'Source Han Serif SC',
          'Source Han Serif CN',
          'Noto Serif CJK SC',
          '思源宋体',
          'Songti SC'
        ],
        700: [
          'Source Han Serif SC Bold',
          'Source Han Serif CN Bold',
          'Noto Serif CJK SC Bold',
          '思源宋体 Bold'
        ]
      },
      cjkSizeAdjust: '98%'
    }
  };

  function sanitizeFontName(name) {
    const value = String(name || '').trim();
    if (!value || value.length > 80) return '';
    if (!/^[\w\u0080-\uFFFF][\w\u0080-\uFFFF .+\-]*$/u.test(value)) {
      return '';
    }
    return value;
  }

  function quoteFont(name) {
    const safe = sanitizeFontName(name);
    return safe ? `"${safe}"` : '';
  }

  function normalizeSizeAdjust(value, fallback) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(\d{2,3})%?$/);
    if (!match) return fallback;
    const n = Number(match[1]);
    if (n < 80 || n > 120) return fallback;
    return `${n}%`;
  }

  function presetNames(preset) {
    return PRESETS[preset] || PRESETS.default;
  }

  function normalize(raw) {
    const input = raw && typeof raw === 'object' ? raw : {};
    let preset = String(input.preset || '').trim();
    if (preset !== 'typewriter' && preset !== 'custom') {
      preset = 'default';
    }

    if (preset === 'custom') {
      const latinFont = sanitizeFontName(input.latinFont) || PRESETS.default.latinFont;
      const cjkFont = sanitizeFontName(input.cjkFont) || PRESETS.default.cjkFont;
      return {
        preset,
        latinFont,
        latinFallbacks: ['Consolas', 'Georgia'],
        cjkFont,
        cjkLocals: {
          300: [`${cjkFont} Light`, cjkFont],
          400: [cjkFont],
          700: [`${cjkFont} Bold`, cjkFont]
        },
        cjkSizeAdjust: normalizeSizeAdjust(input.cjkSizeAdjust, '95%'),
        updatedAt: String(input.updatedAt || '')
      };
    }

    const named = presetNames(preset);
    return {
      preset,
      latinFont: named.latinFont,
      latinFallbacks: named.latinFallbacks.slice(),
      cjkFont: named.cjkFont,
      cjkLocals: named.cjkLocals,
      cjkSizeAdjust: named.cjkSizeAdjust,
      updatedAt: String(input.updatedAt || '')
    };
  }

  function defaultSettings() {
    return normalize({ preset: 'default' });
  }

  function timestampMs(value) {
    const ms = Date.parse(String(value || ''));
    return Number.isFinite(ms) ? ms : 0;
  }

  function pickNewer(first, second) {
    if (!second) return first;
    if (!first) return second;
    return timestampMs(second.updatedAt) > timestampMs(first.updatedAt)
      ? second
      : first;
  }

  function localSrc(names) {
    return names
      .map(sanitizeFontName)
      .filter(Boolean)
      .map(name => `local("${name}")`)
      .join(', ');
  }

  function buildFaces(settings) {
    const cfg = normalize(settings);
    return [300, 400, 700]
      .map(weight => {
        const src = localSrc(cfg.cjkLocals[weight] || []);
        if (!src) return '';
        return `@font-face {
      font-family: "${CJK_ALIAS}";
      src: ${src};
      font-style: normal;
      font-weight: ${weight};
      font-display: swap;
      size-adjust: ${cfg.cjkSizeAdjust};
      unicode-range: ${CJK_UNICODE_RANGE};
    }`;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  function buildStack(settings) {
    const cfg = normalize(settings);
    const latin = quoteFont(cfg.latinFont);
    const fallbacks = cfg.latinFallbacks
      .map(quoteFont)
      .filter(Boolean);
    return [
      `"${CJK_ALIAS}"`,
      latin,
      ...fallbacks,
      ...CJK_TAIL
    ].filter(Boolean).join(', ');
  }

  function buildCSS(settings, skipSelectors) {
    const skip = Array.isArray(skipSelectors) ? skipSelectors.join(',') : '';
    return `
    ${buildFaces(settings)}

    :where(*:not(:is(${skip}))) {
      font-family: ${buildStack(settings)} !important;
    }
  `;
  }

  function bakedSettings() {
    try {
      if (root.__FORCE_FONT_USER_SETTINGS__) {
        return normalize(root.__FORCE_FONT_USER_SETTINGS__);
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function loadStoredSettings() {
    return new Promise(resolve => {
      try {
        if (!root.chrome?.storage?.local) {
          resolve(null);
          return;
        }
        root.chrome.storage.local.get(STORAGE_KEY, result => {
          const value = result && result[STORAGE_KEY];
          resolve(value ? normalize(value) : null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function saveStoredSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        if (!root.chrome?.storage?.local) {
          resolve();
          return;
        }
        const payload = normalize({
          ...settings,
          updatedAt: settings.updatedAt || new Date().toISOString()
        });
        root.chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => {
          const err = root.chrome.runtime?.lastError;
          if (err) reject(err);
          else resolve(payload);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async function loadFileSettings() {
    try {
      if (!root.chrome?.runtime?.getURL) return null;
      const response = await fetch(root.chrome.runtime.getURL(USER_SETTINGS_FILE), {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      return normalize(await response.json());
    } catch {
      return null;
    }
  }

  async function resolveSettings() {
    const baked = bakedSettings();
    const [fileSettings, stored] = await Promise.all([
      loadFileSettings(),
      loadStoredSettings()
    ]);
    return pickNewer(pickNewer(defaultSettings(), baked || fileSettings), stored);
  }

  function onSettingsChanged(callback) {
    try {
      root.chrome?.storage?.onChanged?.addListener((changes, area) => {
        if (area !== 'local' || !changes[STORAGE_KEY]) return;
        callback(normalize(changes[STORAGE_KEY].newValue || { preset: 'default' }));
      });
    } catch {
      /* ignore */
    }
  }

  function sameSettings(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    return (
      left.preset === right.preset &&
      left.latinFont === right.latinFont &&
      left.cjkFont === right.cjkFont &&
      left.cjkSizeAdjust === right.cjkSizeAdjust
    );
  }

  root.ForceFont = {
    STORAGE_KEY,
    PRESETS,
    sanitizeFontName,
    normalize,
    defaultSettings,
    bakedSettings,
    resolveSettings,
    loadStoredSettings,
    saveStoredSettings,
    loadFileSettings,
    onSettingsChanged,
    buildCSS,
    sameSettings
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
