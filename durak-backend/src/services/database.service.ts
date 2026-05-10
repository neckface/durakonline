// src/services/database.service.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs'; // <-- Добавили криптографию
import jwt from 'jsonwebtoken'; // <-- Добавили токены

const connectionString = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!connectionString) throw new Error("DATABASE_URL not found!");
if (!jwtSecret) throw new Error("JWT_SECRET not found in .env!");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export class DatabaseService {
  
  // 1. РЕГИСТРАЦИЯ
  static async registerUser(username: string, passwordPlain: string) {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) throw new Error('Пользователь с таким именем уже существует');

    // Шифруем пароль (10 "солевых" раундов - стандарт безопасности)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const newUser = await prisma.user.create({
      data: { username, passwordHash, balance: 1500 }
    });

    return this.generateAuthResponse(newUser);
  }

  // 2. ВХОД
  static async loginUser(username: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash) throw new Error('Неверное имя пользователя или пароль');

    // Сравниваем введенный пароль с хэшем из БД
    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) throw new Error('Неверное имя пользователя или пароль'); // Не уточняем, что именно неверно (защита от перебора)

    // Обновляем время входа
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return this.generateAuthResponse(user);
  }

  // Вспомогательная функция для выдачи токена
  private static generateAuthResponse(user: any) {
    // Выдаем токен сроком на 24 часа
    const token = jwt.sign({ userId: user.id, username: user.username }, jwtSecret!, { expiresIn: '24h' });
    
    return {
      id: user.id,
      username: user.username,
      balance: user.balance,
      token: token // <-- Теперь возвращаем токен!
    };
  }

  // ... методы createLobby и joinLobby остаются БЕЗ ИЗМЕНЕНИЙ
  static async createLobby(creatorId: string) {
    const session = await prisma.gameSession.create({ data: { creatorId, status: 'WAITING', maxPlayers: 2 } });
    await prisma.sessionPlayer.create({ data: { sessionId: session.id, userId: creatorId, seatPosition: 0, isReady: true } });
    return session;
  }

  static async joinLobby(sessionId: string, userId: string) {
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { players: true } });
    if (!session) throw new Error('Лобби не найдено');
    if (session.players.length >= session.maxPlayers) throw new Error('Лобби заполнено');

    const alreadyIn = session.players.find(p => p.userId === userId);
    if (!alreadyIn) {
      await prisma.sessionPlayer.create({ data: { sessionId, userId, seatPosition: session.players.length, isReady: true } });
    }

    if (session.players.length + 1 === 2) {
      return await prisma.gameSession.update({
        where: { id: sessionId },
        data: { status: 'PLAYING', startedAt: new Date() },
        include: { players: { include: { user: true } } }
      });
    }
    return session;
  }
}