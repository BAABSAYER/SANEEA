import * as ImagePicker from "expo-image-picker";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { uploadMobileFile } from "../api/mobile";
import { Button, Surface } from "./ui";
import { colors } from "../theme/colors";

export type MobileAttachment = {
  url: string;
  fileName?: string | null;
  contentType?: string | null;
};

function filenameFromUri(uri: string, contentType?: string | null) {
  const pathName = uri.split("?")[0]?.split("/").pop();
  if (pathName && pathName.includes(".")) return pathName;
  const extension = contentType?.includes("png") ? "png" : contentType?.includes("webp") ? "webp" : "jpg";
  return `attachment-${Date.now()}.${extension}`;
}

export function AttachmentPicker({
  value,
  onChange,
}: {
  value: MobileAttachment[];
  onChange: (attachments: MobileAttachment[]) => void;
}) {
  const { t } = useTranslation();

  async function addAttachment() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("cameraPermissionRequired"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled) return;

    try {
      const uploaded = [];
      for (const asset of result.assets) {
        const contentType = asset.mimeType || "image/jpeg";
        uploaded.push(await uploadMobileFile({
          uri: asset.uri,
          filename: asset.fileName || filenameFromUri(asset.uri, contentType),
          contentType,
          folder: "saneea/booking-attachments",
        }));
      }
      onChange([...value, ...uploaded]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "uploadAttachmentFailed";
      Alert.alert(t(message) || t("uploadAttachmentFailed"));
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Button title={t("addAttachment")} variant="ghost" onPress={addAttachment} />
      {value.length > 0 ? (
        <Surface>
          <Text style={styles.title}>{t("attachmentSelected")}</Text>
          {value.map((attachment, index) => (
            <Text key={`${attachment.url}-${index}`} style={styles.item}>
              {attachment.fileName || attachment.url}
            </Text>
          ))}
        </Surface>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.black,
    fontFamily: "Almarai-Bold",
    fontSize: 14,
    marginBottom: 6,
  },
  item: {
    color: colors.muted,
    fontFamily: "Almarai-Regular",
    fontSize: 12,
    lineHeight: 20,
  },
});
