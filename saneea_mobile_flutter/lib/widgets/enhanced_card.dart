import 'package:flutter/material.dart';

class EnhancedCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final List<Color>? gradientColors;
  final Color? shadowColor;
  final double? elevation;
  final BorderRadius? borderRadius;

  const EnhancedCard({
    Key? key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.gradientColors,
    this.shadowColor,
    this.elevation,
    this.borderRadius,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final defaultBorderRadius = BorderRadius.circular(16);
    final cardBorderRadius = borderRadius ?? defaultBorderRadius;
    
    Widget cardContent = Container(
      decoration: BoxDecoration(
        color: gradientColors == null ? Colors.white : null,
        gradient: gradientColors != null
            ? LinearGradient(
                colors: gradientColors!,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        borderRadius: cardBorderRadius,
        boxShadow: [
          BoxShadow(
            color: (shadowColor ?? Colors.black).withValues(alpha: 0.08),
            blurRadius: elevation ?? 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      margin: margin ?? EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: padding ?? EdgeInsets.all(20),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: cardBorderRadius,
          onTap: onTap,
          child: cardContent,
        ),
      );
    }

    return cardContent;
  }
}

class GlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final double opacity;
  final BorderRadius? borderRadius;

  const GlassCard({
    Key? key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.opacity = 0.1,
    this.borderRadius,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final cardBorderRadius = borderRadius ?? BorderRadius.circular(20);
    
    Widget cardContent = Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: opacity),
        borderRadius: cardBorderRadius,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      margin: margin ?? EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: padding ?? EdgeInsets.all(20),
        child: child,
      ),
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: cardBorderRadius,
          onTap: onTap,
          child: cardContent,
        ),
      );
    }

    return cardContent;
  }
}

class StatusChip extends StatelessWidget {
  final String text;
  final Color color;
  final bool isGradient;

  const StatusChip({
    Key? key,
    required this.text,
    required this.color,
    this.isGradient = true,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isGradient ? null : color.withValues(alpha: 0.1),
        gradient: isGradient
            ? LinearGradient(
                colors: [color, color.withValues(alpha: 0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        borderRadius: BorderRadius.circular(20),
        border: !isGradient
            ? Border.all(color: color.withValues(alpha: 0.3))
            : null,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: isGradient ? Colors.white : color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}