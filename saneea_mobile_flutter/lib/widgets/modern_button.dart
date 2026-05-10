import 'package:flutter/material.dart';

class ModernButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData? icon;
  final List<Color>? gradientColors;
  final Color? backgroundColor;
  final Color? textColor;
  final double? width;
  final double height;
  final BorderRadius? borderRadius;
  final bool isLoading;
  final bool isOutlined;
  final double fontSize;
  final FontWeight fontWeight;

  const ModernButton({
    Key? key,
    required this.text,
    this.onPressed,
    this.icon,
    this.gradientColors,
    this.backgroundColor,
    this.textColor,
    this.width,
    this.height = 56,
    this.borderRadius,
    this.isLoading = false,
    this.isOutlined = false,
    this.fontSize = 16,
    this.fontWeight = FontWeight.w600,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final defaultGradient = [Color(0xFF6A3DE8), Color(0xFF8B5CF6)];
    final buttonBorderRadius = borderRadius ?? BorderRadius.circular(16);
    
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: !isOutlined && gradientColors != null
            ? LinearGradient(
                colors: gradientColors!,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : !isOutlined && backgroundColor == null
                ? LinearGradient(
                    colors: defaultGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
        color: isOutlined ? Colors.transparent : backgroundColor,
        borderRadius: buttonBorderRadius,
        border: isOutlined
            ? Border.all(
                color: gradientColors?.first ?? backgroundColor ?? Color(0xFF6A3DE8),
                width: 2,
              )
            : null,
        boxShadow: !isOutlined && onPressed != null
            ? [
                BoxShadow(
                  color: (gradientColors?.first ?? backgroundColor ?? Color(0xFF6A3DE8))
                      .withValues(alpha: 0.3),
                  blurRadius: 15,
                  offset: Offset(0, 8),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: buttonBorderRadius,
          onTap: isLoading ? null : onPressed,
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isLoading) ...[
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        textColor ?? (isOutlined ? Color(0xFF6A3DE8) : Colors.white),
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                ],
                if (icon != null && !isLoading) ...[
                  Icon(
                    icon,
                    color: textColor ?? (isOutlined ? Color(0xFF6A3DE8) : Colors.white),
                    size: 20,
                  ),
                  SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    text,
                    style: TextStyle(
                      color: textColor ?? (isOutlined ? Color(0xFF6A3DE8) : Colors.white),
                      fontSize: fontSize,
                      fontWeight: fontWeight,
                    ),
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class FloatingActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final List<Color>? gradientColors;
  final double size;
  final Color? iconColor;

  const FloatingActionButton({
    Key? key,
    required this.icon,
    this.onPressed,
    this.gradientColors,
    this.size = 56,
    this.iconColor,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final defaultGradient = [Color(0xFF6A3DE8), Color(0xFF8B5CF6)];
    
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors ?? defaultGradient,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(size / 2),
        boxShadow: [
          BoxShadow(
            color: (gradientColors?.first ?? Color(0xFF6A3DE8)).withValues(alpha: 0.4),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(size / 2),
          onTap: onPressed,
          child: Icon(
            icon,
            color: iconColor ?? Colors.white,
            size: size * 0.4,
          ),
        ),
      ),
    );
  }
}