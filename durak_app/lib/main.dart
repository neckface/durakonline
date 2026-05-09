import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:http/http.dart' as http;
import 'dart:convert';

// ВНИМАНИЕ: Если будете тестировать на реальном Android-телефоне, 
// замените localhost на IP-адрес вашего Ubuntu-ноутбука (например, 192.168.1.5)
const String serverUrl = 'http://localhost:3000';

void main() => runApp(const DurakApp());

class DurakApp extends StatelessWidget {
  const DurakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Дурак Онлайн',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF1E1E24),
        colorScheme: const ColorScheme.dark(primary: Colors.green),
      ),
      home: const LoginScreen(),
    );
  }
}

// ==========================================
// 1. ЭКРАН ВХОДА (Подключение к PostgreSQL)
// ==========================================
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _nameController = TextEditingController();
  bool _isLoading = false;

  Future<void> _login() async {
    if (_nameController.text.isEmpty) return;
    setState(() => _isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$serverUrl/api/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': _nameController.text}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => LobbyScreen(
                userId: data['id'],
                username: data['username'],
                balance: data['balance'],
              ),
            ),
          );
        }
      } else {
        throw Exception('Ошибка сервера');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('♠♣♥♦', style: TextStyle(fontSize: 40)),
              const Text('Дурак Онлайн', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
              const SizedBox(height: 30),
              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Ваш Никнейм',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              _isLoading
                  ? const CircularProgressIndicator()
                  : ElevatedButton(
                      style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                      onPressed: _login,
                      child: const Text('Войти в игру', style: TextStyle(fontSize: 18)),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

// ==========================================
// 2. ЭКРАН ЛОББИ (Сокеты)
// ==========================================
class LobbyScreen extends StatefulWidget {
  final String userId;
  final String username;
  final int balance;

  const LobbyScreen({super.key, required this.userId, required this.username, required this.balance});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  late IO.Socket socket;
  final TextEditingController _lobbyIdController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _connectSocket();
  }

  void _connectSocket() {
    // Подключаемся, передавая ID из базы данных
    socket = IO.io(serverUrl, IO.OptionBuilder()
        .setTransports(['websocket'])
        .setQuery({'userId': widget.userId})
        .build());

    socket.onConnect((_) => print('🟢 Подключено к серверу'));

    // Сервер создал лобби
    socket.on('lobby_created', (data) {
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Лобби создано!'),
          content: Text('ID для друга: ${data['lobbyId']}'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('ОК'))
          ],
        ),
      );
    });

    // Игра началась (переходим на стол)
    socket.on('game_started', (data) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => GameScreen(
            socket: socket,
            myCards: List<Map<String, dynamic>>.from(data['myCards']),
            trumpCard: data['trumpCard'],
          ),
        ),
      );
    });

    socket.on('error', (data) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(data['message'])));
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
              decoration: const InputDecoration(labelText: 'Вставьте ID лобби друга', border: OutlineInputBorder()),
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

// ==========================================
// 3. ЭКРАН ИГРЫ (Карты на столе)
// ==========================================
class GameScreen extends StatelessWidget {
  final IO.Socket socket;
  final List<Map<String, dynamic>> myCards;
  final Map<String, dynamic> trumpCard;

  const GameScreen({super.key, required this.socket, required this.myCards, required this.trumpCard});

  @override
  Widget build(BuildContext context) {
    bool isTrumpRed = trumpCard['suit'] == '♥' || trumpCard['suit'] == '♦';

    return Scaffold(
      appBar: AppBar(title: const Text('Игровой стол')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Козырь:', style: TextStyle(fontSize: 20)),
            Text(
              '${trumpCard['suit']} ${trumpCard['rank']}', 
              style: TextStyle(fontSize: 40, color: isTrumpRed ? Colors.red : Colors.white)
            ),
            
            const SizedBox(height: 50),
            
            const Text('Ваши карты:', style: TextStyle(fontSize: 20)),
            const SizedBox(height: 10),
            
            // Отрисовка карт в руке
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: myCards.map((card) {
                bool isRed = card['suit'] == '♥' || card['suit'] == '♦';
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${card['suit']} ${card['rank']}',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: isRed ? Colors.red : Colors.black),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}