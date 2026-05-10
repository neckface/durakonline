// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/constants.dart';
import 'lobby_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController(); // <-- Контроллер пароля
  bool _isLoading = false;
  bool _isLoginMode = true; // <-- Переключатель режима

  Future<void> _submit() async {
    if (_nameController.text.isEmpty || _passwordController.text.isEmpty) return;
    setState(() => _isLoading = true);

    final endpoint = _isLoginMode ? '/api/login' : '/api/register';

    try {
      final response = await http.post(
        Uri.parse('$serverUrl$endpoint'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': _nameController.text,
          'password': _passwordController.text // <-- Отправляем пароль
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => LobbyScreen(
                userId: data['id'],
                username: data['username'],
                balance: double.parse(data['balance'].toString()).toInt(),
                token: data['token'], // <-- Передаем токен в Лобби!
              ),
            ),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(data['error'] ?? 'Ошибка')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ошибка соединения: $e')));
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
                decoration: const InputDecoration(labelText: 'Никнейм', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _passwordController,
                obscureText: true, // <-- Скрываем пароль звездочками
                decoration: const InputDecoration(labelText: 'Пароль', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 20),
              _isLoading
                  ? const CircularProgressIndicator()
                  : ElevatedButton(
                      style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
                      onPressed: _submit,
                      child: Text(_isLoginMode ? 'Войти' : 'Зарегистрироваться'),
                    ),
              TextButton(
                onPressed: () => setState(() => _isLoginMode = !_isLoginMode),
                child: Text(_isLoginMode ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'),
              )
            ],
          ),
        ),
      ),
    );
  }
}