import { Injectable } from '@nestjs/common';
import cloudinary from 'cloudinary';
import { formatImage } from '../utils/images/multer';

export interface UploadedFileResult {
  url: string;
  public_id: string;
}

@Injectable()
export class UploadService {
  async uploadSingle(
    file?: Express.Multer.File,
    folder = 'easystore',
  ): Promise<UploadedFileResult | null> {
    if (!file) return null;

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
  }

  async uploadMultiple(
    files?: Express.Multer.File[],
    folder = 'easystore',
  ): Promise<UploadedFileResult[]> {
    if (!files || files.length === 0) return [];

    const result: UploadedFileResult[] = [];

    for (const file of files) {
      const fileStr = formatImage(file);

      const uploaded = await cloudinary.v2.uploader.upload(fileStr, {
        folder,
        resource_type: 'auto',
        use_filename: true,
      });

      result.push({
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    return result;
  }

  async deleteSingle(public_id?: string) {
    if (!public_id) return;
    await cloudinary.v2.uploader.destroy(public_id);
  }

  async deleteMultiple(items?: { public_id: string }[] | null) {
    if (!items || items.length === 0) return;

    for (const item of items) {
      await cloudinary.v2.uploader.destroy(item.public_id);
    }
  }
}
