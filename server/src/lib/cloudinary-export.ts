import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';
import logger from '../utils/logger';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});

/**
 * Upload an Excel/PDF buffer to Cloudinary as a RAW resource so it can be
 * downloaded via a public URL. Used for chatbot-triggered exports.
 * Returns the secure_url (https) that browsers can open directly.
 */
export async function uploadExport(
  fileBuffer: Buffer,
  filename: string,
  folder: string = 'packflow/exports',
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use full filename (with extension) as public_id so the resulting URL keeps .xlsx/.pdf
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: 'raw',
          public_id: filename,
          use_filename: false,
          unique_filename: false,
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            logger.error('Cloudinary export upload failed:', error);
            reject(error || new Error('Upload failed'));
          } else {
            resolve(result.secure_url);
          }
        },
      )
      .end(fileBuffer);
  });
}
