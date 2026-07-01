const state = {
  me: null,
  papers: [],
  questions: [],
  selectedPaperId: null,
  currentQuestion: null,
  attempts: 0,
  answeredCount: 0,
  canViewAnswers: true,
  settings: null,
  uploading: false,
  participation: null,
  leaderboard: [],
};

const el = {
  authBox: document.getElementById('authBox'),
  adminPanel: document.getElementById('adminPanel'),
  sessionBar: document.getElementById('sessionBar'),
  paperList: document.getElementById('paperList'),
  sourceList: document.getElementById('sourceList'),
  questionList: document.getElementById('questionList'),
  paperTitle: document.getElementById('paperTitle'),
  paperMeta: document.getElementById('paperMeta'),
  paperBadge: document.getElementById('paperBadge'),
  participationBox: document.getElementById('participationBox'),
  questionPrompt: document.getElementById('questionPrompt'),
  answerArea: document.getElementById('answerArea'),
  feedback: document.getElementById('feedback'),
  leaderboardBox: document.getElementById('leaderboardBox'),
  statusText: document.getElementById('statusText'),
  paperCount: document.getElementById('paperCount'),
  questionCount: document.getElementById('questionCount'),
  attemptCount: document.getElementById('attemptCount'),
  progressBar: document.getElementById('progressBar'),
  reloadPapersBtn: document.getElementById('reloadPapersBtn'),
  randomBtn: document.getElementById('randomBtn'),
  prevBtn: document.getElementById('prevBtn'),
  checkBtn: document.getElementById('checkBtn'),
  showBtn: document.getElementById('showBtn'),
  nextBtn: document.getElementById('nextBtn'),
};

el.reloadPapersBtn.addEventListener('click', loadPapers);
el.randomBtn.addEventListener('click', loadRandomQuestion);
el.prevBtn.addEventListener('click', () => moveQuestion(-1));
el.nextBtn.addEventListener('click', () => moveQuestion(1));
el.checkBtn.addEventListener('click', submitAnswer);
el.showBtn.addEventListener('click', revealAnswer);

bootstrap();

async function bootstrap() {
  await loadMe();
  await loadPapers();
  renderAll();
}

async function loadMe() {
  const res = await fetch('/api/me');
  state.me = await res.json();
  if (state.me?.isOwner) {
    const settingsRes = await fetch('/api/admin/settings');
    state.settings = settingsRes.ok ? await settingsRes.json() : null;
  } else {
    state.settings = null;
  }
  renderAuth();
}

async function loadPapers() {
  const res = await fetch('/api/papers');
  state.papers = res.ok ? await res.json() : [];
  if (state.selectedPaperId && !state.papers.some((p) => String(p.id) === String(state.selectedPaperId))) {
    state.selectedPaperId = null;
    state.currentQuestion = null;
  }
  if (!state.selectedPaperId && state.papers.length) {
    state.selectedPaperId = state.papers[0].id;
  }
  await loadQuestions();
  await loadParticipation();
  await loadProgress();
  await loadLeaderboard();
  renderPapers();
  renderSources();
  renderQuestions();
  renderStats();
}

async function loadQuestions() {
  if (!state.selectedPaperId) {
    state.questions = [];
    return;
  }
  const res = await fetch(`/api/questions?paperId=${encodeURIComponent(state.selectedPaperId)}&limit=300`);
  state.questions = res.ok ? await res.json() : [];
}



async function loadParticipation() {
  if (!state.me || !state.selectedPaperId) {
    state.participation = null;
    return;
  }
  const res = await fetch(`/api/papers/${encodeURIComponent(state.selectedPaperId)}/participation`);
  state.participation = res.ok ? await res.json() : null;
}

async function loadLeaderboard() {
  if (!state.selectedPaperId) {
    state.leaderboard = [];
    return;
  }
  const res = await fetch(`/api/papers/${encodeURIComponent(state.selectedPaperId)}/leaderboard`);
  state.leaderboard = res.ok ? await res.json() : [];
}

