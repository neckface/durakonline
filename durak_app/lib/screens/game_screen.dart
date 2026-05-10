// lib/screens/game_screen.dart
import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../widgets/playing_card.dart';

class GameScreen extends StatefulWidget {
  final IO.Socket socket;
  final String lobbyId;
  final dynamic initialState;

  const GameScreen({
    super.key,
    required this.socket,
    required this.lobbyId,
    required this.initialState,
  });

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late dynamic gameState;

  @override
  void initState() {
    super.initState();
    gameState = widget.initialState;

    widget.socket.on('game_update', (data) {
      if (mounted) {
        setState(() {
          gameState = data;
        });
      }
    });
  }

  @override
  void dispose() {
    widget.socket.off('game_update');
    super.dispose();
  }

  void _playCard(Map<String, dynamic> card) {
    if (!gameState['isMyAction']) return;
    widget.socket.emit('play_card', {
      'lobbyId': widget.lobbyId,
      'card': card
    });
  }

  void _performAction() {
    if (gameState['isAttacker']) {
      widget.socket.emit('pass_turn', {'lobbyId': widget.lobbyId});
    } else {
      widget.socket.emit('take_cards', {'lobbyId': widget.lobbyId});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (gameState['winner'] != null) {
      return Scaffold(
        body: Center(
          child: Text(
            gameState['winner'] == widget.socket.id ? 'ВЫ ПОБЕДИЛИ! 🏆' : 'ВЫ ПРОИГРАЛИ 💀',
            style: const TextStyle(fontSize: 40, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }

    List<dynamic> myCards = gameState['myCards'];
    List<dynamic> table = gameState['table'];
    Map<String, dynamic> trumpCard = gameState['trumpCard'];
    bool isMyAction = gameState['isMyAction'];
    bool isAttacker = gameState['isAttacker'];

    return Scaffold(
      appBar: AppBar(
        title: Text(isAttacker ? 'Ваша Атака ⚔️' : 'Ваша Защита 🛡️'),
        backgroundColor: isMyAction ? Colors.green[800] : Colors.grey[800],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(10.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Карт: ${gameState['deckSize']}', style: const TextStyle(fontSize: 18)),
                Row(
                  children: [
                    const Text('Козырь: ', style: TextStyle(fontSize: 18)),
                    PlayingCard(cardData: trumpCard, isSmall: true),
                  ],
                ),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: Center(
              child: table.isEmpty
                  ? const Text('Стол пуст', style: TextStyle(color: Colors.grey, fontSize: 20))
                  : Wrap(
                      spacing: 20,
                      runSpacing: 20,
                      children: table.map((pair) {
                        return Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PlayingCard(cardData: pair['attack']),
                            const SizedBox(height: 5),
                            pair['defense'] != null
                                ? PlayingCard(cardData: pair['defense'])
                                : Container(width: 60, height: 85, decoration: BoxDecoration(border: Border.all(color: Colors.white30))),
                          ],
                        );
                      }).toList(),
                    ),
            ),
          ),
          if (table.isNotEmpty && isMyAction)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isAttacker ? Colors.blue : Colors.red,
                  padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 15)
                ),
                onPressed: _performAction,
                child: Text(isAttacker ? 'БИТО (Пас)' : 'БЕРУ', style: const TextStyle(fontSize: 20)),
              ),
            ),
          Container(
            color: Colors.black26,
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                Text(isMyAction ? 'ТВОЙ ХОД!' : 'Ожидание соперника...',
                    style: TextStyle(color: isMyAction ? Colors.greenAccent : Colors.grey)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  alignment: WrapAlignment.center,
                  children: myCards.map((card) {
                    return GestureDetector(
                      onTap: () => _playCard(card),
                      child: PlayingCard(cardData: card),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}