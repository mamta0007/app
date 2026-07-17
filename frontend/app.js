/* =========================================================
   Redline — Resume Analyzer & Interview Coach
   Frontend application logic (vanilla JS, no build step)

   HOW THIS FILE IS ORGANIZED (read top to bottom):
   1. State        — a plain object that remembers what's happening
                      right now (who's logged in, what's uploaded, etc).
   2. Tokens       — saves/reads the login "keys" (JWT tokens) from
                      the browser's localStorage so you stay logged in.
   3. API layer    — every function that talks to the backend server
                      lives here (apiFetch + the Api object).
   4. Toast        — the little popup message in the corner.
   5. View switching / Routing — show/hide the right screen.
   6. Auth         — login, register, forgot/reset password, logout.
   7. Upload       — resume + job description file upload.
   8. Analysis / Roadmap / Interview / Question bank / Report / History
                    — one section per app feature.
   9. Boot         — the very last thing that runs, kicks everything off.

   If you're new to JavaScript: "async function" means the function
   can "await" something slow (like a network request) without
   freezing the page. "addEventListener('click', ...)" means
   "run this code when the user clicks this button".

   SESSION-SCOPING NOTE (read this before touching Roadmap/Interview/
   Question bank/Report code): the backend's /generate_road_map,
   /question, /question%20generation, and /report endpoints all
   return data tied to the ACCOUNT, not to "what happened in this
   browser tab." If you upload nothing and immediately click e.g.
   "Generate roadmap", the backend still happily returns whatever
   roadmap it last generated for this account — possibly from a
   totally different resume/JD, days ago. To stop that from being
   shown as if it were current, every one of those actions below is
   guarded with `if (!state.analysis) { ...bail out... }` — state.analysis
   only gets set after Api.runAnalysis() succeeds IN THIS SESSION.
   ========================================================= */

// This is the address of the backend server. Every request in this
// file gets sent to API_BASE + some path, e.g. API_BASE + "/login".
const API_BASE = window.REDLINE_API_BASE || 'http://192.168.1.26:8000';

/* ---------------------------------------------------------
   State
   This one object holds every piece of "memory" the app needs
   while it's running. It resets whenever the page reloads —
   it's NOT saved anywhere (that's what Tokens/localStorage below
   are for). Think of it as a notepad the app scribbles on.
   --------------------------------------------------------- */

const state = {
  user: null,          // { name, email }
  resumeId: null,
  jdId: null,
  analysis: null,       // last analysis response
  interview: {
    type: null,
    currentQuestion: null,
    history: [],
  },
  questions: {
    all: null,
  },
  report: null,
  reportBlob: null,      // the fetched .docx file bytes, set by loadReport()
  reportFileName: null, // real backend filename, read from Content-Disposition
  history: null,        // last /history response
};

/* ---------------------------------------------------------
   Token storage

   When you log in, the backend gives us two "keys":
   - access_token  → proves who we are, but expires quickly (~1 hour)
   - refresh_token → lasts much longer, used to get a NEW access
                     token without asking the user to log in again

   localStorage is the browser's built-in permanent storage box —
   whatever we save here survives a page refresh or closing the tab.
   --------------------------------------------------------- */

const Tokens = {
  get access() { return localStorage.getItem('redline_access_token'); },
  get refresh() { return localStorage.getItem('redline_refresh_token'); },
  set(access, refresh) {
    if (access) localStorage.setItem('redline_access_token', access);
    if (refresh) localStorage.setItem('redline_refresh_token', refresh);
  },
  clear() {
    localStorage.removeItem('redline_access_token');
    localStorage.removeItem('redline_refresh_token');
    localStorage.removeItem('redline_user');
  },
  get isAuthenticated() { return !!this.access; },
};

/* ---------------------------------------------------------
   API layer

   apiFetch() is a wrapper around the browser's built-in fetch()
   function. Every single network request in this app goes through
   it, so we only had to write the tricky bits (auth headers, error
   handling, auto-refreshing an expired login) ONE time instead of
   repeating them in every feature.
   --------------------------------------------------------- */

// A custom error type so that, when something goes wrong, we can
// carry along the HTTP status code (like 404 or 500) alongside
// the error message — makes debugging much easier.

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path, options = {}, { auth = true, retry = true } = {}) {
  // Build the request headers. If we're sending a plain object
  // (not a file upload), tell the server it's JSON.
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  // If this request needs login, attach "Authorization: Bearer <token>".
  // Almost every route except login/register/forgot-password needs this.
  if (auth && Tokens.access) {
    headers.set('Authorization', `Bearer ${Tokens.access}`);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // fetch() throws when it can't even reach the server
    // (backend not running, wrong URL, no internet, etc).
    throw new ApiError('Could not reach the server. Is the backend running?', 0);
  }

  // 401 means "your login expired". Instead of immediately giving up,
  // try to silently get a new access_token using the refresh_token,
  // then retry the SAME request one time. The user never notices.
  if (response.status === 401 && auth && retry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return apiFetch(path, options, { auth, retry: false });
    }
    // Refresh also failed — the person really does need to log in again.
    Tokens.clear();
    showAuthView();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      const raw = body.detail || body.message;
      if (Array.isArray(raw)) {
        // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
        detail = raw.map((e) => (typeof e === 'string' ? e : (e.msg || JSON.stringify(e)))).join('; ');
      } else if (raw) {
        detail = raw;
      }
    } catch (_) { /* no json body */ }
    throw new ApiError(detail, response.status);
  }

  // 204 = "success, but nothing to send back". Otherwise, read the
  // response as text and parse it as JSON (if there's anything there).
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Tries to swap the (long-lived) refresh_token for a brand new
// access_token. Returns true if it worked, false if not — it never
// throws, because apiFetch just wants a yes/no answer.
async function tryRefreshToken() {
  if (!Tokens.refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: Tokens.refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    Tokens.set(data.access_token, data.refresh_token || Tokens.refresh);
    return true;
  } catch (_) {
    return false;
  }
}

