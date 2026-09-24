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
    id: 'commissionForm', buttonId: 'commissionSend', statusId: 'commissionStatus',
    subject: 'alphaff.gg - commission request', success: 'commission.sent',
    payload: form => {
      const data = Object.fromEntries(new FormData(form));
      delete data._honey;
      return data;
    }
  });
  bind({
    id: 'learnForm', buttonId: 'learnSend', statusId: 'learnStatus',
    subject: 'alphaff.gg - class waitlist', success: 'learn.sent', error: 'learn.error',
    payload: form => ({
      email: form.elements.email.value,
      interest: 'Learn with ALPHA — recorded classes',
      consent: 'Requested class launch emails; may opt out by replying.',
      consent_at: new Date().toISOString()
    })
  });
})();
