/* ============================
   BOMB PARTY — Frontend Logic
   ============================ */

const socket = io();

// ===== STATE =====
const state = {
  playerName: '',
  avatar: '😎',
  roomCode: '',
  playerId: null,
  isHost: false,
  gameActive: false,
  bombTimer: null,
  bombDuration: 0,
  bombStartTime: 0,
};

// ===== DOM REFS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSVGGradient();
  setupEventListeners();
});

// ===== PARTICLES BACKGROUND =====
function initParticles() {
  const canvas = $('#particles-bg');
  const ctx = canvas.getContext('2d');
  let particles = [];
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.3 + 0.1,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}

// ===== SVG GRADIENT =====
function initSVGGradient() {
  const svg = document.querySelector('.bomb-timer-ring');
  if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad.id = 'timerGradient';
  const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#22d3ee');
  const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#a855f7');
  grad.appendChild(s1); grad.appendChild(s2);
  defs.appendChild(grad); svg.prepend(defs);
}

// ===== SCREEN MANAGEMENT =====
function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#screen-${name}`).classList.add('active');
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Avatar selection
  $$('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.avatar-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.avatar = btn.dataset.avatar;
    });
  });

  // Create room
  $('#btn-create').addEventListener('click', () => {
    const name = $('#player-name').value.trim();
    if (!name) return showToast('Masukkan nama dulu!', 'error');
    state.playerName = name;
    socket.emit('create-room', { playerName: name, avatar: state.avatar });
  });

  // Join room
  $('#btn-join').addEventListener('click', () => {
    const name = $('#player-name').value.trim();
    const code = $('#room-code-input').value.trim().toUpperCase();
    if (!name) return showToast('Masukkan nama dulu!', 'error');
    if (!code || code.length < 4) return showToast('Masukkan kode room!', 'error');
    state.playerName = name;
    socket.emit('join-room', { roomCode: code, playerName: name, avatar: state.avatar });
  });

  // Room code input — auto uppercase & enter to join
  $('#room-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-join').click();
  });
  $('#player-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#btn-create').click();
  });

  // Copy code
  $('#btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(state.roomCode).then(() => {
      showToast('Kode disalin! 📋', 'success');
    });
  });

  // Start game
  $('#btn-start').addEventListener('click', () => {
    socket.emit('start-game', { roomCode: state.roomCode });
  });

  // Back from lobby
  $('#btn-back-lobby').addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    showScreen('home');
  });

  // Word input
  $('#word-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitWord();
  });
  $('#btn-submit').addEventListener('click', submitWord);

  // Reactions
  $$('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.dataset.emoji;
      socket.emit('send-reaction', { roomCode: state.roomCode, emoji });
      spawnFloatingEmoji(emoji);
    });
  });

  // Results
  $('#btn-play-again').addEventListener('click', () => {
    socket.emit('play-again', { roomCode: state.roomCode });
  });
  $('#btn-back-home').addEventListener('click', () => {
    socket.disconnect();
    socket.connect();
    showScreen('home');
  });
}

function submitWord() {
  const input = $('#word-input');
  const word = input.value.trim();
  if (!word) return;
  socket.emit('submit-word', { roomCode: state.roomCode, word });
  input.value = '';
  input.focus();
}

// ===== SOCKET EVENTS =====
socket.on('room-created', (data) => {
  state.roomCode = data.roomCode;
  state.playerId = data.player.id;
  state.isHost = true;
  showScreen('lobby');
  updateLobby(data.players);
  $('#lobby-room-code').textContent = data.roomCode;
  $('#btn-start').style.display = 'block';
  $('#wait-text').style.display = 'none';
  showToast('Room dibuat! Bagikan kode ke teman 🎮', 'success');
});

socket.on('room-joined', (data) => {
  state.roomCode = data.roomCode;
  state.playerId = data.player.id;
  state.isHost = false;
  showScreen('lobby');
  updateLobby(data.players);
  $('#lobby-room-code').textContent = data.roomCode;
  $('#btn-start').style.display = 'none';
  $('#wait-text').style.display = 'block';
});

