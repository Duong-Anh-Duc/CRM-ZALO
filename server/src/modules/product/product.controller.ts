import { Response, NextFunction } from 'express';
import dayjs from 'dayjs';
import { AuthenticatedRequest } from '../../types';
import { ProductService } from './product.service';
import { t } from '../../locales';
import { sendSuccess, sendCreated, sendPaginated, sendMessage, buildContentDisposition } from '../../utils/response';

export class ProductController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Special: return categories list
      if (req.query.type === 'categories') {
        const categories = await ProductService.listCategories();
        return sendSuccess(res, categories);
      }
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

  static async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query as {
        search?: string;
        category_id?: string;
        material?: string;
        is_active?: string | boolean;
      };
      const is_active = q.is_active === undefined
        ? undefined
        : q.is_active === 'true' || q.is_active === true
          ? true
          : q.is_active === 'false' || q.is_active === false
            ? false
            : undefined;
      const buf = await ProductService.exportExcel({
        search: q.search,
        category_id: q.category_id,
        material: q.material,
        is_active,
      });
      const filename = `danh-sach-san-pham-${dayjs().format('YYYYMMDD')}.xlsx`;
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': buildContentDisposition('attachment', filename),
        'Content-Length': buf.length.toString(),
      });
      res.send(buf);
    } catch (err) {
      next(err);
    }
  }
}