function renderParticipation() {
  if (!el.participationBox) return;
  if (!state.me || !state.selectedPaperId) {
    el.participationBox.innerHTML = '';
    return;
  }
  if (!state.participation?.selected) {
    el.participationBox.innerHTML = `
      <div class="participation-card">
        <strong>是否参与本试卷排行榜？</strong>
        <div class="actions">
          <button id="joinRankBtn" type="button">参与</button>
          <button id="practiceOnlyBtn" type="button" class="ghost">仅练习</button>
        </div>
      </div>
    `;
    document.getElementById('joinRankBtn').onclick = () => setParticipation(true);
    document.getElementById('practiceOnlyBtn').onclick = () => setParticipation(false);
    return;
  }
  el.participationBox.innerHTML = `
    <div class="participation-card compact">
      <span>${state.participation.participate ? '已参与排行榜' : '仅练习，不计入排行榜'}</span>
      <button id="toggleParticipationBtn" type="button" class="ghost">${state.participation.participate ? '改为仅练习' : '参与排行榜'}</button>
    </div>
  `;
  document.getElementById('toggleParticipationBtn').onclick = () => setParticipation(!state.participation.participate);
}

async function setParticipation(participate) {
  if (!state.selectedPaperId) return;
  const res = await fetch(`/api/papers/${state.selectedPaperId}/participation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participate }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '保存参与状态失败');
  await loadParticipation();
  await loadProgress();
  await loadQuestions();
  await loadLeaderboard();
  renderParticipation();
  renderQuestions();
  renderQuestion();
  renderLeaderboard();
}

function renderLeaderboard() {
  if (!el.leaderboardBox) return;
  if (!state.selectedPaperId) {
    el.leaderboardBox.innerHTML = '';
    return;
  }
  if (!state.leaderboard.length) {
    el.leaderboardBox.innerHTML = `<div class="leaderboard"><strong>排行榜</strong><p class="muted">暂无参与记录。</p></div>`;
    return;
  }
  el.leaderboardBox.innerHTML = `
    <div class="leaderboard">
      <strong>排行榜</strong>
      ${state.leaderboard.map((row) => `
        <div class="rank-row">
          <span>${row.rank}</span>
          <b>${escapeHtml(row.username)}</b>
          <em>${row.correctCount}/${row.totalCount}</em>
        </div>
      `).join('')}
    </div>
  `;
}


async function loadProgress() {
  if (!state.me || !state.selectedPaperId) {
    state.attempts = 0;
    state.answeredCount = 0;
    state.canViewAnswers = true;
    return;
  }
  const res = await fetch(`/api/progress?paperId=${encodeURIComponent(state.selectedPaperId)}`);
  if (!res.ok) {
    state.attempts = 0;
    state.answeredCount = 0;
    state.canViewAnswers = true;
    return;
  }
  const data = await res.json();
  state.attempts = data.correctCount || 0;
  state.answeredCount = data.answeredCount || 0;
  state.canViewAnswers = data.canViewAnswers !== false;
}

function renderAll() {
  renderAuth();
  renderSessionBar();
  renderPapers();
  renderSources();
  renderQuestions();
  renderQuestion();
  renderParticipation();
  renderLeaderboard();
  renderAdmin();
  renderStats();
}

function renderAuth() {
  if (!state.me?.isAdmin && !state.me?.isUser) {
    el.authBox.innerHTML = `
      <div class="card-head"><p>登录后答题</p></div>
      <div class="field-stack">
        <input id="loginUser" placeholder="用户名" />
        <input id="loginPass" type="password" placeholder="密码" />
      </div>
      <div class="actions">
        <button id="loginBtn" type="button">登录</button>
        <button id="registerBtn" type="button" class="ghost">注册</button>
      </div>
      <p class="muted">不登录不能答题。</p>
    `;
    document.getElementById('loginBtn').onclick = login;
    document.getElementById('registerBtn').onclick = register;
    return;
  }
  el.authBox.innerHTML = `
    <div class="card-head"><p>当前账号</p></div>
    <div class="user-chip">${escapeHtml(state.me.username)}${state.me.isAdmin ? ' · 管理员' : ''}</div>
    <div class="actions">
      <button id="logoutBtn" type="button" class="ghost">退出</button>
    </div>
  `;
  document.getElementById('logoutBtn').onclick = logout;
}

function renderSessionBar() {
  el.sessionBar.textContent = state.me?.username ? `${state.me.username}${state.me.isAdmin ? ' / 管理员' : ''}` : '未登录';
}

function renderPapers() {
  el.paperCount.textContent = String(state.papers.length);
  if (!state.papers.length) {
    el.paperList.innerHTML = `<div class="empty">还没有上传试卷。</div>`;
    return;
  }
  el.paperList.innerHTML = state.papers.map((paper) => `
    <div class="paper-item-wrap">
      <button class="paper-item ${String(paper.id) === String(state.selectedPaperId) ? 'active' : ''}" data-paper-id="${paper.id}" type="button">
        <span class="paper-title">${escapeHtml(paper.title)}</span>
        <span class="paper-meta">${escapeHtml(paper.fileType || '')} · ${paper.questionCount} 题</span>
      </button>
      ${state.me?.isAdmin ? `<button class="icon-btn danger" data-delete-paper="${paper.id}" type="button" title="删除试卷">×</button>` : ''}
    </div>
  `).join('');
  el.paperList.querySelectorAll('[data-paper-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.selectedPaperId = btn.dataset.paperId;
      state.currentQuestion = null;
      await loadQuestions();
      await loadParticipation();
      await loadProgress();
      await loadLeaderboard();
      renderPapers();
      renderQuestions();
      renderQuestion();
      renderParticipation();
      renderLeaderboard();
      renderStats();
    });
  });
  el.paperList.querySelectorAll('[data-delete-paper]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定删除这份试卷吗？题目和作答记录也会一起删掉。')) return;
      const res = await fetch(`/api/admin/papers/${btn.dataset.deletePaper}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return alert(data.error || '删除失败');
      await loadPapers();
      state.currentQuestion = null;
      renderQuestion();
    });
  });
}

