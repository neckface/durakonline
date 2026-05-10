// lib/widgets/playing_card.dart
import 'package:flutter/material.dart';

class PlayingCard extends StatelessWidget {
  final Map<String, dynamic> cardData;
  final bool isSmall;

  const PlayingCard({
    super.key,
    required this.cardData,
    this.isSmall = false,
  });

  @override
  Widget build(BuildContext context) {
    final String suit = cardData['suit'];
    final String rank = cardData['rank'];
    final bool isRed = suit == '♥' || suit == '♦';
    
    final double width = isSmall ? 40 : 60;
    final double height = isSmall ? 55 : 85;
    final double fontSize = isSmall ? 16 : 24;

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: Colors.black),
      ),
      child: Center(
        child: Text(
          '$suit\n$rank',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.bold,
            color: isRed ? Colors.red : Colors.black,
          ),
        ),
      ),
    );
  }
}