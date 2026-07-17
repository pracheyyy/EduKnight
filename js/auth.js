/* ==========================================================================
   EduKnight — Auth JS
   Handles: password visibility, strength meter, client-side validation,
   OTP input flow, and REAL calls to the backend auth API.
   Toasts via Toastify.
   ========================================================================== */

// Backend base URL — change this if your API runs somewhere else (e.g. after deploying)
const API_BASE_URL = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', () => {
  initThemeFromStorage();
  initPasswordToggles();
  initPasswordStrength();
  initSignupForm();
  initLoginForm();
  initForgotForm();
  initResetForm();
  initOtpInputs();
});

function initThemeFromStorage() {
  const saved = localStorage.getItem('eduknight-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', saved);
}

/* ---------------- Show/hide password ---------------- */
/* Matches BOTH markup patterns used across auth pages:
   - class="toggle-pass" (icon button) with data-target
   - class="pw-toggle"   (inline <i>) with data-target      */
function initPasswordToggles() {
  document.querySelectorAll('.toggle-pass, .pw-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const input = document.getElementById(el.getAttribute('data-target'));
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      el.classList.toggle('bi-eye', !isPass);
      el.classList.toggle('bi-eye-slash', isPass);
      if (el.tagName === 'BUTTON') {
        el.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
      }
    });
  });
}