function renderSources() {
  if (!state.papers.length) {
    el.sourceList.innerHTML = `<div class="empty">暂无上传记录。</div>`;
    return;
  }
  el.sourceList.innerHTML = state.papers.map((paper) => `
    <div class="source-row">
      <div>
        <strong>${escapeHtml(paper.title)}</strong>
        <p>${escapeHtml(paper.filename)} · ${paper.questionCount} 题 · ${paper.createdAt}</p>
      </div>
      ${paper.url ? `<a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">打开</a>` : ''}
    </div>
  `).join('');
}

function renderQuestions() {
  if (!state.questions.length) {
    el.questionList.innerHTML = `<div class="empty">这份试卷还没有题目。</div>`;
    return;
  }
  el.questionList.innerHTML = state.questions.map((q, index) => `
    <button class="paper-item ${state.currentQuestion?.id === q.id ? 'active' : ''}" data-question-id="${q.id}" type="button">
      <span class="question-number">${index + 1}</span><span class="paper-title">${escapeHtml(q.prompt)}</span>
      <span class="paper-meta">${q.type === 'choice' ? '选择题' : q.type === 'judge' ? '判断题' : '填空/简答'} · 点击作答</span>
    </button>
  `).join('');
  el.questionList.querySelectorAll('[data-question-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentQuestion = state.questions.find((q) => String(q.id) === String(btn.dataset.questionId)) || null;
      renderQuestions();
      renderQuestion();
    });
  });
}

function renderQuestion() {
  if (!state.selectedPaperId) {
    el.paperTitle.textContent = '先选一份试卷';
    el.paperMeta.textContent = '每一份上传都会独立成卷，题目不会混在一起。';
    el.paperBadge.textContent = '未选择';
    el.questionPrompt.textContent = '请选择左侧某一份试卷。';
    el.answerArea.innerHTML = '';
    el.feedback.textContent = '';
    return;
  }
  const paper = state.papers.find((item) => String(item.id) === String(state.selectedPaperId));
  el.paperTitle.textContent = paper?.title || '试卷';
  el.paperMeta.textContent = paper ? `${paper.fileType || ''} · ${paper.questionCount} 题 · ${paper.createdAt}` : '';
  el.paperBadge.textContent = paper ? `${paper.questionCount} 题` : '试卷';
  if (!state.currentQuestion) {
    el.questionPrompt.textContent = '从左侧点击一题开始练习，或者点随机题目。';
    el.answerArea.innerHTML = '';
    return;
  }
  el.questionPrompt.textContent = state.currentQuestion.prompt;
  if (state.currentQuestion.type === 'choice' && Array.isArray(state.currentQuestion.choices) && state.currentQuestion.choices.length) {
    el.answerArea.innerHTML = `
      <div class="choice-list">
        ${state.currentQuestion.choices.map((choice, index) => `
          <label class="choice-item">
            <input type="radio" name="choiceAnswer" value="${escapeHtml(choice)}" />
            <span>${String.fromCharCode(65 + index)}. ${escapeHtml(choice)}</span>
          </label>
        `).join('')}
      </div>
    `;
  } else if (state.currentQuestion.type === 'judge') {
    el.answerArea.innerHTML = `
      <div class="choice-list">
        <label class="choice-item"><input type="radio" name="judgeAnswer" value="对" /> <span>对</span></label>
        <label class="choice-item"><input type="radio" name="judgeAnswer" value="错" /> <span>错</span></label>
      </div>
    `;
  } else {
    el.answerArea.innerHTML = `<textarea id="textAnswer" placeholder="输入答案"></textarea>`;
  }
}

function renderAdmin() {
  if (!state.me?.isAdmin) {
    el.adminPanel.innerHTML = '';
    return;
  }
  el.adminPanel.innerHTML = `
    <div class="card-head">
      <p>管理员面板</p>
      <span class="pill">已登录</span>
    </div>
    <div class="admin-tabs">
      <div class="field-stack admin-block">
        <div class="card-head"><p>文件导入</p></div>
        <input id="paperTitleInput" placeholder="试卷标题" />
        <input id="fileInput" type="file" accept=".pdf,.txt,.text,.md,.markdown,.docx" />
        <label class="checkline"><input id="useAiParse" type="checkbox" checked /> 使用 AI 解析</label>
        <div class="actions">
          <button id="uploadBtn" type="button">${state.uploading ? '正在上传...' : '上传试卷'}</button>
        </div>
        <div id="uploadStatus" class="muted">${state.uploading ? 'AI 解析进行中，请稍等。' : '上传后会自动解析并生成题目。'}</div>
      </div>

      <div class="field-stack admin-block">
        <div class="card-head"><p>人工建卷</p></div>
        <input id="manualPaperTitle" placeholder="新试卷名称" />
        <div class="actions">
          <button id="manualPaperBtn" type="button">新建空试卷</button>
        </div>
        <select id="manualQuestionType">
          <option value="fill">填空题</option>
          <option value="choice">选择题</option>
          <option value="judge">判断题</option>
          <option value="short">简答题</option>
        </select>
        <textarea id="manualPrompt" placeholder="题干"></textarea>
        <input id="manualAnswer" placeholder="标准答案；判断题填 对 或 错" />
        <input id="manualChoices" placeholder="选择题选项，用 | 分隔，例如 A选项|B选项|C选项|D选项" />
        <textarea id="manualExplanation" placeholder="解析，可选"></textarea>
        <div class="actions">
          <button id="manualQuestionBtn" type="button">添加到当前试卷</button>
          <button id="changePassBtn" type="button" class="ghost">修改密码</button>
          ${state.me.isOwner ? `<button id="testAiBtn" type="button" class="ghost">测试 AI</button>` : ''}
        </div>
      </div>
    </div>
    <div id="passForm" class="field-stack hidden"></div>
    ${state.me.isOwner ? `
      <div class="owner-box">
        <div class="card-head"><p>Owner 设置</p></div>
        <div class="field-stack">
          <input id="fixedAdminUser" value="${escapeHtml(state.settings?.fixedAdminUser || state.me.username)}" placeholder="固定管理员账号" />
          <select id="aiApiType">
            <option value="chat" ${(state.settings?.aiApiType || 'chat') === 'chat' ? 'selected' : ''}>Chat Completions</option>
            <option value="responses" ${state.settings?.aiApiType === 'responses' ? 'selected' : ''}>Responses</option>
          </select>
          <input id="aiApiKey" value="${escapeHtml(state.settings?.aiApiKey || '')}" placeholder="AI API Key" />
          <input id="aiApiBase" value="${escapeHtml(state.settings?.aiApiBase || '')}" placeholder="AI API Base" />
          <input id="aiModel" value="${escapeHtml(state.settings?.aiModel || '')}" placeholder="AI 模型名" />
        </div>
        <div class="actions" style="margin-top:10px;">
          <button id="saveSettingsBtn" type="button">保存配置</button>
        </div>
      </div>
    ` : ''}
  `;
  document.getElementById('uploadBtn').onclick = uploadPaper;
  document.getElementById('manualPaperBtn').onclick = createManualPaper;
  document.getElementById('manualQuestionBtn').onclick = createManualQuestion;
  document.getElementById('changePassBtn').onclick = togglePassForm;
  if (state.me.isOwner) {
    document.getElementById('saveSettingsBtn').onclick = saveSettings;
    document.getElementById('testAiBtn').onclick = testAi;
  }
}

function renderStats() {
  const selected = state.papers.find((item) => String(item.id) === String(state.selectedPaperId));
  el.questionCount.textContent = String(selected?.questionCount || 0);
  el.attemptCount.textContent = String(state.attempts);
  const total = Math.max(selected?.questionCount || 0, 1);
  el.progressBar.style.width = `${Math.min((state.attempts / total) * 100, 100)}%`;
  el.statusText.textContent = state.me ? (state.selectedPaperId ? '已登录，可以做题。' : '请先选一份试卷。') : '先登录再答题。';
}

async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '登录失败');
  await loadMe();
  await loadPapers();
  renderAll();
}

async function register() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '注册失败');
  alert('注册成功，请登录');
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  state.me = null;
  state.currentQuestion = null;
  state.questions = [];
  renderAll();
}


async function createManualPaper() {
  const title = document.getElementById('manualPaperTitle').value.trim();
  if (!title) return alert('请输入试卷名称');
  const res = await fetch('/api/admin/papers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '建卷失败');
  state.selectedPaperId = data.paperId;
  state.currentQuestion = null;
  await loadPapers();
  renderAll();
  alert('空试卷已创建，可以继续添加题目');
}

async function createManualQuestion() {
  if (!state.selectedPaperId) return alert('请先选择或新建一份试卷');
  const type = document.getElementById('manualQuestionType').value;
  const prompt = document.getElementById('manualPrompt').value.trim();
  const answer = document.getElementById('manualAnswer').value.trim();
  const explanation = document.getElementById('manualExplanation').value.trim();
  const choices = document.getElementById('manualChoices').value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!prompt || !answer) return alert('题干和答案不能为空');
  if (type === 'choice' && choices.length < 2) return alert('选择题至少需要 2 个选项，用 | 分隔');
  const res = await fetch(`/api/admin/papers/${state.selectedPaperId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, prompt, answer, choices, explanation }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '添加题目失败');
  await loadQuestions();
  await loadParticipation();
  await loadProgress();
  await loadLeaderboard();
  state.currentQuestion = state.questions.find((q) => q.id === data.questionId) || state.questions[0] || null;
  renderQuestions();
  renderQuestion();
  renderStats();
  document.getElementById('manualPrompt').value = '';
  document.getElementById('manualAnswer').value = '';
  document.getElementById('manualChoices').value = '';
  document.getElementById('manualExplanation').value = '';
}

