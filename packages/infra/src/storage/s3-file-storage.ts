import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { FileStorage } from "@ajh/core";

export interface S3Config {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Adapter: FileStorage on any S3-compatible service (SeaweedFS locally, S3/R2 in production). */
export class S3FileStorage implements FileStorage {
  private readonly client: S3Client;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: Boolean(config.endpoint), // self-hosted S3 servers use path-style URLs
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return res.Body.transformToByteArray();
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  /** Creates the bucket on first use (local dev); production buckets already exist. */
  private ensureBucket(): Promise<void> {
    this.bucketReady ??= this.client
      .send(new HeadBucketCommand({ Bucket: this.config.bucket }))
      .then(() => undefined)
      .catch(async () => {
        await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
      })
      .catch((err) => {
        this.bucketReady = null;
        throw err;
      });
    return this.bucketReady;
  }
}
