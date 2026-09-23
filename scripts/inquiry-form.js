(() => {
  const form = document.getElementById('inquiryForm');
  if (!form) return;
  const button = document.getElementById('inquirySubmit');
  const status = document.getElementById('inquiryStatus');
  const requestId = document.getElementById('inquiryId');
  let lastPayload = '';
  let sending = false;
  const makeId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  requestId.value = makeId();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    const fields = ['Name', 'Email', 'Type', 'Message'];
    const values = fields.map(name => form.elements.namedItem(name).value.trim());
    if (!values[0] || !values[2]) {
      status.dataset.state = 'error';
      status.textContent = 'Please enter your name and session type.';
      return;
    }
    const signature = JSON.stringify(values);
    // Keep an ID across uncertain retries; new content represents a new inquiry.
    if (lastPayload && signature !== lastPayload) requestId.value = makeId();
    lastPayload = signature;
    const body = new URLSearchParams(new FormData(form));
    fields.forEach((name, index) => body.set(name, values[index]));
    sending = true;
    const editable = Array.from(form.querySelectorAll('input:not([type="hidden"]), textarea'));
    editable.forEach(field => { field.readOnly = true; });
    button.disabled = true;
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    status.dataset.state = 'pending';
    status.textContent = 'Sending your inquiry…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(form.action, {method:'POST', body,
        credentials:'omit', redirect:'follow', signal:controller.signal});
      if (!response.ok) throw new Error('CONNECTION');
      const result = await response.json();
      if (result.ok !== true || result.saved !== true || result.submissionId !== requestId.value) {
        throw new Error(result.error || 'UNCONFIRMED');
      }
      status.dataset.state = 'success';
      status.textContent = 'Thank you! Your inquiry has been received. Matthew will get back to you by email.';
      form.reset();
      requestId.value = makeId();
      lastPayload = '';
      status.focus({preventScroll:true});
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.message === 'INVALID_INPUT'
        ? 'Please check your details and try again.'
        : error.message === 'LIMIT_REACHED'
          ? 'The inquiry form is temporarily unavailable. Please contact Matthew using the email link beside the form.'
          : 'We couldn’t confirm your inquiry. Your details are still here—please try again. If the problem continues, use the email link beside the form.';
    } finally {
      clearTimeout(timeout);
      sending = false;
      editable.forEach(field => { field.readOnly = false; });
      button.disabled = false;
      button.textContent = 'Send Inquiry';
      form.removeAttribute('aria-busy');
    }
  });
})();
