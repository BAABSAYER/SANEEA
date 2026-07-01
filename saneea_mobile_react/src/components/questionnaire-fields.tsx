import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { QuestionnaireItem } from "../api/mobile";
import { colors, radius } from "../theme/colors";
import { Field, Surface } from "./ui";

type Choice = {
  value: string;
  label: string;
  imageUrl?: string | null;
};

type QuestionnaireFieldsProps = {
  questions: QuestionnaireItem[];
  responses: Record<string, unknown>;
  onChange: (questionId: number, value: unknown) => void;
};

function normalizeChoices(options: unknown, language: string): Choice[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, label: option };
      }
      if (option && typeof option === "object") {
        const value = String((option as any).value || (option as any).id || (option as any).label || "");
        const label =
          language === "ar"
            ? (option as any).labelAr || (option as any).label || (option as any).labelEn || value
            : (option as any).labelEn || (option as any).label || (option as any).labelAr || value;
        return {
          value,
          label: String(label),
          imageUrl: (option as any).imageUrl || (option as any).image || null,
        };
      }
      return null;
    })
    .filter(Boolean) as Choice[];
}

function isMultiChoice(questionType: string) {
  return ["multiple_choice", "multi_choice", "checkbox", "checkboxes"].includes(questionType);
}

function isChoiceQuestion(questionType: string) {
  return ["single_choice", "select", "radio", "multiple_choice", "multi_choice", "checkbox", "checkboxes"].includes(questionType);
}

export function QuestionnaireFields({ questions, responses, onChange }: QuestionnaireFieldsProps) {
  const { i18n, t } = useTranslation();

  if (questions.length === 0) {
    return <Text style={styles.muted}>{t("noQuestions")}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {questions.map((question, index) => {
        const questionType = String(question.questionType || "text");
        const choices = normalizeChoices(question.options, i18n.language);
        const value = responses[String(question.id)];
        const selectedValues = Array.isArray(value) ? value.map(String) : [];

        if (isChoiceQuestion(questionType) && choices.length > 0) {
          const multiple = isMultiChoice(questionType);
          return (
            <Surface key={question.id}>
              <View style={styles.questionHeader}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepText}>{index + 1}</Text>
                </View>
                <View style={styles.questionCopy}>
                  <Text style={styles.question}>{question.questionText}</Text>
                  <Text style={styles.hint}>{multiple ? t("chooseOneOrMore", { defaultValue: "Choose one or more" }) : t("chooseOne", { defaultValue: "Choose one" })}</Text>
                </View>
              </View>
              <View style={styles.choices}>
                {choices.map((choice) => {
                  const active = multiple ? selectedValues.includes(choice.value) : String(value || "") === choice.value;
                  return (
                    <Pressable
                      key={choice.value}
                      onPress={() => {
                        if (!multiple) {
                          onChange(question.id, choice.value);
                          return;
                        }
                        const next = active
                          ? selectedValues.filter((item) => item !== choice.value)
                          : [...selectedValues, choice.value];
                        onChange(question.id, next);
                      }}
                      style={[styles.choice, active && styles.choiceActive]}
                    >
                      {choice.imageUrl ? <Image source={{ uri: choice.imageUrl }} style={styles.choiceImage} /> : null}
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice.label}</Text>
                      {active ? <Text style={styles.selectedText}>{t("selected")}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Surface>
          );
        }

        return (
          <View key={question.id} style={styles.textQuestion}>
            <Field
              label={question.questionText}
              value={String(value || "")}
              onChangeText={(nextValue) => onChange(question.id, nextValue)}
              keyboardType={questionType === "number" ? "number-pad" : "default"}
              multiline={questionType === "textarea"}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  questionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  stepText: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 15,
  },
  questionCopy: {
    flex: 1,
    gap: 4,
  },
  question: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 16,
    lineHeight: 24,
  },
  hint: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 12,
  },
  choices: {
    gap: 9,
    marginTop: 12,
  },
  choice: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    padding: 10,
  },
  choiceActive: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  choiceImage: {
    backgroundColor: colors.line,
    borderRadius: radius.sm,
    height: 44,
    width: 58,
  },
  choiceText: {
    color: colors.ink,
    flex: 1,
    fontFamily: "Almarai-Bold",
    fontSize: 15,
    lineHeight: 22,
  },
  choiceTextActive: {
    color: colors.green,
  },
  selectedText: {
    color: colors.green,
    fontFamily: "Almarai-Bold",
    fontSize: 12,
  },
  textQuestion: {
    gap: 8,
  },
  muted: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 13,
  },
});
