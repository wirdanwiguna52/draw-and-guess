const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

// ===== Word Lists =====
const WORDS = {
  mudah: ["kucing","anjing","rumah","matahari","bulan","bintang","pohon","bunga","ikan","burung","mobil","sepeda","bola","topi","payung","gelas","kursi","meja","pintu","jendela","awan","hujan","api","gunung","laut","sungai","pulau","pantai","sawah","kebun"],
  sedang: ["gitar","piano","helikopter","dinosaurus","astronot","robot","mahkota","kastil","pelangi","pemadam kebakaran","es krim","pizza","hamburger","kamera","teleskop","mikroskop","akuarium","balon udara","mercusuar","kapal selam"],
  sulit: ["gravitasi","demokrasi","fotosintesis","konstelasi","metamorfosis","imajinasi","revolusi","evolusi","harmoni","simfoni"]
};

function getRandomWords() {
  const all = [...WORDS.mudah, ...WORDS.sedang, ...WORDS.sulit];
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ===== Game State =====
const rooms = new Map();

function createRoom(code) {
  return {
    code,
    players: [],
    state: "waiting", // waiting, choosing, drawing, roundEnd, gameEnd
    currentDrawer: null,
    currentWord: "",
    wordChoices: [],
    round: 0,
    maxRounds: 3,
    turnIndex: 0,
    timer: null,
    timeLeft: 0,
    drawTime: 80,
    guessedPlayers: [],
    drawData: [],
    maxPlayers: 10,
    hints: [],
    hintTimer: null,
  };
}

function getPublicPlayers(room) {
  return room.players.map(p => ({
    id: p.id, name: p.name, score: p.score, avatar: p.avatar, isDrawing: room.currentDrawer === p.id
  }));
}

function startNewTurn(room) {
  clearInterval(room.timer);
  clearInterval(room.hintTimer);
  room.guessedPlayers = [];
  room.drawData = [];
  room.hints = [];

  if (room.turnIndex >= room.players.length) {
    room.turnIndex = 0;
    room.round++;
  }

  if (room.round >= room.maxRounds) {
    room.state = "gameEnd";
    io.to(room.code).emit("gameEnd", {
      players: getPublicPlayers(room).sort((a, b) => b.score - a.score)
    });
    return;
  }

  const drawer = room.players[room.turnIndex];
  if (!drawer) return;
  
  room.currentDrawer = drawer.id;
  room.state = "choosing";
  room.wordChoices = getRandomWords();
  room.turnIndex++;

  io.to(room.code).emit("newTurn", {
    drawer: { id: drawer.id, name: drawer.name },
    players: getPublicPlayers(room),
    round: room.round + 1,
    maxRounds: room.maxRounds
  });

  io.to(drawer.id).emit("chooseWord", { words: room.wordChoices });

  // Auto-pick after 15s
  setTimeout(() => {
    if (room.state === "choosing") {
      selectWord(room, room.wordChoices[0]);
    }
  }, 15000);
}

function selectWord(room, word) {
  room.currentWord = word;
  room.state = "drawing";
  room.timeLeft = room.drawTime;

  const hint = word.split("").map(c => c === " " ? " " : "_");
  room.hints = [...hint];

  io.to(room.code).emit("drawingStarted", {
    hint: room.hints.join(" "),
    wordLength: word.length,
    timeLeft: room.timeLeft,
    drawerId: room.currentDrawer
  });

  // Timer
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.code).emit("timerUpdate", { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      endTurn(room, false);
    }
  }, 1000);

  // Hints
  const letterIndices = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " ") letterIndices.push(i);
  }
  const shuffledIndices = letterIndices.sort(() => Math.random() - 0.5);
  let hintCount = 0;
  const maxHints = Math.min(Math.floor(word.length / 3), 3);

  room.hintTimer = setInterval(() => {
    if (hintCount >= maxHints || room.state !== "drawing") {
      clearInterval(room.hintTimer);
      return;
    }
    const idx = shuffledIndices[hintCount];
    room.hints[idx] = word[idx];
    hintCount++;
    io.to(room.code).emit("hintUpdate", { hint: room.hints.join(" ") });
  }, room.drawTime * 1000 / (maxHints + 1));
}

function endTurn(room, allGuessed) {
  clearInterval(room.timer);
  clearInterval(room.hintTimer);
  room.state = "roundEnd";

  io.to(room.code).emit("turnEnd", {
    word: room.currentWord,
    players: getPublicPlayers(room),
    allGuessed
  });

  setTimeout(() => {
    if (room.players.length >= 2) {
      startNewTurn(room);
    }
  }, 4000);
}

