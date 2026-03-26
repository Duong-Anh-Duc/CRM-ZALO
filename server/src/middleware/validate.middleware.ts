import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { z } from 'zod';
import { t } from '../locales';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        err.errors.forEach((e) => {
          const field = e.path.join('.');
          if (!errors[field]) errors[field] = [];
          errors[field].push(e.message);
        });

        res.status(422).json({
          success: false,
          message: err.errors[0]?.message || 'Validation failed',
          errors,
        });
        return;
      }
      next(err);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: err.errors[0]?.message || 'Invalid query parameters',
        });
        return;
      }
      next(err);
    }
  };
}

const idParamSchema = z.object({
  id: z.string().min(1, t('validation.idRequired')),
});

export function validateIdParam(req: Request, res: Response, next: NextFunction): void {
  try {
    idParamSchema.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({
        success: false,
        message: t('validation.invalidId'),
      });
      return;
    }
    next(err);
  }
}
