const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { RoomManager } = require('./game/Room');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`⚡ Connected: ${socket.id}`);

  socket.on('create-room', ({ playerName, avatar }) => {
    const room = roomManager.createRoom();
    const player = room.addPlayer(socket.id, playerName, avatar);
    socket.join(room.code);
    socket.emit('room-created', {
      roomCode: room.code, player, players: room.getPlayersInfo()
    });
  });

  socket.on('join-room', ({ roomCode, playerName, avatar }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return socket.emit('error-msg', { message: 'Room tidak ditemukan! 😢' });
    if (room.gameStarted) return socket.emit('error-msg', { message: 'Game sudah dimulai!' });
    if (room.players.length >= 8) return socket.emit('error-msg', { message: 'Room penuh! (max 8)' });

    const player = room.addPlayer(socket.id, playerName, avatar);
    socket.join(room.code);
    socket.emit('room-joined', {
      roomCode: room.code, player, players: room.getPlayersInfo()
    });
    socket.to(room.code).emit('player-joined', {
      player, players: room.getPlayersInfo()
    });
  });

  socket.on('start-game', ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    if (room.players.length < 2) return socket.emit('error-msg', { message: 'Minimal 2 pemain!' });
    if (room.hostId !== socket.id) return socket.emit('error-msg', { message: 'Hanya host yang bisa mulai!' });

    room.startGame();
    io.to(room.code).emit('game-started', room.getGameState());
    startBombTimer(room);
  });

  socket.on('submit-word', ({ roomCode, word }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room || !room.gameStarted) return;

    const result = room.submitWord(socket.id, word);
    if (result.valid) {
      io.to(room.code).emit('word-accepted', {
        word: result.word, playerId: socket.id,
        gameState: room.getGameState()
      });
      clearTimeout(room.bombTimeout);
      startBombTimer(room);
    } else {
      socket.emit('word-rejected', { reason: result.reason });
    }
  });

  socket.on('send-reaction', ({ roomCode, emoji }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      socket.to(room.code).emit('reaction', { playerName: player.name, emoji });
    }
  });

  socket.on('play-again', ({ roomCode }) => {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.startGame();
    io.to(room.code).emit('game-started', room.getGameState());
    startBombTimer(room);
  });

  socket.on('disconnect', () => {
    const room = roomManager.findRoomByPlayer(socket.id);
    if (!room) return;

    const wasCurrentPlayer = room.isCurrentPlayer(socket.id);
    room.removePlayer(socket.id);

    if (room.players.length === 0) {
      clearTimeout(room.bombTimeout);
      roomManager.removeRoom(room.code);
      return;
    }

    io.to(room.code).emit('player-left', {
      playerId: socket.id,
      players: room.getPlayersInfo(),
      newHost: room.hostId
    });

    if (room.gameStarted) {
      const winner = room.checkWinner();
      if (winner) {
        clearTimeout(room.bombTimeout);
        io.to(room.code).emit('game-over', { winner });
        room.resetGame();
      } else if (wasCurrentPlayer) {
        clearTimeout(room.bombTimeout);
        io.to(room.code).emit('turn-update', room.getGameState());
        startBombTimer(room);
      }
    }
  });
});

function startBombTimer(room) {
  const duration = room.getBombDuration();
  room.bombStartTime = Date.now();
  room.bombDuration = duration;

  io.to(room.code).emit('bomb-tick', { duration });

  room.bombTimeout = setTimeout(() => {
    const result = room.explodeBomb();
    io.to(room.code).emit('bomb-exploded', {
      playerId: result.playerId,
      lives: result.lives,
      playerName: result.playerName,
      gameState: room.getGameState()
    });

    const winner = room.checkWinner();
    if (winner) {
      setTimeout(() => {
        io.to(room.code).emit('game-over', { winner });
        room.resetGame();
      }, 2000);
    } else {
      setTimeout(() => {
        room.nextRound();
        io.to(room.code).emit('new-round', room.getGameState());
        startBombTimer(room);
      }, 2500);
    }
  }, duration);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 ============================`);
  console.log(`💣 BOMB PARTY SERVER`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🎮 ============================\n`);
});
