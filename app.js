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
   8. Analysis / Roadmap / Interview / Question bank / Report
                    — one section per app feature.
   9. Boot         — the very last thing that runs, kicks everything off.

   If you're new to JavaScript: "async function" means the function
   can "await" something slow (like a network request) without
   freezing the page. "addEventListener('click', ...)" means
   "run this code when the user clicks this button".
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
  resetPassword: (token, newPassword) => apiFetch(
    `/reset-password?token=${encodeURIComponent(token)}`,
    { method: 'POST', body: JSON.stringify({ password: newPassword }) },
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
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  };
  try {
    await Api.register(payload);
    successEl.hidden = false;
    successEl.textContent = 'Account created. Check your email for an activation link before signing in.';
    e.target.reset();
  } catch (err) {
    errorEl.textContent = err.message || 'Could not create account.';
  }
});

// Runs when the "Log out" button is clicked. This was previously
// MISSING — Api.logout() existed but nothing ever called it, so
// clicking logout (if a button even existed) did nothing.
//
// NOTE: if your logout button's id in the HTML is not "btn-logout",
// update the id below to match.
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

      showAuthView();
      toast('Signed out.');
    }
  });
} else {
  // Helps you catch a mismatched id quickly instead of silently
  // doing nothing.
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
  try {
    await Api.resetPassword(token, newPassword);
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
    container.innerHTML = `<span style="color:var(--paper-dim);font-size:0.85rem;">None recorded.</span>`;
    return;
  }
  items.forEach((skill, i) => {
    const tag = document.createElement('span');
    tag.className = `tag tag--${variant}`;
    tag.textContent = skill;
    tag.style.setProperty('--tilt', `${(i % 3 - 1) * 1.2}deg`);
    container.appendChild(tag);
  });
}

function renderList(container, items) {
  container.innerHTML = '';
  if (!items || !items.length) {
    container.innerHTML = '<li style="color:var(--paper-dim);">Nothing recorded.</li>';
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
  goToRoute('roadmap');
  await buildRoadmapFromGaps();
});

/* ---------------------------------------------------------
   Roadmap

   Draws the week-by-week learning plan the backend generates
   from your missing skills.
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
    container.innerHTML = '<p style="color:var(--paper-dim);">No plan returned. Run an analysis first so there are missing skills to plan around.</p>';
    return;
  }

  entries.forEach(([weekKey, description]) => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const label = weekKey.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    item.innerHTML = `
      <div class="timeline-item__week">${label}</div>
      <div class="timeline-item__body">
        <p>${description}</p>
      </div>`;
    container.appendChild(item);
  });
}

async function buildRoadmapFromGaps() {
  try {
    const result = await Api.generateRoadmap();
    renderTimeline(result.learning_plan);
  } catch (err) {
    toast(err.message || 'Could not build roadmap.', true);
  }
}

document.getElementById('btn-generate-roadmap').addEventListener('click', async () => {
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
   --------------------------------------------------------- */

// Starts a fresh interview of the chosen type and shows the
// first question on screen.
async function startInterview(type) {
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
    list.innerHTML = '<p style="color:var(--paper-dim);font-size:0.88rem;">No answers submitted yet.</p>';
    return;
  }
  state.interview.history.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'qa-item';
    el.innerHTML = `
      <p class="qa-item__q">${item.question}</p>
      <p class="qa-item__a">${item.answer}</p>
      <p class="qa-item__score">${item.score != null ? `Score: ${item.score}/10 — ${item.feedback || ''}` : ''}</p>`;
    list.appendChild(el);
  });
}

/* ---------------------------------------------------------
   Question bank

   One button generates FOUR separate lists of questions at once
   (technical, scenario, HR, project-based) based on your resume
   and job description — no extra input needed from the user.
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
      ul.innerHTML = '<li style="color:var(--paper-dim);">None generated.</li>';
    }
  };

  fill('qbank-technical', data.technical_questions);
  fill('qbank-scenario', data.scenario_questions);
  fill('qbank-hr', data.HR_questions);
  fill('qbank-project', data.project_based_questions);
}

document.getElementById('btn-generate-questions').addEventListener('click', async () => {
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

   Fetches a full summary (resume/JD summaries, score, skill gap,
   learning plan, tips) and both displays it AND lets the person
   download it as a .json file to keep.
   --------------------------------------------------------- */

