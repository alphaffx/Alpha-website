(function () {
  'use strict';
  const I18N = window.AlphaI18n;
  const t = key => I18N ? I18N.t(key) : key;
  const endpoint = 'https://formsubmit.co/ajax/admin@alphaff.gg';
  const timeoutMs = 20000;

  // One submission lifecycle for all forms. Never clear user input on failure.
  function bind({ id, buttonId, statusId, subject, success, error = 'contact.fbErr', payload }) {
    const form = document.getElementById(id);
    if (!form) return;
    const button = document.getElementById(buttonId);
    const status = document.getElementById(statusId);
    let pending = false;
    function say(key, ok) {
      status.dataset.i18n = key;
      status.textContent = t(key);
      status.hidden = false;
      status.classList.toggle('is-ok', ok === true);
      status.classList.toggle('is-err', ok === false);
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending) return;
      for (const field of form.querySelectorAll('input:not([type=checkbox]), textarea')) {
        field.value = field.value.trim();
      }
      if (!form.reportValidity() || form.elements._honey.value) return;
      const body = {
        ...payload(form),
        page_language: I18N ? I18N.current : 'en',
        _subject: subject,
        _template: 'table'
      };
      // Optional Google Sheets mirror, configured only after deployment is verified.
      // FormSubmit still sends the inbox notification; the browser never gets sheet access.
      if (id === 'learnForm' && form.dataset.webhook) {
        let webhook;
        try { webhook = new URL(form.dataset.webhook); } catch { say(error, false); return; }
        if (webhook.protocol !== 'https:' || webhook.hostname !== 'script.google.com' ||
            !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(webhook.pathname) || webhook.search || webhook.hash) {
          say(error, false);
          return;
        }
        body._webhook = webhook.href;
      }
      pending = true;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      say('contact.fbSending');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Request failed');
        const result = await response.json();
        if (result.success !== true && result.success !== 'true') throw new Error('Submission rejected');
        form.reset();
        say(success, true);
      } catch (failure) {
        say(error, false);
      } finally {
        clearTimeout(timeout);
        pending = false;
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });
  }

  bind({
    id: 'fbForm', buttonId: 'fbSend', statusId: 'fbStatus',
    subject: 'alphaff.gg - site feedback', success: 'contact.fbOk',
    payload: form => ({ message: form.elements.message.value, email: form.elements.email.value || '(not given)' })
  });
  bind({
    id: 'learnForm', buttonId: 'learnSend', statusId: 'learnStatus',
    subject: 'alphaff.gg - news signup', success: 'news.sent', error: 'news.error',
    payload: form => ({
      email: form.elements.email.value,
      interest: 'ALPHA news — course discounts, new courses, new store items, site updates',
      consent: 'Requested ALPHA news emails (discounts, courses, store, site updates); may opt out by replying.',
      consent_at: new Date().toISOString(),
      _autoresponse: "Thanks for signing up to ALPHA's 3D Space news! You'll be the first to hear about course discounts, new maps and models, and site updates. To stop these emails at any time, just reply \"unsubscribe\". — ALPHA, alphaff.gg"
    })
  });

  /* ============================================================
     CHARACTER SUBMISSIONS (Contact page)
     A normal multipart post to FormSubmit, because their AJAX mode
     cannot carry files. Pictures are checked and shrunk here first
     so the whole request stays under FormSubmit's 10 MB limit.
     Without JavaScript the form still posts as plain HTML.
     ============================================================ */
  (function characterForm() {
    const form = document.getElementById('characterForm');
    if (!form) return;
    const input = document.getElementById('charPics');
    const drop = document.getElementById('charDrop');
    const list = document.getElementById('charPreviews');
    const status = document.getElementById('charStatus');
    const button = document.getElementById('charSend');
    const MAX_FILES = 3;
    const MAX_SIDE = 2000;           // longest edge after shrinking
    const SHRINK_OVER = 1.5 * 1024 * 1024;
    const TOTAL_LIMIT = 9.5 * 1024 * 1024;
    const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const canSwapFiles = typeof DataTransfer === 'function';
    let files = [];
    let busy = false;

    function say(key, ok) {
      status.dataset.i18n = key;
      status.textContent = t(key);
      status.hidden = false;
      status.classList.toggle('is-ok', ok === true);
      status.classList.toggle('is-err', ok === false);
    }
    function clearSay() { status.hidden = true; delete status.dataset.i18n; }

    function syncInput() {
      if (!canSwapFiles) return;
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      input.files = dt.files;
    }

    function render() {
      list.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src));
      list.textContent = '';
      files.forEach((file, i) => {
        const li = document.createElement('li');
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'char-remove';
        rm.textContent = '✕';
        rm.setAttribute('aria-label', t('char.remove') + ': ' + file.name);
        rm.addEventListener('click', () => { files.splice(i, 1); syncInput(); render(); input.focus(); });
        li.append(img, rm);
        list.append(li);
      });
      drop.classList.toggle('is-full', files.length >= MAX_FILES);
    }

    // Each picture is copied into memory as soon as it is picked: some phones
    // stop letting a page read an earlier pick once a new one is made.
    async function add(incoming) {
      clearSay();
      let rejected = false, overflow = false;
      for (const f of incoming) {
        if (!TYPES.includes(f.type)) { rejected = true; continue; }
        if (files.length >= MAX_FILES) { overflow = true; break; }
        if (files.some(x => x.name === f.name && x.size === f.size)) continue;
        try { files.push(new File([await f.arrayBuffer()], f.name, { type: f.type })); }
        catch (e) { rejected = true; }
      }
      if (!canSwapFiles) files = Array.from(input.files).filter(f => TYPES.includes(f.type)).slice(0, MAX_FILES);
      syncInput();
      render();
      if (rejected) say('char.badType', false);
      else if (overflow) say('char.tooMany', false);
    }

    // JavaScript checks for pictures itself; the browser's own "required"
    // bubble would point at the hidden file field. It stays for no-JS visitors.
    if (canSwapFiles) input.required = false;
    input.addEventListener('change', () => add(Array.from(input.files)));
    if (canSwapFiles) {
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('is-over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
      drop.addEventListener('drop', e => { e.preventDefault(); add(Array.from(e.dataTransfer.files)); });
    }

    // Big phone photos are redrawn as JPEG no larger than MAX_SIDE.
    function shrink(file) {
      return new Promise(resolve => {
        if (file.size <= SHRINK_OVER) { resolve(file); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * scale);
          c.height = Math.round(img.naturalHeight * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob(blob => {
            if (!blob || blob.size >= file.size) { resolve(file); return; }
            resolve(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
      });
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      for (const field of form.querySelectorAll('input[type=text], input[type=email], input:not([type]), textarea')) {
        field.value = field.value.trim();
      }
      if (form.elements._honey.value) return;
      if (canSwapFiles && !files.length) { say('char.need', false); input.focus(); return; }
      if (!form.reportValidity()) return;

      busy = true;
      button.disabled = true;
      form.setAttribute('aria-busy', 'true');
      say('char.sending');
      try {
        if (canSwapFiles) {
          const ready = await Promise.all(files.map(shrink));
          const total = ready.reduce((n, f) => n + f.size, 0);
          if (total > TOTAL_LIMIT) throw new Error('too big');
          // One file per field, so every picture arrives as its own attachment.
          input.removeAttribute('name');
          input.required = false;
          form.querySelectorAll('.char-file-out').forEach(n => n.remove());
          ready.forEach((f, i) => {
            const out = document.createElement('input');
            out.type = 'file';
            out.hidden = true;
            out.className = 'char-file-out';
            out.name = i === 0 ? 'attachment' : 'attachment' + (i + 1);
            const dt = new DataTransfer();
            dt.items.add(f);
            out.files = dt.files;
            form.append(out);
          });
        }
        const here = new URL(location.href);
        here.search = '?sent=character';
        here.hash = 'contact';
        form.elements._next.value = here.href;
        form.elements.page_language.value = I18N ? I18N.current : 'en';
        HTMLFormElement.prototype.submit.call(form);
      } catch (failure) {
        input.setAttribute('name', 'attachment');
        form.querySelectorAll('.char-file-out').forEach(n => n.remove());
        say('char.tooBig', false);
        busy = false;
        button.disabled = false;
        form.removeAttribute('aria-busy');
      }
    });

    // Back from FormSubmit: thank the visitor and tidy the address bar.
    const params = new URLSearchParams(location.search);
    if (params.get('sent') === 'character') {
      say('char.sent', true);
      history.replaceState(null, '', location.pathname + '#contact');
    }
    document.addEventListener('alpha:langchange', () => {
      if (!status.hidden && status.dataset.i18n) status.textContent = t(status.dataset.i18n);
    });
  })();
})();