// This is the full list of backend endpoints the app can call.
// Grouping them here means the rest of the code just calls
// Api.login(...) or Api.uploadResume(...) instead of repeating
// URLs and fetch() options everywhere.
const Api = {
  register: (payload) => apiFetch('/register', { method: 'POST', body: JSON.stringify(payload) }, { auth: false }),
  activateAccount: (token) => apiFetch(`/activate?token=${encodeURIComponent(token)}`, { method: 'GET', cache: 'no-store' }, { auth: false }),
  login: (payload) => apiFetch('/login', { method: 'POST', body: JSON.stringify(payload) }, { auth: false }),
  forgotPassword: (email) => apiFetch('/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, { auth: false }),
  resetPassword: (token, password, confirmPassword) => apiFetch(
    `/reset-password?token=${encodeURIComponent(token)}`,
    { method: 'POST', body: JSON.stringify({ password, confirm_password: confirmPassword }) },
    { auth: false },
  ),
  logout: () => apiFetch('/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: Tokens.refresh }),
  }),

  uploadResume: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch('/resume', { method: 'POST', body: fd });
  },
  uploadJd: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiFetch('/jd', { method: 'POST', body: fd });
  },

  runAnalysis: () => apiFetch('/analysis', {
    method: 'POST',
    body: JSON.stringify({}),
  }),

  generateRoadmap: () => apiFetch('/generate_road_map', {
    method: 'POST',
    body: JSON.stringify({}),
  }),

  startInterview: (type) => apiFetch('/question', { method: 'POST', body: JSON.stringify({ type }) }),
  submitInterviewAnswer: (answer) => apiFetch('/question_answer', {
    method: 'POST',
    body: JSON.stringify({ answer }),
  }),

  generateQuestions: () => apiFetch('/question%20generation', { method: 'POST' }),

  getReport: () => apiFetch('/report', { method: 'POST' }),
  getDashboard: () => apiFetch('/dashboard', { method: 'GET' }),
  getHistory: () => apiFetch('/history', { method: 'GET' }),
};

/* ---------------------------------------------------------
   Toast
   A "toast" is the small message box that pops up in a corner,
   shows a message for a few seconds, then disappears on its own.
   --------------------------------------------------------- */

let toastTimer = null;
function toast(message, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('is-error', isError);
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

// Shared guard used by Roadmap / Interview / Question bank actions
// below. Returns true if it's safe to call the backend (an analysis
// has actually run in this session). If not, it shows a toast
// pointing the person at the Upload page and returns false, so the
// caller can bail out before ever hitting the network — this stops
// the backend's account-level "last generated" data from appearing
// as if it belonged to a fresh, empty session (see the note at the
// top of this file).
function requireAnalysisThisSession(actionLabel) {
  if (state.analysis) return true;
  toast(`Run an analysis first before you ${actionLabel}.`, true);
  goToRoute('upload');
  return false;
}

/* ---------------------------------------------------------
   View switching: auth <-> app shell

   The whole app only has TWO top-level "screens": the login/
   register screen, and the main app (sidebar + pages). These two
   functions just show one and hide the other.
   --------------------------------------------------------- */

function showAuthView() {
  document.getElementById('view-auth').style.display = 'flex';
  document.getElementById('view-app').classList.remove('is-active');
}

function showAppView() {
  document.getElementById('view-auth').style.display = 'none';
  document.getElementById('view-app').classList.add('is-active');
  const userLabel = document.getElementById('side-user');
  userLabel.textContent = state.user ? (state.user.name || state.user.email) : '—';
}

/* ---------------------------------------------------------
   Routing within the app shell

   This is a "single-page app" — there's only ever ONE index.html.
   Clicking a sidebar link doesn't load a new page; it just hides
   every <section class="route"> except the one we want, using CSS
   classes. goToRoute('analysis') shows #route-analysis, for example.
   --------------------------------------------------------- */

function goToRoute(name) {
  document.querySelectorAll('.side__link[data-route]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.route === name);
  });
  document.querySelectorAll('.route').forEach((section) => {
    section.classList.toggle('is-active', section.id === `route-${name}`);
  });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

document.querySelectorAll('[data-route]').forEach((el) => {
  el.addEventListener('click', () => goToRoute(el.dataset.route));
});

/* ---------------------------------------------------------
   Auth: tabs, login, register, logout

   This section handles everything about signing in:
   - switching between the "Sign in" / "Create account" tabs
   - submitting the login form
   - submitting the register form
   - forgot password → reset password (via an emailed link)
   - signing out

   Each form has an `addEventListener('submit', ...)` — that code
   runs the moment the user clicks the form's submit button.
   --------------------------------------------------------- */

document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('is-active'));
    document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('is-active'));
    tab.classList.add('is-active');
    document.getElementById(`form-${tab.dataset.authTab}`).classList.add('is-active');
  });
});

