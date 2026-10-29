/* Frontend commun aux deux enquêtes : aucune donnée sensible dans localStorage. */
(() => {
  'use strict';
  const form = document.getElementById('survey-form');
  if (!form) return;
  const button = document.getElementById('submit');
  const status = document.getElementById('form-status');
  const success = document.getElementById('success');
  const captchaContainer = document.getElementById('captcha');
  let captchaId = null;
  let captchaToken = '';
  let enabled = false;
  let busy = false;

  function message(text, kind = '') {
    status.textContent = text;
    status.className = 'status ' + kind;
  }
  function updateSubmit() { button.disabled = !enabled || !captchaToken || busy; }
  function resetCaptcha() {
    captchaToken = '';
    if (captchaId !== null && window.turnstile) window.turnstile.reset(captchaId);
    updateSubmit();
  }

  async function init() {
    try {
      const response = await fetch('/api/survey-config', { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error('configuration indisponible');
      const config = await response.json();
      if (!config.enabled || !config.siteKey) throw new Error('configuration incomplète');
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onerror = () => message('La vérification anti-abus est inaccessible. Vérifiez votre connexion ou réessayez plus tard.', 'error');
      script.onload = () => {
        if (!window.turnstile) return message('La vérification anti-abus ne s’est pas chargée.', 'error');
        captchaId = window.turnstile.render(captchaContainer, {
          sitekey: config.siteKey,
          theme: 'light',
          callback: token => { captchaToken = token; enabled = true; updateSubmit(); message('Service disponible. Vous pouvez envoyer vos réponses.', 'ok'); },
          'expired-callback': () => { captchaToken = ''; updateSubmit(); message('Veuillez renouveler la vérification anti-abus.', 'error'); },
          'error-callback': () => { captchaToken = ''; updateSubmit(); message('Vérification indisponible. Réessayez.', 'error'); }
        });
      };
      document.head.appendChild(script);
    } catch (error) {
      enabled = false;
      updateSubmit();
      message('La collecte n’est pas encore configurée. Aucune réponse ne peut être transmise pour le moment.', 'error');
    }
  }

  function buildAnswers() {
    const data = new FormData(form);
    const answers = {};
    let answered = false;
    form.querySelectorAll('fieldset[data-question]').forEach(fieldset => {
      const key = fieldset.dataset.question;
      const multi = fieldset.dataset.multi === 'true';
      const input = fieldset.querySelector(`textarea[name="${key}"]`);
      const value = multi ? data.getAll(key) : String(data.get(key) || '').trim();
      answers[key] = value;
      if (multi ? value.length > 0 : value.length > 0) answered = true;
      const other = fieldset.querySelector(`textarea[name="${key}_other"]`);
      if (other) {
        answers[`${key}_other`] = other.value.trim();
        if (answers[`${key}_other`]) answered = true;
      }
    });
    if (!answered) {
      message('Veuillez renseigner au moins une réponse avant de continuer.', 'error');
      return null;
    }
    if (!form.elements.ageConfirmed.checked || !form.elements.consent.checked) {
      message('Confirmez votre majorité et votre consentement avant l’envoi.', 'error');
      return null;
    }
    return {
      survey: form.dataset.survey,
      answers,
      ageConfirmed: true,
      consent: true,
      website: data.get('website') || '',
      turnstileToken: captchaToken
    };
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !enabled || !captchaToken) return;
    const payload = buildAnswers();
    if (!payload) return;
    busy = true;
    updateSubmit();
    message('Envoi sécurisé de vos réponses…');
    try {
      const response = await fetch('/api/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        cache: 'no-store', credentials: 'omit', body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.saved !== true) throw new Error(result.message || 'Envoi non confirmé');
      form.hidden = true;
      success.hidden = false;
      success.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      message('Enregistrement non confirmé : ' + (error.message || 'une erreur est survenue') + '. Vos réponses n’ont pas été confirmées. Réessayez.', 'error');
      resetCaptcha();
    } finally { busy = false; updateSubmit(); }
  });
  init();
})();