async function uploadPaper() {
  const file = document.getElementById('fileInput').files?.[0];
  if (!file) return alert('先选文件');
  state.uploading = true;
  renderAdmin();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('paperTitle', document.getElementById('paperTitleInput').value.trim());
  fd.append('useAi', document.getElementById('useAiParse').checked ? 'true' : 'false');
  try {
    const res = await fetch('/api/admin/upload-paper', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) return alert(data.error || '上传失败');
    await loadPapers();
    state.selectedPaperId = data.paperId;
    await loadQuestions();
    await loadParticipation();
    await loadProgress();
    await loadLeaderboard();
    state.currentQuestion = state.questions[0] || null;
    renderAll();
    alert(`已导入 ${data.questionsCreated} 题`);
  } finally {
    state.uploading = false;
    renderAdmin();
  }
}

function togglePassForm() {
  const box = document.getElementById('passForm');
  if (!box.classList.contains('hidden')) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  box.innerHTML = `
    <input id="oldPass" type="password" placeholder="旧密码" />
    <input id="newPass" type="password" placeholder="新密码" />
    <button id="savePassBtn" type="button">保存</button>
  `;
  document.getElementById('savePassBtn').onclick = changePassword;
}

async function changePassword() {
  const oldPassword = document.getElementById('oldPass').value;
  const newPassword = document.getElementById('newPass').value;
  const res = await fetch('/api/admin/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '修改失败');
  alert('密码已更新');
}

async function saveSettings() {
  const fixedAdminUser = document.getElementById('fixedAdminUser').value.trim();
  const aiApiKey = document.getElementById('aiApiKey').value;
  const aiApiBase = document.getElementById('aiApiBase').value;
  const aiModel = document.getElementById('aiModel').value.trim();
  const aiApiType = document.getElementById('aiApiType').value;
  const res = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixedAdminUser, aiApiKey, aiApiBase, aiModel, aiApiType }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '保存失败');
  await loadMe();
  renderAdmin();
  alert('配置已保存');
}

