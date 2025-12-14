import { BadRequestException, Injectable } from '@nestjs/common';
import cloudinary from 'cloudinary';
import { formatImage } from '../utils/images/multer';

export interface UploadedFileResult {
  url: string;
  public_id: string;
}

@Injectable()
export class UploadService {
  async uploadSingle(
    file: Express.Multer.File,
    folder = 'easystore',
  ): Promise<UploadedFileResult> {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    try {
      const fileStr = formatImage(file);

      const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
        folder,
        resource_type: 'auto',
        use_filename: true,
      });

      return {
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      };
    } catch {
      throw new BadRequestException('File upload failed');
    }
  }

  /**
   * Upload multiple files concurrently
   * Rolls back if ANY upload fails
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    folder = 'easystore',
  ): Promise<UploadedFileResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided for upload');
    }

    const results = await Promise.allSettled(
      files.map((file) => this.uploadSingle(file, folder)),
    );

    const successful = results
      .filter(
        (r): r is PromiseFulfilledResult<UploadedFileResult> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);

    const failed = results.some((r) => r.status === 'rejected');

    // 🔥 rollback if any failed
    if (failed) {
      await this.deleteMultiple(successful);
      throw new BadRequestException('One or more gallery uploads failed');
    }

    return successful;
  }

  async deleteSingle(public_id?: string) {
    if (!public_id) return;
    await cloudinary.v2.uploader.destroy(public_id);
  }

  async deleteMultiple(items?: { public_id: string }[] | null) {
    if (!items || items.length === 0) return;

    await Promise.all(
      items.map((item) => cloudinary.v2.uploader.destroy(item.public_id)),
    );
  }
}
