const socket = io();

// ===== State =====
let myId = "", myName = "", myAvatar = "😀", currentRoom = "", isDrawer = false;
let drawing = false, tool = "brush", brushColor = "#000000", brushSz = 5;
let lastX = 0, lastY = 0, canvas, ctx;

const AVATARS = ["😀","😎","🤩","😂","🥳","😇","🤠","👻","🐱","🐶","🦊","🐸","🐵","🦁","🐼","🐨"];
const COLORS = ["#000000","#808080","#ffffff","#e74c3c","#e67e22","#f1c40f","#2ecc71","#1abc9c","#3498db","#9b59b6","#e84393","#fd79a8","#6c5ce7","#00cec9","#fdcb6e","#b2bec3","#d63031","#e17055","#00b894","#0984e3","#6c63ff","#a29bfe","#ff6b9d","#ffeaa7"];

// ===== DOM =====
const $ = id => document.getElementById(id);
const lobbyScreen = $("lobbyScreen"), gameScreen = $("gameScreen"), endScreen = $("endScreen");

// ===== Init Avatars =====
const avatarGrid = $("avatarGrid");
AVATARS.forEach((a, i) => {
  const div = document.createElement("div");
  div.className = "avatar-option" + (i === 0 ? " selected" : "");
  div.textContent = a;
  div.onclick = () => {
    document.querySelectorAll(".avatar-option").forEach(e => e.classList.remove("selected"));
    div.classList.add("selected");
    myAvatar = a;
  };
  avatarGrid.appendChild(div);
});

// ===== Init Colors =====
const colorPalette = $("colorPalette");
COLORS.forEach((c, i) => {
  const div = document.createElement("div");
  div.className = "color-swatch" + (i === 0 ? " active" : "");
  div.style.background = c;
  div.onclick = () => {
    document.querySelectorAll(".color-swatch").forEach(e => e.classList.remove("active"));
    div.classList.add("active");
    brushColor = c;
    tool = "brush";
    document.querySelectorAll("[data-tool]").forEach(b => b.classList.toggle("active", b.dataset.tool === "brush"));
  };
  colorPalette.appendChild(div);
});