// Runs when the login form is submitted.
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault(); // stop the browser from doing a full page reload
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  const formData = new FormData(e.target);
  const payload = { email: formData.get('email'), password: formData.get('password') };
  try {
    const data = await Api.login(payload);
    Tokens.set(data.access_token, data.refresh_token);
    state.user = data.user || { email: payload.email };
    localStorage.setItem('redline_user', JSON.stringify(state.user));
    showAppView();
    loadDashboard();
    toast('Signed in.');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not sign in.';
  }
});

// Runs when the register form is submitted. Note: the backend
// requires the person to click an activation link in their email
// before they can log in — so we don't log them in automatically.
document.getElementById('form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  const successEl = document.getElementById('register-success');
  errorEl.textContent = '';
  successEl.hidden = true;
  const formData = new FormData(e.target);
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirm_password');

  // Frontend validation — mirrors the backend's rules so the person
  // gets instant feedback instead of waiting on a round trip. The
  // backend re-checks all of this regardless, so this is purely UX.
  if (!name || !email || !password || !confirmPassword) {
    errorEl.textContent = 'Please fill in all fields.';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters long.';
    return;
  }
  if (password !== confirmPassword) {
    errorEl.textContent = 'Password and Confirm Password do not match.';
    return;
  }

  const payload = { name, email, password, confirm_password: confirmPassword };
  try {
    await Api.register(payload);
    successEl.hidden = false;
    successEl.textContent = 'Account created. Check your email for an activation link before signing in.';
    e.target.reset();
  } catch (err) {
    errorEl.textContent = err.message || 'Could not create account.';
  }
});

// Runs when the "Log out" button is clicked.
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      // Tell the backend to invalidate the refresh token server-side.
      await Api.logout();
    } catch (err) {
      // Even if this fails (token already expired, server unreachable,
      // etc.) we still want to log the user out on the client.
      console.warn('Logout request failed, clearing session locally anyway:', err);
    } finally {
      Tokens.clear();
      state.user = null;
      state.resumeId = null;
      state.jdId = null;
      state.analysis = null;
      state.interview = { type: null, currentQuestion: null, history: [] };
      state.questions = { all: null };
      state.report = null;
      state.reportBlob = null;
      state.reportFileName = null;
      state.history = null;

      showAuthView();
      toast('Signed out.');
    }
  });
} else {
  console.warn('Logout button (#btn-logout) not found in the page — check the id in your HTML.');
}

// Switches which little form is visible inside the auth card
// (login / register / forgot password / reset password).
function showAuthForm(name) {
  document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('is-active'));
  document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('is-active'));
  document.getElementById(`form-${name}`).classList.add('is-active');
  const matchingTab = document.querySelector(`.auth-tab[data-auth-tab="${name}"]`);
  if (matchingTab) matchingTab.classList.add('is-active');
}

document.getElementById('link-forgot-password').addEventListener('click', () => showAuthForm('forgot'));
document.getElementById('link-back-to-login').addEventListener('click', () => showAuthForm('login'));

// "Forgot password" form: just asks the backend to email a reset link.
document.getElementById('form-forgot').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('forgot-error');
  errorEl.textContent = '';
  const email = new FormData(e.target).get('email');
  try {
    await Api.forgotPassword(email);
    toast('Reset link sent — check your email.');
    showAuthForm('login');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not send reset link.';
  }
});

// "Reset password" form: the token comes from the email link (see
// checkForAuthRedirects below), the person just types a new password.
document.getElementById('form-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('reset-error');
  errorEl.textContent = '';
  const formData = new FormData(e.target);
  const token = formData.get('token');
  const newPassword = formData.get('new_password');
  const confirmNewPassword = formData.get('confirm_new_password');

  if (!newPassword || !confirmNewPassword) {
    errorEl.textContent = 'Please fill in both password fields.';
    return;
  }
  if (newPassword.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters long.';
    return;
  }
  if (newPassword !== confirmNewPassword) {
    errorEl.textContent = 'Password and Confirm Password do not match.';
    return;
  }

  try {
    await Api.resetPassword(token, newPassword, confirmNewPassword);
    toast('Password reset. Sign in with your new password.');
    window.history.replaceState({}, '', window.location.pathname);
    showAuthForm('login');
  } catch (err) {
    errorEl.textContent = err.message || 'Could not reset password.';
  }
});

// Handles two kinds of email links landing on this static site:
// - /activate?token=...        → call the backend to activate, then show login
// - /reset-password?token=...  → pre-fill and show the reset-password form
async function checkForAuthRedirects() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const path = window.location.pathname;

  // Account activation
  if (path.includes('/activate')) {
    if (token) {
      try {
        await Api.activateAccount(token);
        toast('Account activated — you can sign in now.');
      } catch (err) {
        toast(err.message || 'Could not activate account.', true);
      }
    }

    window.history.replaceState({}, '', '/');
    showAuthForm('login');
    return true;
  }

  // Reset password
  if (path.includes('/reset-password') && token) {
    document.getElementById('reset-token-field').value = token;

    // Remove token from URL
    window.history.replaceState({}, '', '/');

    showAuthForm('reset');
    return true;
  }

  return false;
}

/* ---------------------------------------------------------
   Upload: resume + job description

   A "dropzone" is the box you can either click (to open a file
   picker) or drag a file onto. wireDropzone() is a reusable helper
   so we don't have to write this logic twice — once for the resume
   box, once for the job description box (see the two calls below).
   --------------------------------------------------------- */

