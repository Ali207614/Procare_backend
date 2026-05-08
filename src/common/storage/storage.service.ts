import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'procare-uploads');

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const bucketExists = await this.client.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.client.makeBucket(this.bucketName);
        this.logger.log(`Bucket "${this.bucketName}" created successfully.`);
      }
    } catch (error) {
      this.logger.error(`Error checking/creating bucket "${this.bucketName}":`, error);
    }
  }

  /**
   * Uploads a file to MinIO
   * @param path The path where the file will be stored
   * @param file The file buffer
   * @param metadata Optional metadata
   */
  async upload(
    path: string,
    file: Buffer,
    metadata: Record<string, string | number> = {},
  ): Promise<string> {
    try {
      await this.client.putObject(this.bucketName, path, file, file.length, metadata);
      return path;
    } catch (error) {
      this.logger.error(`Error uploading file to "${path}":`, error);
      throw error;
    }
  }

  /**
   * Deletes a file from MinIO
   * @param path The path of the file to delete
   */
  async delete(path: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, path);
    } catch (error) {
      this.logger.error(`Error deleting file from "${path}":`, error);
      throw error;
    }
  }

  /**
   * Lists files in MinIO matching a prefix
   * @param prefix The prefix to search for
   */
  async listFiles(prefix: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const objects: string[] = [];
      const stream = this.client.listObjectsV2(this.bucketName, prefix, true);

      stream.on('data', (obj) => {
        if (obj.name) {
          objects.push(obj.name);
        }
      });

      stream.on('error', (error) => {
        this.logger.error(`Error listing files with prefix "${prefix}":`, error);
        reject(error);
      });

      stream.on('end', () => {
        resolve(objects);
      });
    });
  }

  /**
   * Generates URLs for variants of an image
   * @param basePath The base path (without size suffix)
   * @param extension The file extension
   */
  async getMultipleUrls(basePath: string, extension: string): Promise<Record<string, string>> {
    const sizes = ['small', 'medium', 'large'];
    const urls: Record<string, string> = {};

    for (const size of sizes) {
      const path = `${basePath}-${size}.${extension}`;
      urls[size] = await this.generateUrl(path);
    }

    return urls;
  }

  /**
   * Generates a temporary URL for a file (presigned URL)
   * @param path The path of the file
   * @param expiry Expiry time in seconds (default 1 hour)
   */
  async generateUrl(path: string, expiry: number = 3600): Promise<string> {
    try {
      return await this.client.presignedGetObject(this.bucketName, path, expiry);
    } catch (error) {
      this.logger.error(`Error generating presigned URL for "${path}":`, error);
      throw error;
    }
  }
}
