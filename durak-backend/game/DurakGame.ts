// Различные типы для строгой типизации (TypeScript спасет от опечаток)
export type Suit = '♠' | '♣' | '♥' | '♦';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

// Присваиваем картам "вес" для легкого сравнения, кто старше
const RankValues: Record<Rank, number> = {
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

// 1. Класс Карты
export class Card {
    constructor(public suit: Suit, public rank: Rank) {}

    get weight(): number {
        return RankValues[this.rank];
    }

    // Удобный вывод для логов (например: "♠ A")
    toString(): string {
        return `${this.suit} ${this.rank}`;
    }
}

// 2. Класс Игрока
export class Player {
    public hand: Card[] = [];
    
    constructor(public id: string) {}

    // Метод: есть ли такая карта у игрока?
    hasCard(suit: Suit, rank: Rank): boolean {
        return this.hand.some(c => c.suit === suit && c.rank === rank);
    }

    // Метод: забрать карту из руки (когда сыграл ею)
    removeCard(suit: Suit, rank: Rank): Card | null {
        const index = this.hand.findIndex(c => c.suit === suit && c.rank === rank);
        if (index !== -1) {
            return this.hand.splice(index, 1)[0];
        }
        return null;
    }
}

// 3. Главный Класс Игры (Судья)
export class DurakGame {
    public deck: Card[] = [];
    public trumpCard!: Card;
    public players: Player[] = [];
    public attackerIndex: number = 0;
    
    // Карты на столе: пара { атака: Карта, защита: Карта | null }
    public table: { attack: Card, defense: Card | null }[] = [];

    constructor(playerIds: string[]) {
        this.players = playerIds.map(id => new Player(id));
        this.initializeDeck();
        this.dealCards();
        this.determineFirstAttacker();
    }

    // --- ПОДГОТОВКА ИГРЫ ---

    private initializeDeck() {
        const suits: Suit[] = ['♠', '♣', '♥', '♦'];
        const ranks: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        for (let suit of suits) {
            for (let rank of ranks) {
                this.deck.push(new Card(suit, rank));
            }
        }
        // Перемешиваем
        this.deck.sort(() => Math.random() - 0.5);
        this.trumpCard = this.deck[this.deck.length - 1]; // Последняя карта - козырь
    }

    public dealCards() {
        for (let player of this.players) {
            while (player.hand.length < 6 && this.deck.length > 0) {
                player.hand.push(this.deck.shift()!);
            }
        }
    }

    private determineFirstAttacker() {
        let lowestTrump = 15; // Больше туза
        let firstPlayerIndex = 0;

        this.players.forEach((player, index) => {
            const trumpsInHand = player.hand.filter(c => c.suit === this.trumpCard.suit);
            for (let card of trumpsInHand) {
                if (card.weight < lowestTrump) {
                    lowestTrump = card.weight;
                    firstPlayerIndex = index;
                }
            }
        });
        this.attackerIndex = firstPlayerIndex;
    }

    // --- ИГРОВАЯ ЛОГИКА (ХОДЫ) ---

    // Атака (Подкидывание / Первый ход)
    public attack(playerId: string, cardObj: { suit: Suit, rank: Rank }): boolean {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        // Проверка: очередь ли этого игрока атаковать? (В прототипе 1v1)
        if (this.players[this.attackerIndex].id !== playerId) return false;

        // Проверка: есть ли карта на руках
        const card = player.removeCard(cardObj.suit, cardObj.rank);
        if (!card) return false;

        // Если стол не пустой, можно подкидывать только карты того же ранга
        if (this.table.length > 0) {
            const allowedRanks = this.table.flatMap(t => {
                const ranks = [t.attack.rank];
                if (t.defense) ranks.push(t.defense.rank);
                return ranks;
            });
            if (!allowedRanks.includes(card.rank)) {
                player.hand.push(card); // Возвращаем карту, ход нелегален
                return false;
            }
        }

        // Кладем карту на стол
        this.table.push({ attack: card, defense: null });
        return true;
    }

    // Защита (Отбивание карты)
    public defend(playerId: string, attackCardInfo: {suit: Suit, rank: Rank}, defendCardInfo: {suit: Suit, rank: Rank}): boolean {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return false;

        const tableEntry = this.table.find(t => t.attack.suit === attackCardInfo.suit && t.attack.rank === attackCardInfo.rank && !t.defense);
        if (!tableEntry) return false; // Такой не побитой карты на столе нет

        const defCard = player.removeCard(defendCardInfo.suit, defendCardInfo.rank);
        if (!defCard) return false;

        const attCard = tableEntry.attack;
        const isTrump = defCard.suit === this.trumpCard.suit;
        const isAttackTrump = attCard.suit === this.trumpCard.suit;

        let isValidDefense = false;
        
        // 1. Бьем картой той же масти, но старше
        if (defCard.suit === attCard.suit && defCard.weight > attCard.weight) {
            isValidDefense = true;
        } 
        // 2. Бьем козырем обычную карту
        else if (isTrump && !isAttackTrump) {
            isValidDefense = true;
        }

        if (isValidDefense) {
            tableEntry.defense = defCard;
            return true;
        } else {
            player.hand.push(defCard); // Возвращаем карту
            return false;
        }
    }

    // --- ЗАВЕРШЕНИЕ РАУНДА ---

    // Игрок берет карты (если не смог отбиться)
    public takeCards(playerId: string) {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        // Забираем весь стол в руку
        this.table.forEach(t => {
            player.hand.push(t.attack);
            if (t.defense) player.hand.push(t.defense);
        });
        
        this.table = []; // Очищаем стол
        this.dealCards(); // Добор карт (атакующий добирает)
        // Ход остается у атакующего (защитник пропустил ход)
    }

    // Бито (Оба согласны)
    public passTurn() {
        this.table = []; // Карты уходят в отбой
        this.dealCards(); // Все добирают карты до 6
        // Ход переходит к защитнику
        this.attackerIndex = (this.attackerIndex + 1) % this.players.length; 
    }

    // Проверка победителя (если null - игра продолжается)
    public getWinner(): string | null {
        if (this.deck.length > 0) return null;
        
        const emptyHands = this.players.filter(p => p.hand.length === 0);
        if (emptyHands.length === 1) {
            return emptyHands[0].id; // Этот игрок победил (вышел)
        }
        return null;
    }
}