socket.on('player-joined', (data) => {
  updateLobby(data.players);
  showToast(`${data.player.name} bergabung! 🎉`, 'info');
});

socket.on('player-left', (data) => {
  updateLobby(data.players);
  if (data.newHost === state.playerId && !state.isHost) {
    state.isHost = true;
    $('#btn-start').style.display = 'block';
    $('#wait-text').style.display = 'none';
    showToast('Kamu sekarang host! 👑', 'info');
  }
  if (state.gameActive) {
    updateGamePlayers(data.players);
  }
});

socket.on('game-started', (gameState) => {
  state.gameActive = true;
  showScreen('game');
  updateGame(gameState);
  showToast('Game dimulai! 🔥', 'success');
});

socket.on('bomb-tick', ({ duration }) => {
  state.bombDuration = duration;
  state.bombStartTime = Date.now();
  startBombAnimation(duration);
});

socket.on('word-accepted', ({ word, playerId, gameState }) => {
  updateGame(gameState);
  if (playerId === state.playerId) {
    showFeedback(`✅ "${word}" diterima!`, 'success');
  } else {
    const player = gameState.players.find(p => p.id === playerId);
    showFeedback(`${player?.avatar} ${player?.name}: "${word}"`, 'success');
  }
});

socket.on('word-rejected', ({ reason }) => {
  showFeedback(`❌ ${reason}`, 'error');
  shakeInput();
});

socket.on('bomb-exploded', ({ playerId, lives, playerName, gameState }) => {
  showExplosion(playerName, lives);
  updateGame(gameState);
});

socket.on('new-round', (gameState) => {
  hideExplosion();
  updateGame(gameState);
});

socket.on('turn-update', (gameState) => {
  updateGame(gameState);
});

socket.on('reaction', ({ playerName, emoji }) => {
  spawnFloatingEmoji(emoji, playerName);
});

socket.on('error-msg', ({ message }) => {
  showToast(message, 'error');
});

// ===== LOBBY UI =====
function updateLobby(players) {
  const grid = $('#lobby-players');
  grid.innerHTML = players.map(p => `
    <div class="player-card ${p.isHost ? 'is-host' : ''}">
      <div class="player-card-avatar">${p.avatar}</div>
      <div class="player-card-info">
        <div class="player-card-name">${escapeHtml(p.name)}</div>
        ${p.isHost ? '<div class="player-card-badge">👑 Host</div>' : ''}
      </div>
    </div>
  `).join('');
  $('#player-count').textContent = `${players.length}/8 Pemain`;
}

// ===== GAME UI =====
function updateGame(gameState) {
  // Update round
  $('#game-round').textContent = gameState.round;
  $('#words-used-count').textContent = gameState.usedWordsCount;

  // Update letters
  $('#current-letters').textContent = gameState.currentLetters;

  // Update players
  updateGamePlayers(gameState.players, gameState.currentPlayerId);

  // Update turn indicator
  const isMyTurn = gameState.currentPlayerId === state.playerId;
  const ti = $('#turn-indicator');
  if (isMyTurn) {
    ti.textContent = '🎯 Giliran kamu!';
    ti.className = 'turn-indicator';
    $('#word-input').focus();
  } else {
    const current = gameState.players.find(p => p.id === gameState.currentPlayerId);
    ti.textContent = `⏳ Giliran ${current?.name || '...'}`;
    ti.className = 'turn-indicator not-my-turn';
  }
}

function updateGamePlayers(players, currentPlayerId) {
  const area = $('#player-circle-area');
  area.innerHTML = players.map(p => {
    const isActive = p.id === currentPlayerId;
    const hearts = '❤️'.repeat(Math.max(0, p.lives)) + '🖤'.repeat(Math.max(0, 3 - p.lives));
    return `
      <div class="circle-player ${isActive ? 'active-turn' : ''} ${!p.isAlive ? 'eliminated' : ''}"
           data-id="${p.id}">
        <div class="circle-player-avatar">${p.avatar}</div>
        <div class="circle-player-name">${escapeHtml(p.name)}</div>
        <div class="circle-player-lives">${hearts}</div>
      </div>
    `;
  }).join('');
}