function wireDropzone({ dzId, inputId, nameId, uploadBtnId, statusId, onUpload }) {
  const dz = document.getElementById(dzId);
  const input = document.getElementById(inputId);
  const nameEl = document.getElementById(nameId);
  const uploadBtn = document.getElementById(uploadBtnId);
  const statusEl = document.getElementById(statusId);
  let selectedFile = null;

  function selectFile(file) {
    selectedFile = file;
    nameEl.textContent = file ? file.name : 'No file selected';
    uploadBtn.disabled = !file;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error');
  }

  input.addEventListener('change', () => selectFile(input.files[0] || null));

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('is-dragover');
    const file = e.dataTransfer.files[0];
    if (file) { input.files = e.dataTransfer.files; selectFile(file); }
  });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    uploadBtn.disabled = true;
    statusEl.textContent = 'Uploading…';
    statusEl.classList.remove('is-error');
    try {
      const result = await onUpload(selectedFile);
      statusEl.textContent = 'Uploaded.';
      checkUploadReady();
      return result;
    } catch (err) {
      statusEl.textContent = err.message || 'Upload failed.';
      statusEl.classList.add('is-error');
      uploadBtn.disabled = false;
    }
  });
}

wireDropzone({
  dzId: 'dz-resume', inputId: 'input-resume', nameId: 'file-resume-name',
  uploadBtnId: 'btn-upload-resume', statusId: 'status-resume',
  onUpload: async (file) => {
    const data = await Api.uploadResume(file);
    state.resumeId = data.id || true;
    return data;
  },
});

wireDropzone({
  dzId: 'dz-jd', inputId: 'input-jd', nameId: 'file-jd-name',
  uploadBtnId: 'btn-upload-jd', statusId: 'status-jd',
  onUpload: async (file) => {
    const data = await Api.uploadJd(file);
    state.jdId = data.id || true;
    return data;
  },
});

// The "Run analysis" button only makes sense once BOTH a resume and
// a job description have been uploaded — this enables/disables it.
function checkUploadReady() {
  const ready = !!(state.resumeId && state.jdId);
  document.getElementById('btn-run-analysis').disabled = !ready;
  document.getElementById('upload-hint').textContent = ready
    ? 'Both documents are in. Run the analysis when you\'re ready.'
    : 'Upload both documents to continue.';
}

