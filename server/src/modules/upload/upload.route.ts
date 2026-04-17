import { Router, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../../types';
import { config } from '../../config';
import { uploadImage } from '../../lib/cloudinary';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/error.middleware';
import logger from '../../utils/logger';

const router = Router();
router.use(authenticate);

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

/**
 * POST /upload
 * Accept base64 data URL in body: { file: "data:image/png;base64,..." , folder?: "evidence" }
 * Returns: { url: "https://..." }
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { file, folder = 'general' } = req.body;
    if (!file || typeof file !== 'string') throw new AppError('File is required', 400);

    // Parse base64 data URL
    const match = file.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new AppError('Invalid file format. Expected base64 data URL.', 400);

    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate size (10MB max)
    if (buffer.length > config.upload.maxSize) {
      throw new AppError('File too large. Max 10MB.', 400);
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      throw new AppError('File type not allowed.', 400);
    }

    let url: string;

    // Try Cloudinary first
    if (config.cloudinary.cloudName && config.cloudinary.apiKey) {
      try {
        const result = await uploadImage(buffer, `packflow/${folder}`);
        url = result.secure_url;
      } catch (err) {
        logger.warn('Cloudinary upload failed, falling back to local:', err);
        url = await saveLocal(buffer, mimeType, folder);
      }
    } else {
      // Local storage fallback
      url = await saveLocal(buffer, mimeType, folder);
    }

    sendSuccess(res, { url });
  } catch (err) { next(err); }
});

async function saveLocal(buffer: Buffer, mimeType: string, folder: string): Promise<string> {
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(UPLOADS_DIR, folder);

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/${folder}/${filename}`;
}

export default router;