/* ---------------- Password strength meter ---------------- */
function scorePassword(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function initPasswordStrength() {
  const input = document.getElementById('signupPassword');
  const meter = document.getElementById('pwStrength');
  const label = document.getElementById('pwStrengthLabel');
  if (!input || !meter) return;

  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

  input.addEventListener('input', () => {
    const score = input.value.length ? scorePassword(input.value) || 1 : 0;
    meter.setAttribute('data-level', score);
    if (label) label.textContent = input.value.length ? labels[score] : 'Enter a password';
  });
}

/* ---------------- Field validation helpers ---------------- */
function setError(input, errorEl, message) {
  input.classList.add('is-invalid');
  input.classList.remove('is-valid');
  if (errorEl) { errorEl.textContent = message; errorEl.classList.add('show'); }
}
function clearError(input, errorEl) {
  input.classList.remove('is-invalid');
  input.classList.add('is-valid');
  if (errorEl) errorEl.classList.remove('show');
}
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function showToast(message, type = 'success') {
  const bg = { success: 'linear-gradient(135deg,#10B981,#059669)', error: 'linear-gradient(135deg,#EF4444,#DC2626)', info: 'linear-gradient(135deg,#2563EB,#4F46E5)' };
  if (window.Toastify) {
    Toastify({
      text: message,
      duration: 3800,
      gravity: 'top',
      position: 'right',
      style: { background: bg[type] || bg.info, borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '13.5px' },
    }).showToast();
  } else {
    console.log(`[${type}]`, message);
  }
}

/* ---------------- Shared: call the backend ---------------- */
async function apiRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // send/receive the httpOnly JWT cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* empty body is fine */ }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function setBtnLoading(btn, loadingText) {
  btn.dataset.originalHtml = btn.innerHTML;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> ${loadingText}`;
  btn.disabled = true;
}
function resetBtn(btn) {
  if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  btn.disabled = false;
}

/* ---------------- Sign Up ---------------- */
function initSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    const name = document.getElementById('signupName');
    const email = document.getElementById('signupEmail');
    const password = document.getElementById('signupPassword');
    const terms = document.getElementById('agreeTerms');

    if (name.value.trim().length < 2) { setError(name, document.getElementById('nameError'), 'Enter your full name'); valid = false; }
    else clearError(name, document.getElementById('nameError'));

    if (!isValidEmail(email.value)) { setError(email, document.getElementById('emailError'), 'Enter a valid email address'); valid = false; }
    else clearError(email, document.getElementById('emailError'));

    if (scorePassword(password.value) < 2) { setError(password, document.getElementById('passwordError'), 'Use at least 8 characters with a number'); valid = false; }
    else clearError(password, document.getElementById('passwordError'));

    if (terms && !terms.checked) {
      showToast('Please accept the Terms to continue', 'error');
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    setBtnLoading(submitBtn, 'Creating account...');

    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: { name: name.value.trim(), email: email.value.trim(), password: password.value },
      });
      showToast(`Welcome to EduKnight, ${name.value.trim().split(' ')[0]}! Check your email for a verification code.`, 'success');
      sessionStorage.setItem('eduknight-pending-email', email.value.trim());
      window.location.href = 'verify-email.html';
    } catch (err) {
      showToast(err.message || 'Could not create your account. Please try again.', 'error');
      resetBtn(submitBtn);
    }
  });
}

/* ---------------- Login ---------------- */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');

    if (!isValidEmail(email.value)) { setError(email, document.getElementById('loginEmailError'), 'Enter a valid email address'); valid = false; }
    else clearError(email, document.getElementById('loginEmailError'));

    if (password.value.length < 1) { setError(password, document.getElementById('loginPasswordError'), 'Enter your password'); valid = false; }
    else clearError(password, document.getElementById('loginPasswordError'));

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    setBtnLoading(submitBtn, 'Signing in...');

    try {
      await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: email.value.trim(), password: password.value },
      });
      showToast('Signed in successfully. Loading your dashboard...', 'success');
      window.location.href = 'dashboard.html';
    } catch (err) {
      showToast(err.message || 'Invalid email or password.', 'error');
      resetBtn(submitBtn);
    }
  });
}

/* ---------------- Forgot Password ---------------- */
function initForgotForm() {
  const form = document.getElementById('forgotForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail');
    if (!isValidEmail(email.value)) {
      setError(email, document.getElementById('forgotEmailError'), 'Enter a valid email address');
      return;
    }
    clearError(email, document.getElementById('forgotEmailError'));

    const submitBtn = form.querySelector('button[type="submit"]');
    setBtnLoading(submitBtn, 'Sending link...');

    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: email.value.trim() } });
      document.getElementById('forgotFormStep').style.display = 'none';
      document.getElementById('forgotSuccessStep').style.display = 'block';
    } catch (err) {
      showToast(err.message || 'Could not send reset link. Please try again.', 'error');
      resetBtn(submitBtn);
    }
  });
}

/* ---------------- Reset Password ---------------- */
function initResetForm() {
  const form = document.getElementById('resetForm');
  if (!form) return;

  // Token comes from the reset link: reset-password.html?token=xxxxx
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('resetPassword');
    const confirm = document.getElementById('resetConfirmPassword');
    let valid = true;

    if (scorePassword(pw.value) < 2) { setError(pw, document.getElementById('resetPasswordError'), 'Use at least 8 characters with a number'); valid = false; }
    else clearError(pw, document.getElementById('resetPasswordError'));

    if (confirm.value !== pw.value || !confirm.value) { setError(confirm, document.getElementById('resetConfirmError'), 'Passwords do not match'); valid = false; }
    else clearError(confirm, document.getElementById('resetConfirmError'));

    if (!resetToken) { showToast('Reset link is invalid or expired. Request a new one.', 'error'); valid = false; }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    setBtnLoading(submitBtn, 'Resetting...');

    try {
      await apiRequest(`/auth/reset-password/${resetToken}`, { method: 'POST', body: { password: pw.value } });
      if (window.Swal) {
        Swal.fire({
          title: 'Password reset!',
          text: 'You can now log in with your new password.',
          icon: 'success',
          confirmButtonColor: '#2563EB',
          confirmButtonText: 'Go to Login',
        }).then(() => window.location.href = 'login.html');
      } else {
        showToast('Password reset! Redirecting to login...', 'success');
        setTimeout(() => window.location.href = 'login.html', 1200);
      }
    } catch (err) {
      showToast(err.message || 'Could not reset password. The link may have expired.', 'error');
      resetBtn(submitBtn);
    }
  });
}

/* ---------------- OTP / email verification input flow ---------------- */
function initOtpInputs() {
  const boxes = document.querySelectorAll('.otp-box');
  if (!boxes.length) return;

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (box.value && boxes[i + 1]) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && boxes[i - 1]) boxes[i - 1].focus();
    });
  });

  const verifyForm = document.getElementById('verifyForm');
  if (!verifyForm) return;

  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = Array.from(boxes).map(b => b.value).join('');
    if (code.length !== boxes.length) {
      showToast('Enter the full verification code.', 'error');
      return;
    }
    const submitBtn = verifyForm.querySelector('button[type="submit"]');
    setBtnLoading(submitBtn, 'Verifying...');

    try {
      await apiRequest('/auth/verify-email', { method: 'POST', body: { code } });
      showToast('Email verified! Redirecting to your dashboard...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } catch (err) {
      showToast(err.message || 'Invalid or expired code.', 'error');
      resetBtn(submitBtn);
    }
  });
}