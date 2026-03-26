import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ProductService } from './product.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage } from '../../utils/response';

export class ProductController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ProductService.list(req.query as never);
      sendPaginated(res, result.products, { total: result.total, page: result.page, limit: result.limit });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getById(req.params.id as string);
      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      const product = await ProductService.create(req.body, files);
      sendCreated(res, product);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.update(req.params.id as string, req.body);
      sendSuccess(res, product);
    } catch (err) {
      next(err);
    }
  }

  static async softDelete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await ProductService.softDelete(req.params.id as string);
      sendMessage(res, t('product.deleted'));
    } catch (err) {
      next(err);
    }
  }

  static async getCompatibleCaps(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const caps = await ProductService.getCompatibleCaps(req.params.id as string);
      sendSuccess(res, caps);
    } catch (err) {
      next(err);
    }
  }

  static async uploadImages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) {
        res.status(400).json({ success: false, message: t('upload.uploadFailed') });
        return;
      }
      const images = await ProductService.uploadImages(req.params.id as string, files);
      sendCreated(res, images);
    } catch (err) {
      next(err);
    }
  }

  static async deleteImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await ProductService.deleteImage(req.params.id as string, req.params.imageId as string);
      sendMessage(res, t('upload.deleteSuccess'));
    } catch (err) {
      next(err);
    }
  }

  static async setPrimaryImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const image = await ProductService.setPrimaryImage(req.params.id as string, req.params.imageId as string);
      sendSuccess(res, image);
    } catch (err) {
      next(err);
    }
  }
}