async function loadReport() {
  try {
    const report = await Api.getReport();
    state.report = report;
    document.getElementById('report-empty').hidden = true;
    document.getElementById('btn-download-report').hidden = false;
    const body = document.getElementById('report-body');
    body.hidden = false;

    const weekRows = report.learning_plan
      ? Object.entries(report.learning_plan).map(([week, desc]) => `<p><strong>${week.replace('_', ' ')}:</strong> ${desc}</p>`).join('')
      : '<p>No learning plan yet.</p>';

    // report.questions is a list of question-bank batches — each one
    // an object like { technical_questions: [...], scenario_questions: [...],
    // HR_questions: [...], project_based_questions: [...] }.
    const questionRows = (report.questions || []).map((batch, i) => {
      if (!batch || typeof batch !== 'object') return '';
      const section = (label, items) => (items && items.length)
        ? `<p><strong>${label}:</strong></p><ul>${items.map((q) => `<li>${q}</li>`).join('')}</ul>`
        : '';
      return `
        <div style="margin-bottom:1.2rem;">
          ${section('Technical', batch.technical_questions)}
          ${section('Scenario', batch.scenario_questions)}
          ${section('HR', batch.HR_questions)}
          ${section('Project-based', batch.project_based_questions)}
        </div>`;
    }).join('');

    body.innerHTML = `
      <div class="report-section">
        <h3>Resume summary</h3>
        <p>${report.resume_summary || 'Not available.'}</p>
      </div>
      <div class="report-section">
        <h3>Job description summary</h3>
        <p>${report.jd_summary || 'Not available.'}</p>
      </div>
      <div class="report-section">
        <h3>Match score</h3>
        <p>${Math.round(report.match_score || 0)}% match against the job description on file.</p>
      </div>
      <div class="report-section">
        <h3>Skill gap</h3>
        <p>${(report.skill_gap || []).join(', ') || 'None recorded.'}</p>
      </div>
      <div class="report-section">
        <h3>Learning plan</h3>
        ${weekRows}
      </div>
      <div class="report-section">
        <h3>Practice questions</h3>
        ${questionRows || '<p>None generated.</p>'}
      </div>
      <div class="report-section">
        <h3>Prep tips</h3>
        <p>${report.tips || 'No tips yet.'}</p>
      </div>`;
  } catch (err) {
    // Previously this was silent, so a failed request just left the
    // empty state showing with no indication anything went wrong.
    // Now we surface the real error so it's obvious what happened.
    toast(err.message || 'Could not load report.', true);
    console.error('loadReport failed:', err);
  }
}

// Turns the report we already have in memory into a downloadable
// .json file — no extra request to the backend needed. This is a
// common browser trick: wrap the data in a Blob, make a temporary
// invisible link pointing at it, "click" that link with code, then
// clean up.
document.getElementById('btn-download-report').addEventListener('click', () => {
  if (!state.report) return;
  const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'redline-report.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.querySelector('[data-route="report"]').addEventListener('click', loadReport);
document.querySelector('[data-route="dashboard"]').addEventListener('click', loadDashboard);

/* ---------------------------------------------------------
   Dashboard

   A quick read-only snapshot: profile info, plus a status card
   for each feature (uploaded? analyzed? interviewed? planned?).
   --------------------------------------------------------- */

async function loadDashboard() {
  const body = document.getElementById('dashboard-body');
  try {
    const data = await Api.getDashboard();

    const greeting = document.getElementById('dashboard-greeting');
    if (data.profile) {
      greeting.textContent = `Welcome back, ${data.profile.name || data.profile.email}`;
    }

    const card = (title, content) => `
      <div class="report-section">
        <h3>${title}</h3>
        ${content}
      </div>`;

    body.innerHTML = [
      card('Resume', data.resume
        ? `<p>Uploaded: <strong>${data.resume.file_name}</strong></p>`
        : `<p>No resume uploaded yet.</p>`),
      card('Job description', data.jd
        ? `<p>Uploaded: <strong>${data.jd.file_name}</strong></p>`
        : `<p>No job description uploaded yet.</p>`),
      card('Analysis', data.analysis
        ? `<p>Match score: <strong>${Math.round(data.analysis.match_score || 0)}%</strong></p>
           <p>Missing skills: ${(data.analysis.missing_skills || []).join(', ') || 'None'}</p>`
        : `<p>No analysis run yet.</p>`),
      card('Roadmap', data.roadmap
        ? `<p>Skills planned: ${(data.roadmap.missing_skills || '').toString() || 'None'}</p>`
        : `<p>No roadmap generated yet.</p>`),
    ].join('');
  } catch (err) {
    body.innerHTML = `<div class="empty"><p>Could not load your dashboard yet. Try uploading a resume and job description to get started.</p></div>`;
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
