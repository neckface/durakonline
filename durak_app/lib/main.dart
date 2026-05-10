// lib/main.dart
import 'package:flutter/material.dart';
// ВАЖНО: Эта строчка "знакомит" главный файл с экраном входа
import 'screens/login_screen.dart'; 

void main() => runApp(const DurakApp());

class DurakApp extends StatelessWidget {
  const DurakApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Дурак Онлайн',
      debugShowCheckedModeBanner: false, // Убираем красную ленточку DEBUG
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF1E1E24),
        colorScheme: const ColorScheme.dark(primary: Colors.green),
      ),
      // Теперь Flutter знает, откуда брать этот экран
      home: const LoginScreen(), 
    );
  }
}