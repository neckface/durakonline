// server.ts
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';

import { DatabaseService } from './src/services/database.service';
import { DurakGame } from './src/game/DurakGame';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- HTTP API: РЕГИСТРАЦИЯ И ВХОД ---
app.post('/api/register', async (req, res) => {
  try {
    const data = await DatabaseService.registerUser(req.body.username, req.body.password);
    res.json(data);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const data = await DatabaseService.loginUser(req.body.username, req.body.password);
    res.json(data);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

// Храним активные объекты игр в памяти
const activeGames = new Map<string, DurakGame>();

// --- ЗАЩИТА WEBSOCKET (MIDDLEWARE) ---
// Этот блок проверяет токен ПЕРЕД тем, как разрешить соединение
io.use((socket, next) => {
  const token = socket.handshake.auth.token; 
  
  if (!token) {
    return next(new Error("Отказано в доступе. Нет токена."));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    // Сохраняем проверенный userId прямо в объекте сокета
    (socket as any).userId = decoded.userId; 
    next();
  } catch (err) {
    next(new Error("Недействительный токен авторизации."));
  }
});

// Вспомогательная функция для отправки состояния стола
function broadcastGameState(sessionId: string, game: DurakGame) {
  const attackerId = game.players[game.attackerIndex].id;
  const defenderId = game.players[(game.attackerIndex + 1) % 2].id;
  const winner = game.getWinner();

  for (let player of game.players) {
    const isAttacker = player.id === attackerId;
    const isDefender = player.id === defenderId;
    const unbeatCards = game.table.filter(t => t.defense === null);
    
    let isMyAction = false;
    // Логика: чей сейчас ход?
    if (isAttacker && unbeatCards.length === 0) isMyAction = true;
    if (isDefender && unbeatCards.length > 0) isMyAction = true;

    // Отправляем данные в персональную комнату игрока (комната называется его userId)
    io.to(player.id).emit('game_update', {
      table: game.table,
      myCards: player.hand,
      deckSize: game.deck.length,
      trumpCard: game.trumpCard,
      isAttacker: isAttacker,
      isMyAction: isMyAction,
      winner: winner
    });
  }
}

// --- SOCKETS ---
io.on('connection', (socket) => {
  // Берем userId, который мы сохранили в middleware
  const userId = (socket as any).userId;
  console.log(`👤 Игрок подключен: ${userId}`);

  // Игрок подписывается на свою личную комнату для получения карт
  socket.join(userId);

  socket.on('create_lobby', async () => {
    try {
      const session = await DatabaseService.createLobby(userId);
      socket.join(session.id);
      socket.emit('lobby_created', { lobbyId: session.id });
    } catch (e) {
      console.error(e);
      socket.emit('error', { message: 'Ошибка БД при создании лобби' });
    }
  });

  socket.on('join_lobby', async (data: { lobbyId: string }) => {
    try {
      const session = await DatabaseService.joinLobby(data.lobbyId, userId);
      socket.join(session.id);

      if (session.status === 'PLAYING') {
        if (!activeGames.has(session.id)) {
          const playerIds = (session as any).players.map((p: any) => p.userId);
          activeGames.set(session.id, new DurakGame(playerIds));
        }
        broadcastGameState(session.id, activeGames.get(session.id)!);
      }
    } catch (e: any) {
      console.error(e);
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('play_card', (data: { lobbyId: string, card: any }) => {
    const game = activeGames.get(data.lobbyId);
    if (!game) return;

    const attackerId = game.players[game.attackerIndex].id;
    if (userId === attackerId) {
      if (game.attack(userId, data.card)) broadcastGameState(data.lobbyId, game);
    } else {
      const unbeatAttack = game.table.find(t => t.defense === null);
      if (unbeatAttack && game.defend(userId, unbeatAttack.attack, data.card)) {
        broadcastGameState(data.lobbyId, game);
      }
    }
  });

  socket.on('take_cards', (data: { lobbyId: string }) => {
    const game = activeGames.get(data.lobbyId);
    if (game) {
      game.takeCards(userId);
      broadcastGameState(data.lobbyId, game);
    }
  });

  socket.on('pass_turn', (data: { lobbyId: string }) => {
    const game = activeGames.get(data.lobbyId);
    if (game) {
      game.passTurn();
      broadcastGameState(data.lobbyId, game);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Игрок отключился: ${userId}`);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));