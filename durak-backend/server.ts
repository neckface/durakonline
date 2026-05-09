import * as dotenv from 'dotenv';
dotenv.config(); // Читаем файл .env

import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// ИМПОРТЫ ДЛЯ БАЗЫ ДАННЫХ
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// ИМПОРТ ЛОГИКИ ИГРЫ
import { DurakGame } from './game/DurakGame'; 

// ==========================================
// 1. НАСТРОЙКА БАЗЫ ДАННЫХ (Prisma + PostgreSQL)
// ==========================================
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("ВНИМАНИЕ: DATABASE_URL не найден в файле .env!");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ==========================================
// 2. НАСТРОЙКА СЕРВЕРА (Express + Socket.io)
// ==========================================
const app = express();
app.use(cors());
app.use(express.json()); // Важно! Позволяет серверу читать JSON из HTTP-запросов
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

// ==========================================
// 3. HTTP API (Авторизация)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }

  try {
    let user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) {
      user = await prisma.user.create({
        data: { username, balance: 1500 }
      });
      console.log(`👤 Зарегистрирован новый игрок: ${username}`);
    } else {
      console.log(`👋 Игрок вернулся: ${username} (Баланс: ${user.balance})`);
    }

    res.json({ id: user.id, username: user.username, balance: user.balance });
  } catch (error) {
    console.error('Ошибка БД:', error);
    res.status(500).json({ error: 'Ошибка базы данных' });
  }
});

// ==========================================
// 4. СТРУКТУРА ЛОББИ
// ==========================================
interface Lobby {
  id: string;
  players: string[];
  status: 'waiting' | 'playing';
  game?: DurakGame; 
}

const lobbies = new Map<string, Lobby>();

// ==========================================
// 5. СОКЕТЫ (Игровая логика в реальном времени)
// ==========================================
io.on('connection', (socket: Socket) => {
  // Получаем ID пользователя из базы, который Flutter передал при подключении
  const userId = socket.handshake.query.userId;
  console.log(`🟢 Новый игрок подключился: ${socket.id} (DB ID: ${userId})`);

  // Создание лобби
  socket.on('create_lobby', () => {
    const lobbyId = `lobby_${Math.floor(Math.random() * 1000)}`;
    
    lobbies.set(lobbyId, {
      id: lobbyId,
      players: [socket.id],
      status: 'waiting'
    });

    socket.join(lobbyId);
    console.log(`🏠 Лобби ${lobbyId} создано игроком ${socket.id}`);
    
    socket.emit('lobby_created', { lobbyId });
  });

  // Подключение к лобби
  socket.on('join_lobby', (data: { lobbyId: string }) => {
    const lobby = lobbies.get(data.lobbyId);

    if (!lobby) {
      socket.emit('error', { message: 'Лобби не найдено!' });
      return;
    }

    if (lobby.players.length >= 2) {
      socket.emit('error', { message: 'Лобби уже заполнено!' });
      return;
    }

    // Добавляем второго игрока
    lobby.players.push(socket.id);
    lobby.status = 'playing';
    socket.join(data.lobbyId);

    console.log(`🤝 Игрок ${socket.id} зашел в лобби. Создаем игру...`);

    // Инициализируем ООП логику игры
    lobby.game = new DurakGame([lobby.players[0], lobby.players[1]]);

    // Рассылаем каждому игроку ТОЛЬКО ЕГО карты
    for (let playerId of lobby.players) {
      const playerObject = lobby.game.players.find(p => p.id === playerId);
      
      if (playerObject) {
        io.to(playerId).emit('game_started', {
          message: 'Игра началась!',
          myCards: playerObject.hand, 
          trumpCard: lobby.game.trumpCard,
          players: lobby.players
        });
      }
    }
  });

  // Игрок делает ход
  socket.on('play_card', (data: { lobbyId: string, card: any }) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || !lobby.game) return;

    console.log(`🃏 Сыграна карта:`, data.card);
    
    // В будущем здесь будет проверка валидности хода через lobby.game.attack()
    // Пока просто пересылаем карту оппоненту
    socket.to(data.lobbyId).emit('opponent_played', { card: data.card });
  });

  // Отключение
  socket.on('disconnect', () => {
    console.log(`🔴 Игрок отключился: ${socket.id}`);
    // В будущем здесь нужно будет удалять лобби и присуждать техническое поражение
  });
});

// ==========================================
// 6. ЗАПУСК СЕРВЕРА
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Сервер Дурака запущен на порту ${PORT}`);
});