document.getElementById('btn-run-analysis').addEventListener('click', async () => {
  const btn = document.getElementById('btn-run-analysis');
  btn.disabled = true;
  btn.textContent = 'Running analysis…';
  try {
    const analysis = await Api.runAnalysis();
    state.analysis = analysis;
    renderAnalysis(analysis);
    goToRoute('analysis');
    toast('Analysis complete.');
  } catch (err) {
    toast(err.message || 'Analysis failed.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run analysis →';
  }
});

/* ---------------------------------------------------------
   Analysis rendering

   Turns the raw JSON the backend sends back (skills, score,
   strengths/weaknesses) into the visuals on the Analysis page —
   the circular score ring, the colored skill "tags", and the lists.
   --------------------------------------------------------- */

function renderTagCloud(container, items, variant) {
  container.innerHTML = '';
  if (!items || !items.length) {
    container.innerHTML = `<span style="color:var(--text-dim);font-size:0.85rem;">None recorded.</span>`;
    return;
  }
  items.forEach((skill) => {
    const tag = document.createElement('span');
    tag.className = `tag tag--${variant}`;
    tag.textContent = skill;
    container.appendChild(tag);
  });
}

function renderList(container, items) {
  container.innerHTML = '';
  if (!items || !items.length) {
    container.innerHTML = '<li style="color:var(--text-dim);">Nothing recorded.</li>';
    return;
  }
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderAnalysis(analysis) {
  document.getElementById('analysis-empty').hidden = true;
  document.getElementById('analysis-body').hidden = false;

  const score = Math.round(analysis.match_score || 0);
  document.getElementById('score-value').textContent = score;
  const circumference = 326.7;
  const offset = circumference - (circumference * Math.min(score, 100)) / 100;
  document.getElementById('score-ring-fill').style.strokeDashoffset = offset;

  const headline = document.getElementById('score-headline');
  const sub = document.getElementById('score-sub');
  if (score >= 80) { headline.textContent = 'Strong match'; sub.textContent = 'This resume covers most of what the role asks for.'; }
  else if (score >= 50) { headline.textContent = 'Partial match'; sub.textContent = 'A solid base, with real gaps worth closing.'; }
  else { headline.textContent = 'Wide gap'; sub.textContent = 'This role calls for skills the resume doesn\'t show yet.'; }

  renderTagCloud(document.getElementById('tags-matching'), analysis.matching_skills, 'match');
  renderTagCloud(document.getElementById('tags-missing'), analysis.missing_skills, 'gap');
  renderList(document.getElementById('list-strengths'), analysis.strengths);
  renderList(document.getElementById('list-weaknesses'), analysis.weaknesses);
}

document.getElementById('btn-to-roadmap').addEventListener('click', async () => {
  // Reached via the Analysis page's own "Build a roadmap" button, so
  // state.analysis is guaranteed to be set already — no guard needed
  // here, but buildRoadmapFromGaps() below still double-checks.
  goToRoute('roadmap');
  await buildRoadmapFromGaps();
});

/* ---------------------------------------------------------
   Roadmap

   Draws the week-by-week learning plan the backend generates
   from your missing skills.

   Guarded by requireAnalysisThisSession() (see note at top of file)
   so that opening this page cold — without having run an analysis
   in this session — never triggers a backend call that could return
   a stale, previously-generated roadmap for the account.
   --------------------------------------------------------- */

// The backend sends learning_plan as an object like
// { week_1: "Learn Java basics", week_2: "..." } — this turns
// each key/value pair into one row in the timeline.
function renderTimeline(learningPlan) {
  const container = document.getElementById('roadmap-timeline');
  document.getElementById('roadmap-empty').hidden = true;
  container.innerHTML = '';

  const entries = learningPlan && typeof learningPlan === 'object' ? Object.entries(learningPlan) : [];
  if (!entries.length) {
    container.innerHTML = '<p style="color:var(--text-dim);">No plan returned. Run an analysis first so there are missing skills to plan around.</p>';
    return;
  }

  entries.forEach(([weekKey, description]) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const label = weekKey.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const week = document.createElement('div');
    week.className = 'timeline-item__week';
    week.textContent = label;
    const body = document.createElement('div');
    body.className = 'timeline-item__body';
    const p = document.createElement('p');
    p.textContent = description;
    body.appendChild(p);
    item.appendChild(week);
    item.appendChild(body);
    container.appendChild(item);
  });
}

async function buildRoadmapFromGaps() {
  if (!requireAnalysisThisSession('build a roadmap')) return;
  try {
    const result = await Api.generateRoadmap();
    renderTimeline(result.learning_plan);
  } catch (err) {
    toast(err.message || 'Could not build roadmap.', true);
  }
}

document.getElementById('btn-generate-roadmap').addEventListener('click', async () => {
  if (!requireAnalysisThisSession('generate a roadmap')) return;
  const btn = document.getElementById('btn-generate-roadmap');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const result = await Api.generateRoadmap();
    renderTimeline(result.learning_plan);
    toast('Roadmap ready.');
  } catch (err) {
    toast(err.message || 'Could not generate roadmap.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate roadmap';
  }
});

/* ---------------------------------------------------------
   Interview

   Flow: pick a type (technical/HR/mixed) → get one question →
   type an answer → submit → get a score + feedback + the NEXT
   question, all in the same response. Repeat as many times as
   you like; each answer gets added to the history list below.

   Guarded by requireAnalysisThisSession() so starting an interview
   cold (no upload/analysis this session) doesn't pull
   resume/JD-derived questions left over from a previous session.
   --------------------------------------------------------- */

// Starts a fresh interview of the chosen type and shows the
// first question on screen.
async function startInterview(type) {
  if (!requireAnalysisThisSession('start an interview')) return;
  try {
    const question = await Api.startInterview(type);
    state.interview.type = type;
    state.interview.currentQuestion = question.question;
    document.getElementById('interview-start').hidden = true;
    document.getElementById('interview-live').hidden = false;
    document.getElementById('interview-index').textContent = question.type || type;
    document.getElementById('interview-text').textContent = question.question;
    document.getElementById('interview-answer').value = '';
    document.getElementById('interview-eval').hidden = true;
  } catch (err) {
    toast(err.message || 'Could not start interview.', true);
  }
}

document.getElementById('btn-start-interview').addEventListener('click', () => {
  const type = document.getElementById('interview-type-select').value;
  startInterview(type);
});

document.getElementById('btn-restart-interview').addEventListener('click', () => {
  document.getElementById('interview-start').hidden = false;
  document.getElementById('interview-live').hidden = true;
});

document.getElementById('btn-submit-answer').addEventListener('click', async () => {
  const answer = document.getElementById('interview-answer').value.trim();
  if (!answer) { toast('Write an answer first.', true); return; }
  if (!state.interview.currentQuestion) { toast('No active question.', true); return; }

  const btn = document.getElementById('btn-submit-answer');
  btn.disabled = true;
  btn.textContent = 'Evaluating…';
  try {
    const result = await Api.submitInterviewAnswer(answer);
    document.getElementById('interview-eval').hidden = false;
    document.getElementById('interview-eval-text').textContent = result.feedback || 'No feedback returned.';
    document.getElementById('interview-eval-score').textContent = result.score != null ? `Score: ${result.score}/10` : '';

    state.interview.history.unshift({
      question: state.interview.currentQuestion,
      answer,
      feedback: result.feedback,
      score: result.score,
    });
    renderInterviewHistory();

    // The evaluation response carries the next question directly.
    state.interview.currentQuestion = result.next_question || null;
    if (result.next_question) {
      document.getElementById('interview-text').textContent = result.next_question;
      document.getElementById('interview-answer').value = '';
    }
    toast('Answer evaluated.');
  } catch (err) {
    toast(err.message || 'Could not evaluate answer.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit answer';
  }
});

function renderInterviewHistory() {
  const list = document.getElementById('interview-history-list');
  list.innerHTML = '';
  if (!state.interview.history.length) {
    list.innerHTML = '<p style="color:var(--text-dim);font-size:0.88rem;">No answers submitted yet.</p>';
    return;
  }
  state.interview.history.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'qa-item';

    const q = document.createElement('p');
    q.className = 'qa-item__q';
    q.textContent = item.question;

    const a = document.createElement('p');
    a.className = 'qa-item__a';
    a.textContent = item.answer;

    const s = document.createElement('p');
    s.className = 'qa-item__score';
    s.textContent = item.score != null ? `Score: ${item.score}/10 — ${item.feedback || ''}` : '';

    el.appendChild(q);
    el.appendChild(a);
    el.appendChild(s);
    list.appendChild(el);
  });
}

/* ---------------------------------------------------------
   Question bank

   One button generates FOUR separate lists of questions at once
   (technical, scenario, HR, project-based) based on your resume
   and job description — no extra input needed from the user.

   Guarded by requireAnalysisThisSession() for the same reason as
   Roadmap and Interview above.
   --------------------------------------------------------- */