// ===== Tools =====
document.querySelectorAll("[data-tool]").forEach(btn => {
  btn.onclick = () => {
    tool = btn.dataset.tool;
    document.querySelectorAll("[data-tool]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});
$("brushSize").oninput = e => brushSz = +e.target.value;

// ===== Toast =====
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}

// ===== Screen Switch =====
function showScreen(screen) {
  [lobbyScreen, gameScreen, endScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// ===== Lobby =====
$("btnCreate").onclick = () => {
  myName = $("playerName").value.trim();
  if (!myName) return showToast("Masukkan nama dulu!");
  socket.emit("createRoom", { name: myName, avatar: myAvatar });
};

$("btnJoin").onclick = () => {
  myName = $("playerName").value.trim();
  const code = $("roomCode").value.trim().toUpperCase();
  if (!myName) return showToast("Masukkan nama dulu!");
  if (!code) return showToast("Masukkan kode room!");
  socket.emit("joinRoom", { code, name: myName, avatar: myAvatar });
};

$("btnCopy").onclick = () => {
  navigator.clipboard?.writeText(currentRoom);
  $("btnCopy").textContent = "✅";
  setTimeout(() => $("btnCopy").textContent = "📋", 1500);
};

$("btnStart").onclick = () => socket.emit("startGame");
$("btnPlayAgain").onclick = () => {
  showScreen(lobbyScreen);
  $("joinCard").classList.remove("hidden");
  $("waitingCard").classList.add("hidden");
};

// ===== Socket Events — Lobby =====
socket.on("connect", () => { myId = socket.id; });

socket.on("roomCreated", ({ code, players }) => {
  currentRoom = code;
  $("displayCode").textContent = code;
  $("joinCard").classList.add("hidden");
  $("waitingCard").classList.remove("hidden");
  $("btnStart").classList.remove("hidden");
  updateWaitingPlayers(players);
});

socket.on("roomJoined", ({ code, players }) => {
  currentRoom = code;
  $("displayCode").textContent = code;
  $("joinCard").classList.add("hidden");
  $("waitingCard").classList.remove("hidden");
  updateWaitingPlayers(players);
});

socket.on("playerJoined", ({ players }) => {
  updateWaitingPlayers(players);
  $("btnStart")?.classList.toggle("hidden", players.length < 2);
});

socket.on("playerLeft", ({ players }) => updateWaitingPlayers(players));

function updateWaitingPlayers(players) {
  $("waitingPlayers").innerHTML = players.map(p =>
    `<div class="waiting-chip"><span>${p.avatar}</span><span>${p.name}</span></div>`
  ).join("");
}

socket.on("error", ({ message }) => showToast(message));

// ===== Socket Events — Game =====
socket.on("gameStarted", () => {
  showScreen(gameScreen);
  initCanvas();
  $("chatMessages").innerHTML = "";
});

socket.on("gameStopped", ({ message }) => {
  showScreen(lobbyScreen);
  $("joinCard").classList.add("hidden");
  $("waitingCard").classList.remove("hidden");
  showToast(message);
});

socket.on("newTurn", ({ drawer, players, round, maxRounds }) => {
  isDrawer = drawer.id === myId;
  $("roundInfo").textContent = `Round ${round}/${maxRounds}`;
  $("drawerName").textContent = `🎨 ${drawer.name} menggambar`;
  $("wordHint").textContent = "...";
  $("turnEndOverlay").classList.add("hidden");
  $("toolsBar").style.display = isDrawer ? "flex" : "none";
  updatePlayers(players);
  clearCanvasLocal();
  if (!isDrawer) {
    $("chatInput").placeholder = "Ketik tebakan...";
    $("chatInput").disabled = false;
  } else {
    $("chatInput").placeholder = "Kamu sedang menggambar...";
    $("chatInput").disabled = true;
  }
});

socket.on("chooseWord", ({ words }) => {
  const overlay = $("wordChoiceOverlay");
  const container = $("wordChoices");
  container.innerHTML = words.map(w =>
    `<button class="word-choice-btn" onclick="selectWord('${w}')">${w}</button>`
  ).join("");
  overlay.classList.remove("hidden");
});

window.selectWord = (word) => {
  socket.emit("wordSelected", { word });
  $("wordChoiceOverlay").classList.add("hidden");
};

socket.on("drawingStarted", ({ hint, timeLeft, drawerId }) => {
  $("wordHint").textContent = hint;
  $("wordChoiceOverlay").classList.add("hidden");
  isDrawer = drawerId === myId;
  updateTimer(timeLeft, 80);
  addChatMsg("system", "🎨 Mulai menggambar! Tebak kata-nya!");
});

socket.on("timerUpdate", ({ timeLeft }) => updateTimer(timeLeft, 80));
socket.on("hintUpdate", ({ hint }) => { $("wordHint").textContent = hint; });

function updateTimer(timeLeft, total) {
  $("timerText").textContent = timeLeft;
  const pct = timeLeft / total;
  const offset = 113 * (1 - pct);
  const fg = $("timerFg");
  fg.style.strokeDashoffset = offset;
  fg.classList.remove("warning", "danger");
  if (pct < 0.25) fg.classList.add("danger");
  else if (pct < 0.5) fg.classList.add("warning");
}

socket.on("correctGuess", ({ playerName, points, players }) => {
  addChatMsg("correct", `✅ ${playerName} menebak dengan benar! (+${points} poin)`);
  updatePlayers(players);
});

socket.on("turnEnd", ({ word, players, allGuessed }) => {
  $("turnEndTitle").textContent = allGuessed ? "Semua berhasil menebak! 🎉" : "Waktu habis! ⏰";
  $("turnEndWord").textContent = word;
  $("turnEndOverlay").classList.remove("hidden");
  updatePlayers(players);
});

socket.on("gameEnd", ({ players }) => {
  showScreen(endScreen);
  renderPodium(players);
});

function updatePlayers(players) {
  const sorted = players.sort((a, b) => b.score - a.score);

  // Desktop sidebar
  const sidebar = $("playersSidebar");
  sidebar.innerHTML = sorted.map(p => `
    <div class="player-item ${p.isDrawing ? 'drawing' : ''}">
      <span class="p-avatar">${p.avatar}</span>
      <div class="p-info">
        <span class="p-name">${p.name}</span>
        <span class="p-score">${p.score} pts</span>
        ${p.isDrawing ? '<span class="p-drawing">🖌️ Menggambar</span>' : ''}
      </div>
    </div>
  `).join("");

  // Mobile players bar
  const mobileBar = $("mobilePlayersBar");
  if (mobileBar) {
    mobileBar.innerHTML = sorted.map(p => `
      <div class="mp-item ${p.isDrawing ? 'drawing' : ''}">
        ${p.isDrawing ? '<span class="mp-pen">🖌️</span>' : ''}
        <span class="mp-avatar">${p.avatar}</span>
        <span class="mp-name">${p.name}</span>
        <span class="mp-score">${p.score} pts</span>
      </div>
    `).join("");
  }
}

function renderPodium(players) {
  const medals = ["🥇", "🥈", "🥉"];
  const top3 = players.slice(0, 3);
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  $("podium").innerHTML = order.map((p, i) => {
    const realIdx = top3.indexOf(p);
    return `<div class="podium-item ${realIdx === 0 ? 'first' : ''}">
      <span class="podium-rank">${medals[realIdx] || ""}</span>
      <span class="podium-avatar">${p.avatar}</span>
      <span class="podium-name">${p.name}</span>
      <span class="podium-score">${p.score} pts</span>
    </div>`;
  }).join("");

  $("endScores").innerHTML = players.slice(3).map((p, i) => `
    <div class="end-score-row">
      <span class="rank">#${i + 4}</span>
      <span>${p.avatar}</span>
      <span class="name">${p.name}</span>
      <span class="score">${p.score} pts</span>
    </div>
  `).join("");
}

// ===== Chat =====
$("chatInput").onkeydown = e => {
  if (e.key === "Enter") sendChat();
};
$("btnSend").onclick = sendChat;

function sendChat() {
  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;
  if (isDrawer) {
    socket.emit("chatMessage", { text });
  } else {
    socket.emit("guess", { text });
  }
  input.value = "";
}

socket.on("chatMessage", ({ type, name, text }) => {
  addChatMsg(type, type === "system" ? text : `${name}: ${text}`, type === "close" ? "🔥 Hampir benar!" : "");
});

function addChatMsg(type, text, extra = "") {
  const div = document.createElement("div");
  div.className = `chat-msg ${type}`;
  div.textContent = text;
  if (extra) { const s = document.createElement("div"); s.textContent = extra; s.style.fontSize = "0.7rem"; div.appendChild(s); }
  $("chatMessages").appendChild(div);
  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
}

// ===== Canvas =====
const CANVAS_W = 800, CANVAS_H = 500;

function initCanvas() {
  canvas = $("gameCanvas");
  ctx = canvas.getContext("2d");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  clearCanvasLocal();

  // Pointer events
  canvas.onpointerdown = e => {
    if (!isDrawer) return;
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    if (tool === "fill") {
      floodFill(Math.round(p.x), Math.round(p.y), brushColor);
      socket.emit("draw", { type: "fill", x: p.x, y: p.y, color: brushColor });
      drawing = false;
    }
  };
  canvas.onpointermove = e => {
    if (!drawing || !isDrawer) return;
    e.preventDefault();
    const p = getPos(e);
    const data = { type: "line", x1: lastX, y1: lastY, x2: p.x, y2: p.y, color: tool === "eraser" ? "#ffffff" : brushColor, size: tool === "eraser" ? brushSz * 3 : brushSz };
    drawLine(data);
    socket.emit("draw", data);
    lastX = p.x; lastY = p.y;
  };
  canvas.onpointerup = () => drawing = false;
  canvas.onpointerleave = () => drawing = false;

  // Prevent scroll while drawing on mobile
  canvas.style.touchAction = "none";
}

function getPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) / r.width * CANVAS_W,
    y: (e.clientY - r.top) / r.height * CANVAS_H
  };
}

function drawLine({ x1, y1, x2, y2, color, size }) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function floodFill(sx, sy, fillColor) {
  const w = canvas.width, h = canvas.height;
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const target = getPixel(data, sx, sy, w);
  const fill = hexToRgb(fillColor);
  if (target[0]===fill[0]&&target[1]===fill[1]&&target[2]===fill[2]) return;
  const stack = [[sx, sy]];
  const visited = new Set();
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x<0||x>=w||y<0||y>=h) continue;
    const key = y*w+x;
    if (visited.has(key)) continue;
    visited.add(key);
    const px = getPixel(data, x, y, w);
    if (Math.abs(px[0]-target[0])>30||Math.abs(px[1]-target[1])>30||Math.abs(px[2]-target[2])>30) continue;
    const i = key*4;
    data[i]=fill[0]; data[i+1]=fill[1]; data[i+2]=fill[2]; data[i+3]=255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  ctx.putImageData(imgData, 0, 0);
}

function getPixel(data, x, y, w) { const i = (y*w+x)*4; return [data[i],data[i+1],data[i+2]]; }
function hexToRgb(hex) { const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); return [r,g,b]; }

function clearCanvasLocal() {
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

$("btnClear").onclick = () => {
  if (!isDrawer) return;
  clearCanvasLocal();
  socket.emit("clearCanvas");
};

// ===== Remote Draw =====
socket.on("draw", (data) => {
  if (data.type === "line") drawLine(data);
  else if (data.type === "fill") floodFill(Math.round(data.x), Math.round(data.y), data.color);
});
socket.on("clearCanvas", clearCanvasLocal);

// ===== Chat Toggle (mobile) =====
$("chatToggle")?.addEventListener("click", () => {
  const chat = $("chatArea");
  chat.classList.toggle("collapsed");
  $("chatToggle").textContent = chat.classList.contains("collapsed") ? "💬 Chat & Tebakan ▲" : "💬 Chat & Tebakan ▼";
});

// ===== Enter key on room code =====
$("roomCode").onkeydown = e => { if (e.key === "Enter") $("btnJoin").click(); };
$("playerName").onkeydown = e => { if (e.key === "Enter") $("btnCreate").click(); };

