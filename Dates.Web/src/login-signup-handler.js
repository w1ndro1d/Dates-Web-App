import { api } from './api.js';

export const modal = document.getElementById('loginModal');
export const loginSignupButton = document.getElementById('login');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const authStatus = document.getElementById('auth-status');
const notification = document.getElementById('notification');
const closeNotification = document.getElementById('notification-close');
let notificationTimer;
export function showNotification(message, type = 'info', title = 'Dates') {
  clearTimeout(notificationTimer);
  notification.className = `notification notification-${type}`;
  document.getElementById('notification-title').textContent = title;
  document.getElementById('notification-message').textContent = message;
  notification.setAttribute('aria-hidden', 'false');
  notification.inert = false;
  notificationTimer = setTimeout(hideNotification, 6500);
}
function hideNotification() {
  notification.setAttribute('aria-hidden', 'true');
  notification.inert = true;
}
hideNotification();
closeNotification.addEventListener('click', hideNotification);
function status(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle('is-error', isError);
}
function openTab(name) {
  document.querySelectorAll('.tabcontent').forEach(panel => { panel.style.display = panel.id === name ? 'flex' : 'none'; });
  document.querySelectorAll('.tablinks').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === name);
    button.setAttribute('aria-pressed', String(button.dataset.tab === name));
  });
}
document.querySelectorAll('.tablinks').forEach(button => button.addEventListener('click', () => openTab(button.dataset.tab)));
openTab('LoginForm');
loginSignupButton.addEventListener('click', event => { event.preventDefault(); modal.style.display = 'flex'; });
document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.passwordTarget);
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  button.classList.toggle('is-visible', visible);
  button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  button.title = button.getAttribute('aria-label');
}));
// Old development JWTs are no longer used; the session is an HttpOnly cookie.
try { localStorage.removeItem('token'); } catch { /* Storage may be disabled. */ }
export const sessionReady = api('/Authentication/me').catch(error => {
  if (error.status !== 401) showNotification(error.message, 'error', 'Could not check your session');
  return null;
});
async function pending(button, action) {
  if (button.disabled) return;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Please wait…';
  try { await action(); } catch (error) { status(error.message, true); }
  finally { button.disabled = false; button.textContent = label; }
}
signupForm.addEventListener('submit', event => {
  event.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  if (password !== document.getElementById('signup-confirm-password').value) {
    status('Both passwords must match.', true); return;
  }
  pending(signupForm.querySelector('[type=submit]'), async () => {
    const result = await api('/Authentication/register', { method: 'POST', body: { email, password } });
    status(result.message);
    loginForm.querySelector('[type=email]').value = email;
    signupForm.reset();
    openTab('LoginForm');
  });
});
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  pending(loginForm.querySelector('[type=submit]'), async () => {
    await api('/Authentication/login', { method: 'POST', body: {
      email: loginForm.querySelector('[type=email]').value.trim(), password: document.getElementById('login-password').value
    } });
    location.reload();
  });
});
document.getElementById('resend-verification').addEventListener('click', event => {
  const emailInput = loginForm.querySelector('[type=email]');
  if (!emailInput.reportValidity()) return;
  pending(event.currentTarget, async () => {
    const result = await api('/Authentication/resend-verification', { method: 'POST', body: { email: emailInput.value.trim() } });
    status(result.message);
  });
});
let verificationToken = new URLSearchParams(location.hash.slice(1)).get('verify-email');
const verifyButton = document.getElementById('verify-email');
if (verificationToken) {
  history.replaceState({}, '', location.pathname + location.search);
  modal.style.display = 'flex';
  verifyButton.hidden = false;
  status('Finish verifying your email, then sign in.');
}
verifyButton.addEventListener('click', event => pending(event.currentTarget, async () => {
  const result = await api('/Authentication/verify-email', { method: 'POST', body: { token: verificationToken } });
  verificationToken = null;
  verifyButton.hidden = true;
  status(result.message);
}));
