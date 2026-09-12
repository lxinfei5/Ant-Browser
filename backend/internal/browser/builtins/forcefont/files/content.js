/* Vendored from local Tampermonkey script
 * 强制字体 v4.1.0
 * 默认 Monaco + 95% 微软雅黑；可改为 American Typewriter + 思源宋体，或自定义西文/中文组合。
 * @grant none. No remote URLs, no @require.
 */
(function () {
  'use strict';

  const SKIP_CODE = true;
  const SMART_ICON_RESCUE = true;
  const ForceFont = globalThis.ForceFont;

  const STYLE_ID = '__force_font_style__';

  const ICON_ROOTS = [
    'svg',
    'use',
    'ion-icon',

    '[data-icon]',
    '[data-ff-skip]',

    '[class~="icon" i]',
    '[class^="icon-" i]',
    '[class*=" icon-" i]',
    '[class$="-icon" i]',
    '[class*="-icon " i]',

    '[class~="glyph" i]',
    '[class^="glyph-" i]',
    '[class*=" glyph-" i]',

    '[class~="symbol" i]',
    '[class^="symbol-" i]',
    '[class*=" symbol-" i]',

    '[class~="fa" i]',
    '[class~="fas" i]',
    '[class~="far" i]',
    '[class~="fal" i]',
    '[class~="fab" i]',
    '[class~="fad" i]',
    '[class^="fa-" i]',
    '[class*=" fa-" i]',

    '[class~="anticon" i]',
    '[class*="anticon-" i]',
    '[class~="iconfont" i]',
    '[class*="iconfont-" i]',
    '[class*="glyphicon" i]',
    '[class*="dashicon" i]',
    '[class*="codicon" i]',
    '[class*="octicon" i]',
    '[class*="ionicon" i]',
    '[class*="material-icons" i]',
    '[class*="material-symbols" i]',

    '[class~="logo" i]',
    '[class^="logo-" i]',
    '[class*=" logo-" i]',
    '[class$="-logo" i]',
    '[class*="-logo " i]'
  ];

  const CODE_ROOTS = [
    'code',
    'pre',
    'kbd',
    'samp',

    '[class~="code" i]',
    '[class^="code-" i]',
    '[class*=" code-" i]',
    '[class~="hljs" i]',
    '[class~="highlight" i]',
    '[class^="language-" i]',
    '[class*=" language-" i]',

    '[class*="monaco-editor" i]',
    '[class*="codemirror" i]',
    '[class*="ace_editor" i]'
  ];

  function includeDescendants(selectors) {
    return selectors.flatMap(selector => [
      selector,
      `${selector} *`
    ]);
  }

  const ICON_TREE_SELECTORS = includeDescendants(ICON_ROOTS);

  const CODE_TREE_SELECTORS = SKIP_CODE
    ? includeDescendants(CODE_ROOTS)
    : [];

  const SKIP_SELECTORS = [
    ...ICON_TREE_SELECTORS,
    ...CODE_TREE_SELECTORS
  ];

  const ICON_TREE_SELECTOR = ICON_TREE_SELECTORS.join(',');
  const CODE_TREE_SELECTOR = CODE_TREE_SELECTORS.join(',');

  let styleElement = null;
  let appliedSettings = ForceFont
    ? ForceFont.bakedSettings() || ForceFont.defaultSettings()
    : {
        preset: 'default',
        latinFont: 'Monaco',
        cjkFont: 'Microsoft YaHei',
        cjkSizeAdjust: '95%'
      };

  function fallbackCSS(settings) {
    const latin = settings.latinFont || 'Monaco';
    const cjk = settings.cjkFont || 'Microsoft YaHei';
    const adjust = settings.cjkSizeAdjust || '95%';
    return `
    @font-face {
      font-family: "FF CJK";
      src: local("${cjk}");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      size-adjust: ${adjust};
      unicode-range: U+2E80-2EFF, U+3000-303F, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF, U+20000-2A6DF, U+2013-2014, U+2018-201D, U+2026;
    }

    :where(*:not(:is(${SKIP_SELECTORS.join(',')}))) {
      font-family: "FF CJK", "${latin}", "Consolas", "Microsoft YaHei", "PingFang SC", sans-serif !important;
    }
  `;
  }

  function currentCSS(settings) {
    if (ForceFont?.buildCSS) {
      return ForceFont.buildCSS(settings, SKIP_SELECTORS);
    }
    return fallbackCSS(settings);
  }

  function injectCSS(settings) {
    const css = currentCSS(settings);
    appliedSettings = settings;

    if (styleElement?.isConnected) {
      if (styleElement.textContent !== css) {
        styleElement.textContent = css;
      }
      return true;
    }

    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      styleElement = existing;
      if (styleElement.textContent !== css) {
        styleElement.textContent = css;
      }
      return true;
    }

    const parent = document.head || document.documentElement;
    if (!parent) return false;

    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    styleElement.textContent = css;
    parent.appendChild(styleElement);
    return true;
  }

  function applySettings(settings) {
    const next = ForceFont ? ForceFont.normalize(settings) : settings;
    injectCSS(next);
  }

  injectCSS(appliedSettings);

  if (ForceFont?.resolveSettings) {
    ForceFont.resolveSettings().then(settings => {
      if (!ForceFont.sameSettings(appliedSettings, settings)) {
        applySettings(settings);
      }
    });
    ForceFont.onSettingsChanged(applySettings);
  }

  const PUA_RE =
    /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;

  const ICON_FONT_RE =
    /icon|glyph|font\s?awesome|material\s?(icons|symbols)|anticon|iconfont|ionicons|feather|remix|typicons|entypo|dashicons|octicons|codicon|bootstrap.?icons/i;

  function hasDirectPuaText(el) {
    for (const node of el.childNodes) {
      if (
        node.nodeType === Node.TEXT_NODE &&
        PUA_RE.test(node.nodeValue || '')
      ) {
        return true;
      }
    }

    return false;
  }

  function pseudoLooksLikeIcon(el, pseudo) {
    let computedStyle;

    try {
      computedStyle = getComputedStyle(el, pseudo);
    } catch {
      return false;
    }

    if (!computedStyle) return false;

    const content = computedStyle.content;

    if (
      !content ||
      content === 'none' ||
      content === 'normal' ||
      content === '""' ||
      content === "''"
    ) {
      return false;
    }

    return (
      PUA_RE.test(content) ||
      ICON_FONT_RE.test(computedStyle.fontFamily)
    );
  }

  function usesIconFont(el) {
    return (
      hasDirectPuaText(el) ||
      pseudoLooksLikeIcon(el, '::before') ||
      pseudoLooksLikeIcon(el, '::after')
    );
  }

  function shouldInspect(el) {
    if (!el.isConnected) return false;

    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      return false;
    }

    if (
      el.matches(
        'script,style,link,meta,head,title,template,noscript'
      )
    ) {
      return false;
    }

    if (
      ICON_TREE_SELECTOR &&
      el.matches(ICON_TREE_SELECTOR)
    ) {
      return false;
    }

    if (
      SKIP_CODE &&
      CODE_TREE_SELECTOR &&
      el.matches(CODE_TREE_SELECTOR)
    ) {
      return false;
    }

    return (
      el.childElementCount === 0 ||
      el.matches('i,span,a,button,label,li,[class]')
    );
  }

  const pendingElements = new Set();
  let drainScheduled = false;

  const scheduleIdle = window.requestIdleCallback
    ? callback =>
        window.requestIdleCallback(callback, {
          timeout: 300
        })
    : callback =>
        window.setTimeout(
          () =>
            callback({
              didTimeout: true,
              timeRemaining: () => 0
            }),
          16
        );

  function scheduleDrain() {
    if (
      drainScheduled ||
      pendingElements.size === 0
    ) {
      return;
    }

    drainScheduled = true;
    scheduleIdle(drainQueue);
  }

  function drainQueue(deadline) {
    drainScheduled = false;

    const startedAt = performance.now();
    let processed = 0;

    for (const el of pendingElements) {
      pendingElements.delete(el);

      if (shouldInspect(el) && usesIconFont(el)) {
        el.setAttribute('data-ff-skip', '1');
      }

      processed++;

      if (
        processed >= 250 ||
        performance.now() - startedAt >= 8 ||
        (
          !deadline.didTimeout &&
          deadline.timeRemaining() < 1
        )
      ) {
        break;
      }
    }

    if (pendingElements.size > 0) {
      scheduleDrain();
    }
  }

  function enqueueTree(root) {
    if (!(root instanceof Element)) return;

    pendingElements.add(root);

    for (const el of root.querySelectorAll('*')) {
      pendingElements.add(el);
    }

    scheduleDrain();
  }

  function start() {
    injectCSS(appliedSettings);

    if (
      SMART_ICON_RESCUE &&
      document.documentElement
    ) {
      enqueueTree(document.documentElement);
    }

    const observer = new MutationObserver(mutations => {
      if (!styleElement?.isConnected) {
        injectCSS(appliedSettings);
      }

      if (!SMART_ICON_RESCUE) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            enqueueTree(node);
          }
        }
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
