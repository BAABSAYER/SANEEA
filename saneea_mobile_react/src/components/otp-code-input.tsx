import { createRef, useMemo } from "react";
import { TextInput, View } from "react-native";
import { colors } from "../theme/colors";

const OTP_LENGTH = 4;

type OtpCodeInputProps = {
  digits: string[];
  setDigits: (updater: (current: string[]) => string[]) => void;
};

export function OtpCodeInput({ digits, setDigits }: OtpCodeInputProps) {
  const inputs = useMemo(
    () => Array.from({ length: OTP_LENGTH }, () => createRef<TextInput>()),
    []
  );

  function updateDigits(text: string, index: number) {
    const clean = text.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((digit, digitIndex) => (digitIndex === index ? "" : digit)));
      return;
    }

    setDigits((current) => {
      const next = [...current];
      clean.slice(0, OTP_LENGTH - index).split("").forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });

    const nextIndex = Math.min(index + clean.length, OTP_LENGTH - 1);
    inputs[nextIndex]?.current?.focus();
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputs[index - 1]?.current?.focus();
    }
  }

  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={inputs[index]}
          value={digit}
          onChangeText={(text) => updateDigits(text, index)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          selectTextOnFocus
          textContentType="oneTimeCode"
          style={{
            backgroundColor: colors.surface,
            borderColor: digit ? colors.green : colors.line,
            borderRadius: 14,
            borderWidth: 1,
            color: colors.black,
            fontFamily: "Almarai-Bold",
            fontSize: 24,
            height: 58,
            textAlign: "center",
            writingDirection: "ltr",
            width: 58,
          }}
        />
      ))}
    </View>
  );
}

export function emptyOtpDigits(initialCode = "") {
  const digits = initialCode.slice(0, OTP_LENGTH).split("");
  return Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] || "");
}

export const OTP_CODE_LENGTH = OTP_LENGTH;