function renderQuestionBank(data) {
  document.getElementById('qbank-empty').hidden = true;
  document.getElementById('qbank-body').hidden = false;

  const fill = (id, items) => {
    const ul = document.getElementById(id);
    ul.innerHTML = '';
    (items || []).forEach((q) => {
      const li = document.createElement('li');
      li.textContent = q;
      ul.appendChild(li);
    });
    if (!items || !items.length) {
      ul.innerHTML = '<li style="color:var(--text-dim);">None generated.</li>';
    }
  };

  fill('qbank-technical', data.technical_questions);
  fill('qbank-scenario', data.scenario_questions);
  fill('qbank-hr', data.HR_questions);
  fill('qbank-project', data.project_based_questions);
}

document.getElementById('btn-generate-questions').addEventListener('click', async () => {
  if (!requireAnalysisThisSession('generate questions')) return;
  const btn = document.getElementById('btn-generate-questions');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const result = await Api.generateQuestions();
    if (result.message) {
      toast(result.message, true);
      return;
    }
    state.questions.all = result;
    renderQuestionBank(result);
    toast('Questions generated.');
  } catch (err) {
    toast(err.message || 'Could not generate questions.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate questions';
  }
});

/* ---------------------------------------------------------
   Report

   POST /report now returns an actual .docx file (Word document),
   not JSON — the backend builds the Word doc itself (resume/JD
   summaries, match score, skills, learning plan, tips as headings/
   paragraphs) and streams it back as a FileResponse. Because the
   report content now lives inside Word paragraphs instead of a JSON
   body, the frontend can no longer read individual fields
   (resume_summary, match_score, etc.) out of the response — that
   data simply isn't available as structured data anymore. So this
   page no longer renders a field-by-field breakdown; it just
   confirms the report is ready and lets the person download the
   actual .docx file, the same way the History page already does for
   past reports.

   Guarded the same way as Roadmap/Interview/Question bank — see the
   note at the top of this file and the report-tab click handler
   near the bottom.
   --------------------------------------------------------- */

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text != null) node.textContent = opts.text;
  if (opts.html != null) node.innerHTML = opts.html;
  return node;
}

function reportSection(title, bodyNode) {
  const section = el('div', { className: 'report-section' });
  section.appendChild(el('h3', { text: title }));
  section.appendChild(bodyNode);
  return section;
}

// apiFetch() only returns a parsed JSON body — it can't handle a
// binary file response, and it discards headers anyway. The real
// filename (e.g. "report_27_2.docx") only exists in the
// Content-Disposition header, so this parses it out manually, same
// as a browser would for a native download prompt.
function parseFilenameFromContentDisposition(header) {
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

// Fetches the report as a raw Blob (it's a .docx file, not JSON),
// with the same manual auth + 401-refresh handling used elsewhere
// for file downloads (see downloadReportById below).
async function fetchReportRaw() {
  const headers = new Headers();
  if (Tokens.access) headers.set('Authorization', `Bearer ${Tokens.access}`);

  let response = await fetch(`${API_BASE}/report`, { method: 'POST', headers });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      Tokens.clear();
      showAuthView();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }
    headers.set('Authorization', `Bearer ${Tokens.access}`);
    response = await fetch(`${API_BASE}/report`, { method: 'POST', headers });
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch (_) { /* response body isn't JSON (it's a file) on success, only on error */ }
    throw new ApiError(detail, response.status);
  }

  const filename = parseFilenameFromContentDisposition(response.headers.get('Content-Disposition'));
  const blob = await response.blob();
  return { blob, filename };
}

async function loadReport() {
  try {
    const { blob, filename } = await fetchReportRaw();
    state.reportBlob = blob;
    state.reportFileName = filename; // real backend filename, e.g. report_27_2.docx
    document.getElementById('report-empty').hidden = true;

    const downloadBtn = document.getElementById('btn-download-report');
    downloadBtn.hidden = false;
    downloadBtn.textContent = filename ? `Download report (${filename})` : 'Download report (.docx)';

    const body = document.getElementById('report-body');
    body.hidden = false;
    body.innerHTML = '';
    body.appendChild(reportSection(
      'Your report is ready',
      el('p', { text: 'The full report — resume summary, match score, skills, learning plan, and prep tips — has been generated as a Word document. Use the download button above to save it.' }),
    ));

    // If an analysis was run earlier this session, we still have that
    // data in memory (state.analysis) — show a quick preview from it
    // as a bonus. This is NOT guaranteed to be the same analysis the
    // .docx was built from if the person ran a newer analysis without
    // reloading, so it's clearly labeled as a preview, not the report
    // itself.
    if (state.analysis) {
      const preview = el('div');
      preview.appendChild(el('p', { text: `Match score: ${Math.round(state.analysis.match_score || 0)}%` }));
      preview.appendChild(el('p', { text: `Matching skills: ${(state.analysis.matching_skills || []).join(', ') || 'None recorded.'}` }));
      preview.appendChild(el('p', { text: `Skill gap: ${(state.analysis.missing_skills || []).join(', ') || 'None recorded.'}` }));
      body.appendChild(reportSection('Preview (from your last analysis this session)', preview));
    }
  } catch (err) {
    toast(err.message || 'Could not load report.', true);
    console.error('loadReport failed:', err);
    showReportEmptyState(err);
  }
}

