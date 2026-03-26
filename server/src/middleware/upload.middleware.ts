import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { t } from '../locales';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(t('upload.invalidFileType')));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize,
    files: config.upload.maxFiles,
  },
});

export const uploadImages = upload.array('images', config.upload.maxFiles);

export const uploadSingle = upload.single('image');

export function handleMulterError(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, message: t('upload.fileTooLarge') });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ success: false, message: t('upload.tooManyFiles') });
      return;
    }
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  if (err.message === t('upload.invalidFileType')) {
    res.status(400).json({ success: false, message: err.message });
    return;
  }
  next(err);
}
