const { getRandomLetters, isValidWord } = require('./words');

class Player {
  constructor(id, name, avatar) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.lives = 3;
    this.score = 0;
    this.isAlive = true;
  }
}

class Room {
  constructor(code) {
    this.code = code;
    this.players = [];
    this.hostId = null;
    this.gameStarted = false;
    this.currentPlayerIndex = 0;
    this.currentLetters = '';
    this.usedWords = new Set();
    this.round = 0;
    this.bombTimeout = null;
    this.bombStartTime = null;
    this.bombDuration = null;
    this.maxBombTime = 25000;
    this.minBombTime = 8000;
  }

  addPlayer(id, name, avatar) {
    const player = new Player(id, name, avatar);
    this.players.push(player);
    if (this.players.length === 1) this.hostId = id;
    return player;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    if (this.players.length > 0 && this.hostId === id) {
      this.hostId = this.players[0].id;
    }
    if (this.gameStarted) {
      const alive = this.getAlivePlayers();
      if (this.currentPlayerIndex >= alive.length) {
        this.currentPlayerIndex = 0;
      }
    }
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  isCurrentPlayer(id) {
    const alive = this.getAlivePlayers();
    return alive[this.currentPlayerIndex]?.id === id;
  }

  startGame() {
    this.gameStarted = true;
    this.round = 1;
    this.usedWords.clear();
    this.currentPlayerIndex = 0;
    this.currentLetters = getRandomLetters(this.round);
    this.players.forEach(p => {
      p.lives = 3;
      p.isAlive = true;
      p.score = 0;
    });
  }

  submitWord(playerId, word) {
    const alive = this.getAlivePlayers();
    if (alive[this.currentPlayerIndex]?.id !== playerId) {
      return { valid: false, reason: 'Bukan giliranmu!' };
    }

    word = word.toLowerCase().trim();

    if (word.length < 2) {
      return { valid: false, reason: 'Kata terlalu pendek!' };
    }

    if (!word.includes(this.currentLetters.toLowerCase())) {
      return { valid: false, reason: `Kata harus mengandung "${this.currentLetters}"!` };
    }

    if (this.usedWords.has(word)) {
      return { valid: false, reason: 'Kata sudah dipakai!' };
    }

    if (!isValidWord(word)) {
      return { valid: false, reason: 'Kata tidak ada di kamus!' };
    }

    this.usedWords.add(word);
    const player = this.players.find(p => p.id === playerId);
    player.score += word.length * 10;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % alive.length;
    this.currentLetters = getRandomLetters(this.round);

    return { valid: true, word };
  }

  explodeBomb() {
    const alive = this.getAlivePlayers();
    const player = alive[this.currentPlayerIndex];
    player.lives--;
    if (player.lives <= 0) player.isAlive = false;
    return { playerId: player.id, lives: player.lives, playerName: player.name };
  }

  nextRound() {
    const alive = this.getAlivePlayers();
    if (alive.length <= 1) return;
    this.currentPlayerIndex = this.currentPlayerIndex % alive.length;
    this.currentLetters = getRandomLetters(this.round);
    this.round++;
  }

  checkWinner() {
    const alive = this.getAlivePlayers();
    if (alive.length === 1) return alive[0];
    return null;
  }

  getBombDuration() {
    const reduction = Math.min(this.round * 400, this.maxBombTime - this.minBombTime);
    const max = this.maxBombTime - reduction;
    const min = Math.max(this.minBombTime, max - 5000);
    return Math.floor(Math.random() * (max - min) + min);
  }

  resetGame() {
    this.gameStarted = false;
    clearTimeout(this.bombTimeout);
  }

  getPlayersInfo() {
    return this.players.map(p => ({
      id: p.id, name: p.name, avatar: p.avatar,
      lives: p.lives, score: p.score, isAlive: p.isAlive,
      isHost: p.id === this.hostId
    }));
  }

  getGameState() {
    const alive = this.getAlivePlayers();
    return {
      players: this.getPlayersInfo(),
      currentPlayerId: alive[this.currentPlayerIndex]?.id,
      currentLetters: this.currentLetters,
      round: this.round,
      usedWordsCount: this.usedWords.size
    };
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom() {
    let code;
    do { code = this.generateCode(); } while (this.rooms.has(code));
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code?.toUpperCase());
  }

  findRoomByPlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) return room;
    }
    return null;
  }

  removeRoom(code) { this.rooms.delete(code); }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }
}

module.exports = { Room, RoomManager, Player };