// ===== BOMB ANIMATION =====
function startBombAnimation(duration) {
  const ring = $('#ring-progress');
  const bombWrapper = $('#bomb-wrapper');
  const circumference = 2 * Math.PI * 54;
  ring.style.strokeDasharray = circumference;

  cancelAnimationFrame(state.bombTimer);

  const startTime = Date.now();

  function tick() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Update ring
    ring.style.strokeDashoffset = circumference * (1 - progress);

    // Change color as time runs out
    if (progress > 0.7) {
      ring.style.stroke = '#ef4444';
      bombWrapper.classList.add('danger');
    } else if (progress > 0.5) {
      ring.style.stroke = '#f97316';
      bombWrapper.classList.remove('danger');
    } else {
      ring.style.stroke = '';
      bombWrapper.classList.remove('danger');
    }

    if (progress < 1) {
      state.bombTimer = requestAnimationFrame(tick);
    }
  }
  tick();
}

// ===== EXPLOSION =====
function showExplosion(playerName, livesLeft) {
  const overlay = $('#explosion-overlay');
  const victim = $('#explosion-victim');
  victim.textContent = livesLeft > 0
    ? `${playerName} kehilangan nyawa! (${livesLeft} tersisa)`
    : `${playerName} tereliminasi! 💀`;
  overlay.classList.add('show');
  // Screen shake
  document.body.style.animation = 'none';
  void document.body.offsetWidth;
  document.body.style.animation = 'screenShake 0.5s ease';
}

function hideExplosion() {
  $('#explosion-overlay').classList.remove('show');
}

// ===== RESULTS =====
socket.on('game-over', ({ winner }) => {
  state.gameActive = false;
  cancelAnimationFrame(state.bombTimer);

  // Small delay so explosion finishes
  setTimeout(() => {
    showScreen('results');
    $('#winner-avatar').textContent = winner.avatar;
    $('#winner-name').textContent = winner.name;

    if (state.isHost) {
      $('#btn-play-again').style.display = 'flex';
    } else {
      $('#btn-play-again').style.display = 'none';
    }

    // Build scoreboard from players in circle area
    const playerEls = $$('.circle-player');
    const scoreboard = $('#scoreboard');
    // Just show winner info
    scoreboard.innerHTML = `
      <div class="score-row">
        <div class="score-rank rank-1">🏆</div>
        <div class="score-avatar">${winner.avatar}</div>
        <div class="score-name">${escapeHtml(winner.name)}</div>
        <div class="score-points">${winner.score} pts</div>
      </div>
    `;

    spawnConfetti();
  }, 1500);
});

// ===== FEEDBACK =====
function showFeedback(text, type) {
  const fb = $('#input-feedback');
  fb.textContent = text;
  fb.className = `input-feedback ${type}`;
  setTimeout(() => { fb.textContent = ''; fb.className = 'input-feedback'; }, 2500);
}

function shakeInput() {
  const wrapper = $('.word-input-wrapper');
  wrapper.style.animation = 'none';
  void wrapper.offsetWidth;
  wrapper.style.animation = 'shakeX 0.4s ease';
}

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== FLOATING EMOJI =====
function spawnFloatingEmoji(emoji, name) {
  const container = $('#floating-reactions');
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = `${Math.random() * 60 + 20}%`;
  el.style.bottom = '20%';
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ===== CONFETTI =====
function spawnConfetti() {
  const container = $('#confetti-container');
  container.innerHTML = '';
  const colors = ['#a855f7', '#22d3ee', '#ec4899', '#facc15', '#22c55e', '#f97316'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 2}s`;
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = `${6 + Math.random() * 8}px`;
    piece.style.height = `${6 + Math.random() * 8}px`;
    container.appendChild(piece);
  }
}

// ===== UTILITIES =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Add screen shake keyframes dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes screenShake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes shakeX {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`;
document.head.appendChild(shakeStyle);
