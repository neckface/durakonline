import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Настраиваем подключение (точно так же, как в сервере)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("ВНИМАНИЕ: DATABASE_URL не найден в файле .env!");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter }); // Теперь Prisma видит базу!

// 2. Данные для колоды
const suits = ['♠', '♣', '♥', '♦'];
const ranks = [
  { rank: '6', power: 6 },
  { rank: '7', power: 7 },
  { rank: '8', power: 8 },
  { rank: '9', power: 9 },
  { rank: '10', power: 10 },
  { rank: 'J', power: 11 },
  { rank: 'Q', power: 12 },
  { rank: 'K', power: 13 },
  { rank: 'A', power: 14 },
];

async function main() {
  console.log('Начинаем загрузку колоды в базу данных...');

  // Очищаем старую колоду
  await prisma.cardsDictionary.deleteMany();

  // Генерируем 36 карт
  let cardsCreated = 0;
  for (const suit of suits) {
    for (const r of ranks) {
      await prisma.cardsDictionary.create({
        data: {
          suit: suit,
          rank: r.rank,
          powerValue: r.power,
        },
      });
      cardsCreated++;
    }
  }

  console.log(`✅ Успешно добавлено ${cardsCreated} карт в словарь (CardsDictionary)!`);
}

main()
  .catch((e) => {
    console.error('Ошибка при сидировании:', e);
    process.exit(1);
  })
  .finally(async () => {
    // Закрываем соединение, чтобы скрипт корректно завершился
    await prisma.$disconnect();
    await pool.end(); 
  });