async function testAi() {
  const res = await fetch('/api/admin/test-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '请只返回 JSON: {"ok":true,"message":"AI通了"}' }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || data.message || 'AI 测试失败');
  alert(`AI 可用，接口：${data.apiType || 'chat'}，模型：${data.model}`);
}


function currentQuestionIndex() {
  if (!state.currentQuestion) return -1;
  return state.questions.findIndex((q) => String(q.id) === String(state.currentQuestion.id));
}

function moveQuestion(delta) {
  if (!state.questions.length) return;
  const current = currentQuestionIndex();
  let nextIndex = current < 0 ? 0 : current + delta;
  if (nextIndex < 0) nextIndex = 0;
  if (nextIndex >= state.questions.length) nextIndex = state.questions.length - 1;
  state.currentQuestion = state.questions[nextIndex];
  el.feedback.textContent = '';
  renderQuestions();
  renderQuestion();
}

async function loadRandomQuestion() {
  if (!state.selectedPaperId) return;
  const res = await fetch(`/api/questions/random?paperId=${encodeURIComponent(state.selectedPaperId)}`);
  if (!res.ok) {
    alert('这份试卷里未做对的题都已经练完了。');
    renderQuestion();
    return;
  }
  const randomQuestion = await res.json();
  state.currentQuestion = state.questions.find((q) => String(q.id) === String(randomQuestion.id)) || randomQuestion;
  el.feedback.textContent = '';
  renderQuestions();
  renderQuestion();
}

async function submitAnswer() {
  if (!state.me) return alert('先登录');
  if (!state.currentQuestion) return;
  if (!state.participation?.selected) return alert('请先选择是否参与本试卷排行榜');
  const choice = document.querySelector('input[name="choiceAnswer"]:checked');
  const judge = document.querySelector('input[name="judgeAnswer"]:checked');
  const text = document.getElementById('textAnswer');
  const userAnswer = choice?.value || judge?.value || text?.value || '';
  const res = await fetch('/api/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionId: state.currentQuestion.id, userAnswer }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || '提交失败');
  await loadProgress();
  if (data.canViewAnswers || state.canViewAnswers) {
    const currentId = state.currentQuestion.id;
    await loadQuestions();
    state.currentQuestion = state.questions.find((q) => String(q.id) === String(currentId)) || state.currentQuestion;
    renderQuestions();
    renderQuestion();
  }
  await loadLeaderboard();
  renderLeaderboard();
  const label = data.status === 'correct' ? '正确' : data.status === 'partial' ? '部分正确' : '错误';
  el.feedback.className = `feedback ${data.status}`;
  el.feedback.textContent = `${label}，得分 ${Math.round((data.score || 0) * 100)}%。${data.feedback || ''}`;
  renderStats();
}

function canRevealAnswer() {
  return !state.participation?.participate || state.canViewAnswers;
}

function revealAnswer() {
  if (!state.currentQuestion) return;
  if (!canRevealAnswer()) {
    const total = state.questions.length || 0;
    alert(`参与排行榜时，答完所有题目后才能看答案。当前已答 ${state.answeredCount}/${total} 题。`);
    return;
  }
  if (!state.currentQuestion.answer) {
    alert('答案还没有加载，请刷新试卷后再试。');
    return;
  }
  el.feedback.className = 'feedback';
  el.feedback.textContent = `答案：${state.currentQuestion.answer}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
