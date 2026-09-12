(function () {
  'use strict';

  const form = document.getElementById('form');
  const customFields = document.getElementById('customFields');
  const latinInput = document.getElementById('latinFont');
  const cjkInput = document.getElementById('cjkFont');
  const latinPreview = document.getElementById('latinPreview');
  const cjkPreview = document.getElementById('cjkPreview');
  const status = document.getElementById('status');
  const ForceFont = globalThis.ForceFont;

  function selectedPreset() {
    return form.querySelector('input[name="preset"]:checked')?.value || 'default';
  }

  function currentDraft() {
    return ForceFont.normalize({
      preset: selectedPreset(),
      latinFont: latinInput.value,
      cjkFont: cjkInput.value
    });
  }

  function setPreset(preset) {
    const input = form.querySelector(`input[name="preset"][value="${preset}"]`);
    if (input) input.checked = true;
    customFields.hidden = preset !== 'custom';
  }

  function render(settings) {
    setPreset(settings.preset);
    latinInput.value = settings.preset === 'custom' ? settings.latinFont : '';
    cjkInput.value = settings.preset === 'custom' ? settings.cjkFont : '';
    const resolved = currentDraft();
    latinPreview.style.fontFamily = `"${resolved.latinFont}"`;
    cjkPreview.style.fontFamily = `"${resolved.cjkFont}"`;
  }

  form.addEventListener('change', () => render(currentDraft()));
  form.addEventListener('input', () => render(currentDraft()));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const draft = currentDraft();
    if (draft.preset === 'custom') {
      if (!ForceFont.sanitizeFontName(latinInput.value) || !ForceFont.sanitizeFontName(cjkInput.value)) {
        status.textContent = '请填写有效的本机字体名（不要含引号或分号）';
        return;
      }
    }
    try {
      await ForceFont.saveStoredSettings({
        ...draft,
        updatedAt: new Date().toISOString()
      });
      status.textContent = '已保存。当前浏览器配置立即生效；其它实例请用应用里的「字体」做全局默认。';
    } catch (err) {
      status.textContent = err?.message || '保存失败';
    }
  });

  ForceFont.resolveSettings().then(render).catch(() => render(ForceFont.defaultSettings()));
})();
