import crypto from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ImageUploadIntent = {
  provider: "s3";
  bucket: string;
  key: string;
  publicUrl: string;
  uploadUrl: string | null;
  headers: Record<string, string>;
};

export interface MediaGateway {
  createImageUploadIntent(input: {
    folder: string;
    filename: string;
    contentType: string;
  }): Promise<ImageUploadIntent>;
}

class S3MediaGateway implements MediaGateway {
  private getClient(region: string) {
    return new S3Client({ region });
  }

  async createImageUploadIntent(input: {
    folder: string;
    filename: string;
    contentType: string;
  }): Promise<ImageUploadIntent> {
    const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || "";
    const region = process.env.AWS_REGION || process.env.S3_REGION || "us-east-1";
    const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : "");
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const folder = input.folder.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/^\/+|\/+$/g, "");
    const key = `${folder}/${crypto.randomUUID()}-${safeName}`;
    let uploadUrl: string | null = null;

    if (bucket) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: input.contentType,
      });
      uploadUrl = await getSignedUrl(this.getClient(region), command, { expiresIn: 3600 });
    }

    return {
      provider: "s3",
      bucket,
      key,
      publicUrl: publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/${key}` : key,
      uploadUrl,
      headers: {
        "Content-Type": input.contentType,
      },
    };
  }
}

export const mediaGateway: MediaGateway = new S3MediaGateway();