// ===== Socket.io =====
io.on("connection", (socket) => {
  let currentRoom = null;
  let playerName = "";

  socket.on("createRoom", ({ name, avatar }) => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = createRoom(code);
    rooms.set(code, room);
    playerName = name;
    currentRoom = code;

    room.players.push({ id: socket.id, name, avatar, score: 0 });
    socket.join(code);
    socket.emit("roomCreated", { code, players: getPublicPlayers(room) });
  });

  socket.on("joinRoom", ({ code, name, avatar }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit("error", { message: "Room tidak ditemukan!" });
    if (room.players.length >= room.maxPlayers) return socket.emit("error", { message: "Room sudah penuh!" });
    if (room.state !== "waiting") return socket.emit("error", { message: "Game sudah dimulai!" });

    playerName = name;
    currentRoom = code;
    room.players.push({ id: socket.id, name, avatar, score: 0 });
    socket.join(code);

    socket.emit("roomJoined", { code, players: getPublicPlayers(room) });
    socket.to(code).emit("playerJoined", { player: { id: socket.id, name, avatar, score: 0 }, players: getPublicPlayers(room) });
    io.to(code).emit("chatMessage", { type: "system", text: `${name} bergabung! 🎉` });
  });

  socket.on("startGame", () => {
    const room = rooms.get(currentRoom);
    if (!room || room.players.length < 2) return socket.emit("error", { message: "Minimal 2 pemain!" });
    room.round = 0;
    room.turnIndex = 0;
    room.players.forEach(p => p.score = 0);
    io.to(currentRoom).emit("gameStarted", {});
    startNewTurn(room);
  });

  socket.on("wordSelected", ({ word }) => {
    const room = rooms.get(currentRoom);
    if (!room || room.currentDrawer !== socket.id) return;
    selectWord(room, word);
  });

  socket.on("draw", (data) => {
    const room = rooms.get(currentRoom);
    if (!room || room.currentDrawer !== socket.id) return;
    room.drawData.push(data);
    socket.to(currentRoom).emit("draw", data);
  });

  socket.on("clearCanvas", () => {
    const room = rooms.get(currentRoom);
    if (!room || room.currentDrawer !== socket.id) return;
    room.drawData = [];
    socket.to(currentRoom).emit("clearCanvas");
  });

  socket.on("guess", ({ text }) => {
    const room = rooms.get(currentRoom);
    if (!room || room.state !== "drawing" || room.currentDrawer === socket.id) return;
    if (room.guessedPlayers.includes(socket.id)) return;

    const guess = text.trim().toLowerCase();
    const answer = room.currentWord.toLowerCase();

    if (guess === answer) {
      room.guessedPlayers.push(socket.id);
      const player = room.players.find(p => p.id === socket.id);
      const timeBonus = Math.floor(room.timeLeft / room.drawTime * 300);
      const points = 100 + timeBonus;
      if (player) player.score += points;

      const drawer = room.players.find(p => p.id === room.currentDrawer);
      if (drawer) drawer.score += 50;

      io.to(currentRoom).emit("correctGuess", {
        playerId: socket.id,
        playerName: player?.name,
        points,
        players: getPublicPlayers(room)
      });

      if (room.guessedPlayers.length >= room.players.length - 1) {
        endTurn(room, true);
      }
    } else {
      // Check close guess
      let close = false;
      if (answer.length > 3) {
        let match = 0;
        for (let i = 0; i < Math.min(guess.length, answer.length); i++) {
          if (guess[i] === answer[i]) match++;
        }
        close = match >= answer.length * 0.6 && match < answer.length;
      }
      io.to(currentRoom).emit("chatMessage", {
        type: close ? "close" : "guess",
        name: playerName,
        text: text,
        playerId: socket.id
      });
    }
  });

  socket.on("chatMessage", ({ text }) => {
    io.to(currentRoom).emit("chatMessage", { type: "chat", name: playerName, text, playerId: socket.id });
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);
    io.to(currentRoom).emit("playerLeft", { name: playerName, players: getPublicPlayers(room) });
    io.to(currentRoom).emit("chatMessage", { type: "system", text: `${playerName} keluar 😢` });

    if (room.currentDrawer === socket.id && room.state === "drawing") {
      endTurn(room, false);
    }

    if (room.players.length === 0) {
      clearInterval(room.timer);
      clearInterval(room.hintTimer);
      rooms.delete(currentRoom);
    } else if (room.players.length < 2 && room.state !== "waiting") {
      clearInterval(room.timer);
      clearInterval(room.hintTimer);
      room.state = "waiting";
      io.to(currentRoom).emit("gameStopped", { message: "Pemain kurang! Menunggu pemain lain..." });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎨 Draw & Guess server running at http://localhost:${PORT}`);
});
