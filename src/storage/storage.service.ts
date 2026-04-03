import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly publicClient: S3Client | null;
  private readonly bucketPrefix: string;

  private readonly buckets = ['room-images', 'furniture-images', 'generated-results'];

  constructor(private readonly config: ConfigService) {
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    const publicEndpoint = config.get<string>('S3_PUBLIC_ENDPOINT');
    const accessKeyId = config.getOrThrow<string>('S3_ACCESS_KEY');
    const secretAccessKey = config.getOrThrow<string>('S3_SECRET_KEY');
    const region = config.get<string>('S3_REGION', 'us-east-1');

    this.bucketPrefix = config.get<string>('S3_BUCKET_PREFIX', 'oberon');

    const credentials = { accessKeyId, secretAccessKey };

    this.client = new S3Client({
      endpoint,
      region,
      credentials,
      forcePathStyle: true,
    });

    this.publicClient = publicEndpoint
      ? new S3Client({
          endpoint: publicEndpoint,
          region,
          credentials,
          forcePathStyle: true,
        })
      : null;
  }

  private getBucketName(bucket: string): string {
    return `${this.bucketPrefix}-${bucket}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      for (const bucket of this.buckets) {
        const bucketName = this.getBucketName(bucket);
        try {
          await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
          this.logger.log(`Бакет создан: ${bucketName}`);
        } catch (err: unknown) {
          const name = (err as { name?: string }).name;
          if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') {
            this.logger.log(`Бакет уже существует: ${bucketName}`);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        'S3/MinIO недоступен — бакеты не созданы. Загрузка файлов не будет работать до подключения к хранилищу.',
      );
      this.logger.warn(String(err));
    }
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );

    const stream = response.Body as Readable;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(bucket: string, key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      }),
    );
  }

  async getPresignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
    });
    return getSignedUrl(this.publicClient ?? this.client, command, { expiresIn });
  }
}