// The backend 404s at different points depending on what's missing
// (no analysis yet, no roadmap yet, etc — see run_report()). Rather
// than leaving the generic "No report yet" copy up, read the error
// message and point the person at the specific step they skipped.
function showReportEmptyState(err) {
  document.getElementById('report-body').hidden = true;
  document.getElementById('btn-download-report').hidden = true;
  document.getElementById('report-empty').hidden = false;

  const textEl = document.getElementById('report-empty-text');
  const ctaEl = document.getElementById('report-empty-cta');
  const msg = (err && err.message ? err.message : '').toLowerCase();

  if (err && err.status === 404 && msg.includes('roadmap')) {
    textEl.textContent = "This analysis doesn't have a roadmap yet — generate one, then come back for the report.";
    ctaEl.dataset.route = 'roadmap';
    ctaEl.textContent = 'Go to roadmap';
    ctaEl.hidden = false;
  } else if (err && err.status === 404 && msg.includes('analysis')) {
    textEl.textContent = 'No analysis yet. Upload a resume and job description, then run the analysis.';
    ctaEl.dataset.route = 'upload';
    ctaEl.textContent = 'Go to upload';
    ctaEl.hidden = false;
  } else if (err && err.status === 404 && (msg.includes('resume') || msg.includes('jd'))) {
    textEl.textContent = "The resume or job description behind this analysis is missing — try uploading again.";
    ctaEl.dataset.route = 'upload';
    ctaEl.textContent = 'Go to upload';
    ctaEl.hidden = false;
  } else {
    textEl.textContent = (err && err.message) || 'Could not load the report. Try again in a moment.';
    ctaEl.hidden = true;
  }
}

