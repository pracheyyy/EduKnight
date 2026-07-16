/* ==========================================================================
   EduKnight — Auth JS
   Handles: password visibility, strength meter, client-side validation,
   OTP-style input focus flow, and mock submit calls to the auth API.
   Toasts via Toastify, confirmations via SweetAlert2.
   ========================================================================== */

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
function initPasswordToggles() {
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.innerHTML = isPass ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
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
    label.textContent = input.value.length ? labels[score] : 'Enter a password';
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
      duration: 3200,
      gravity: 'top',
      position: 'right',
      style: { background: bg[type] || bg.info, borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '13.5px' },
    }).showToast();
  } else {
    console.log(`[${type}]`, message);
  }
}

/* ---------------- Sign Up ---------------- */
function initSignupForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
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

    if (!terms.checked) {
      showToast('Please accept the Terms to continue', 'error');
      valid = false;
    }

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Creating account...';
    submitBtn.disabled = true;

    // Placeholder for POST /api/auth/register
    setTimeout(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      showToast(`Welcome to EduKnight, ${name.value.split(' ')[0]}! Verify your email to continue.`, 'success');
      window.location.href = 'verify-email.html';
    }, 1000);
  });
}

/* ---------------- Login ---------------- */
function initLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
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
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Signing in...';
    submitBtn.disabled = true;

    // Placeholder for POST /api/auth/login
    setTimeout(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      showToast('Signed in successfully. Loading your dashboard...', 'success');
      window.location.href = 'dashboard.html';
    }, 900);
  });
}

/* ---------------- Forgot Password ---------------- */
function initForgotForm() {
  const form = document.getElementById('forgotForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail');
    if (!isValidEmail(email.value)) {
      setError(email, document.getElementById('forgotEmailError'), 'Enter a valid email address');
      return;
    }
    clearError(email, document.getElementById('forgotEmailError'));

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sending link...';
    submitBtn.disabled = true;

    // Placeholder for POST /api/auth/forgot-password
    setTimeout(() => {
      document.getElementById('forgotFormStep').style.display = 'none';
      document.getElementById('forgotSuccessStep').style.display = 'block';
    }, 900);
  });
}

/* ---------------- Reset Password ---------------- */
function initResetForm() {
  const form = document.getElementById('resetForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pw = document.getElementById('resetPassword');
    const confirm = document.getElementById('resetConfirmPassword');
    let valid = true;

    if (scorePassword(pw.value) < 2) { setError(pw, document.getElementById('resetPasswordError'), 'Use at least 8 characters with a number'); valid = false; }
    else clearError(pw, document.getElementById('resetPasswordError'));

    if (confirm.value !== pw.value || !confirm.value) { setError(confirm, document.getElementById('resetConfirmError'), 'Passwords do not match'); valid = false; }
    else clearError(confirm, document.getElementById('resetConfirmError'));

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Resetting...';

    // Placeholder for POST /api/auth/reset-password
    setTimeout(() => {
      if (window.Swal) {
        Swal.fire({
          title: 'Password reset!',
          text: 'You can now log in with your new password.',
          icon: 'success',
          confirmButtonColor: '#2563EB',
          confirmButtonText: 'Go to Login',
        }).then(() => window.location.href = 'login.html');
      } else {
        window.location.href = 'login.html';
      }
    }, 900);
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
}