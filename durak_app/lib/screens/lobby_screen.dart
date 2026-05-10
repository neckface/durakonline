// lib/screens/lobby_screen.dart
import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants.dart';
import 'game_screen.dart';

class LobbyScreen extends StatefulWidget {
  final String userId;
  final String username;
  final int balance;
  final String token; // <-- Добавили

  const LobbyScreen({
    super.key,
    required this.userId,
    required this.username,
    required this.balance,
    required this.token, // <-- Добавили
  });
  // ...

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  late IO.Socket socket;
  final TextEditingController _lobbyIdController = TextEditingController();
  String? _myLobbyId;

  @override
  void initState() {
    super.initState();
    _connectSocket();
  }

  void _connectSocket() {
    socket = IO.io(serverUrl, IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': widget.token}) // <-- ПЕРЕДАЕМ ТОКЕН СЮДА!
        .build());

    socket.on('lobby_created', (data) {
      setState(() => _myLobbyId = data['lobbyId']);
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Лобби создано!'),
          content: Text('ID для друга: $_myLobbyId'),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('ОК'))],
        ),
      );
    });

    socket.on('game_update', (data) {
      if (mounted && ModalRoute.of(context)?.settings.name != '/game') {
        socket.off('game_update');
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            settings: const RouteSettings(name: '/game'),
            builder: (context) => GameScreen(
              socket: socket,
              lobbyId: _myLobbyId ?? _lobbyIdController.text,
              initialState: data,
            ),
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Привет, ${widget.username}!')),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Баланс: ${widget.balance} 💰', style: const TextStyle(fontSize: 24, color: Colors.amber)),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () => socket.emit('create_lobby'),
              child: const Text('Создать лобби'),
            ),
            const Divider(height: 60, thickness: 2),
            TextField(
              controller: _lobbyIdController,
              decoration: const InputDecoration(labelText: 'ID лобби друга', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
              onPressed: () => socket.emit('join_lobby', {'lobbyId': _lobbyIdController.text}),
              child: const Text('Подключиться'),
            ),
          ],
        ),
      ),
    );
  }
}