// Saves the .docx blob we already fetched — no extra request needed,
// state.reportBlob holds the actual file bytes from loadReport().
document.getElementById('btn-download-report').addEventListener('click', () => {
  if (!state.reportBlob) return;
  const url = URL.createObjectURL(state.reportBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.reportFileName || 'redline-report.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});


/* ---------------------------------------------------------
   History

   Fetches the user's past analyses from GET /history. Each entry
   has this exact shape (see the backend's user_history()):
     { analysis_id, resume_file, jd_file, report_id, report_name,
       created_at }
   One card per analysis, showing which resume was checked against
   which job description, whether a report was generated for it,
   and when it happened.

   Unlike Roadmap/Interview/Question bank/Report, History is
   intentionally NOT guarded by requireAnalysisThisSession() — its
   entire purpose is to show past account activity across sessions,
   so account-level (not session-level) data is exactly what should
   appear here.
   --------------------------------------------------------- */

async function loadHistory() {
  const emptyEl = document.getElementById('history-empty');
  const bodyEl = document.getElementById('history-body');
  try {
    const history = await Api.getHistory();
    state.history = history;
    const entries = Array.isArray(history) ? history : (history && history.items) || [];

    if (!entries.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.querySelector('p').textContent = "No history yet. Once you run an analysis, generate a roadmap, or complete an interview, it'll show up here.";
      }
      if (bodyEl) { bodyEl.hidden = true; bodyEl.innerHTML = ''; }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (bodyEl) {
      bodyEl.hidden = false;
      bodyEl.innerHTML = '';
      entries.forEach((entry) => bodyEl.appendChild(renderHistoryCard(entry)));
    }
  } catch (err) {
    toast(err.message || 'Could not load history.', true);
    console.error('loadHistory failed:', err);
    // A 401 here means the session died silently (see apiFetch) — don't
    // let it look like an empty history, since that hides a real problem
    // and sends the person hunting for data that was never actually queried.
    if (bodyEl) { bodyEl.hidden = true; bodyEl.innerHTML = ''; }
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.querySelector('p').textContent = err && err.status === 401
        ? 'Your session expired before this could load. Sign in again to see your history.'
        : (err.message || 'Could not load your history. Try again in a moment.');
    }
  }
}

// Turns a created_at timestamp (ISO string from the backend) into
// something readable like "14 Jul 2026, 3:45 PM". Falls back to the
// raw value if it can't be parsed, so a format change never breaks
// the page.
function formatHistoryDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Downloads one specific past report (GET /download-report/{analysis_id}?report_id=...).
// Not routed through apiFetch because apiFetch always tries to parse
// the response as JSON — this is a .docx file, so we need the raw
// bytes as a Blob so the browser can save it (same pattern as
// fetchReportRaw/loadReport above, just fetched fresh here instead of
// reused from state).
async function downloadReportById(analysisId, reportId, filename) {
  const url = `${API_BASE}/download-report/${analysisId}?report_id=${encodeURIComponent(reportId)}`;
  try {
    const headers = new Headers();
    if (Tokens.access) headers.set('Authorization', `Bearer ${Tokens.access}`);

    let response = await fetch(url, { headers });

    if (response.status === 401) {
      const refreshed = await tryRefreshToken();
      if (!refreshed) {
        Tokens.clear();
        showAuthView();
        throw new ApiError('Session expired. Please sign in again.', 401);
      }
      headers.set('Authorization', `Bearer ${Tokens.access}`);
      response = await fetch(url, { headers });
    }

    if (!response.ok) {
      let detail = `Could not download report (${response.status})`;
      try {
        const body = await response.json();
        if (body.detail) detail = body.detail;
      } catch (_) { /* no json body */ }
      throw new ApiError(detail, response.status);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || `report_${reportId}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    toast(err.message || 'Could not download report.', true);
  }
}

// Renders one analysis entry as a card, reusing the same
// ".report-section" look as the Report page.
function renderHistoryCard(entry) {
  if (!entry || typeof entry !== 'object') {
    return el('div', { className: 'report-section', text: String(entry) });
  }

  const {
    id: idField,
    analysis_id: analysisIdField, // backend has used both key names across versions — support both
    resume_file: resumeFile,
    jd_file: jdFile,
    report_id: reportId,
    report_name: reportName,
    created_at: createdAt,
  } = entry;
  const analysisId = analysisIdField != null ? analysisIdField : idField;

  const card = el('div', { className: 'report-section' });
  card.appendChild(el('h3', { text: analysisId != null ? `Analysis #${analysisId}` : 'Analysis' }));
  if (createdAt) {
    const dateP = el('p', { text: formatHistoryDate(createdAt) });
    dateP.style.color = 'var(--text-dim)';
    dateP.style.fontSize = '0.85rem';
    card.appendChild(dateP);
  }

  const resumeP = el('p');
  resumeP.appendChild(el('strong', { text: 'Resume: ' }));
  resumeP.appendChild(document.createTextNode(resumeFile || 'Not available'));
  card.appendChild(resumeP);

  const jdP = el('p');
  jdP.appendChild(el('strong', { text: 'Job description: ' }));
  jdP.appendChild(document.createTextNode(jdFile || 'Not available'));
  card.appendChild(jdP);

  const reportP = el('p');
  reportP.appendChild(el('strong', { text: 'Report: ' }));
  reportP.appendChild(document.createTextNode(reportId ? (reportName || `Report #${reportId}`) : 'Not generated yet'));
  card.appendChild(reportP);

  if (reportId) {
    const label = reportName ? `Download report (${reportName})` : 'Download report (.docx)';
    const downloadBtn = el('button', { className: 'btn btn--ghost', text: label });
    downloadBtn.style.marginTop = '0.6rem';
    downloadBtn.addEventListener('click', () => downloadReportById(analysisId, reportId, reportName || `report_${reportId}.docx`));
    card.appendChild(downloadBtn);
  }

  return card;
}

// Report tab click: only ask the backend for a report if this
// session has actually run an analysis (state.analysis is set).
// Otherwise POST /report would return whatever report this account
// generated last time — possibly from days ago — and show it as if
// it were current, even though the person hasn't uploaded or
// analyzed anything yet in this session.
document.querySelector('[data-route="report"]').addEventListener('click', () => {
  if (!state.analysis) {
    showReportEmptyState({
      status: 404,
      message: 'No analysis yet. Upload a resume and job description, then run the analysis.',
    });
    return;
  }
  loadReport();
});

document.querySelector('[data-route="dashboard"]').addEventListener('click', loadDashboard);
document.querySelector('[data-route="history"]')?.addEventListener('click', loadHistory);

/* ---------------------------------------------------------
   Dashboard

   A quick read-only snapshot: profile info, plus a status card
   for each feature (uploaded? analyzed? interviewed? planned?).

   Intentionally NOT guarded by requireAnalysisThisSession() — like
   History, the Dashboard's whole job is to summarize the account's
   overall state (has a resume ever been uploaded, has an analysis
   ever been run, etc), independent of what happened in this
   particular browser session.
   --------------------------------------------------------- */

async function loadDashboard() {
  const body = document.getElementById('dashboard-body');
  try {
    const data = await Api.getDashboard();

    const greeting = document.getElementById('dashboard-greeting');
    if (data.profile) {
      greeting.textContent = `Welcome back, ${data.profile.name || data.profile.email}`;
    }

    body.innerHTML = '';

    body.appendChild(reportSection('Resume', el('p', {
      text: data.resume ? `Uploaded: ${data.resume.file_name}` : 'No resume uploaded yet.',
    })));

    body.appendChild(reportSection('Job description', el('p', {
      text: data.jd ? `Uploaded: ${data.jd.file_name}` : 'No job description uploaded yet.',
    })));

    const analysisWrap = el('div');
    if (data.analysis) {
      analysisWrap.appendChild(el('p', { text: `Match score: ${Math.round(data.analysis.match_score || 0)}%` }));
      analysisWrap.appendChild(el('p', { text: `Missing skills: ${(data.analysis.missing_skills || []).join(', ') || 'None'}` }));
    } else {
      analysisWrap.appendChild(el('p', { text: 'No analysis run yet.' }));
    }
    body.appendChild(reportSection('Analysis', analysisWrap));

    body.appendChild(reportSection('Roadmap', el('p', {
      text: data.roadmap ? `Skills planned: ${(data.roadmap.missing_skills || '').toString() || 'None'}` : 'No roadmap generated yet.',
    })));
  } catch (err) {
    body.innerHTML = '';
    const empty = el('div', { className: 'empty' });
    empty.appendChild(el('p', { text: 'Could not load your dashboard yet. Try uploading a resume and job description to get started.' }));
    body.appendChild(empty);
  }
}

/* ---------------------------------------------------------
   Boot

   Everything above just DEFINES functions and attaches click
   listeners — nothing actually runs yet. boot() is the function
   that kicks things off the moment this file finishes loading.
   --------------------------------------------------------- */

async function boot() {
  // Restore user info
  const storedUser = localStorage.getItem('redline_user');
  if (storedUser) {
    try {
      state.user = JSON.parse(storedUser);
    } catch (_) {
      state.user = null;
    }
  }

  // Handle activation/reset links FIRST
  const handled = await checkForAuthRedirects();

  if (handled) {
    showAuthView();
    checkUploadReady();
    renderInterviewHistory();
    return;
  }

  // Normal startup
  if (Tokens.isAuthenticated) {
    showAppView();
    loadDashboard();
  } else {
    showAuthView();
  }

  checkUploadReady();
  renderInterviewHistory();
}

// Start app
boot();
