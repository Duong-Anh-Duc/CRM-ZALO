import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import logger from '../utils/logger';
import { t } from '../locales';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(err.message, { stack: err.stack });

  // App errors (thrown intentionally)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.');
      if (!errors[field]) errors[field] = [];
      errors[field].push(e.message);
    });

    res.status(422).json({
      success: false,
      message: err.errors[0]?.message || t('errors.validationFailed'),
      errors,
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const fields = (err.meta?.target as string[])?.join(', ') || 'field';
        res.status(409).json({
          success: false,
          message: t('errors.duplicateRecord', { fields }),
        });
        return;
      }
      case 'P2025':
        res.status(404).json({
          success: false,
          message: t('errors.recordNotFound'),
        });
        return;
      case 'P2003':
        res.status(400).json({
          success: false,
          message: t('errors.foreignKeyViolation'),
        });
        return;
      case 'P2014':
        res.status(400).json({
          success: false,
          message: t('errors.relationViolation'),
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: t('errors.databaseError'),
        });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: t('errors.invalidData'),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Database connection failed', { error: err.message });
    res.status(503).json({
      success: false,
      message: t('errors.serviceUnavailable'),
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    message: t('errors.serverError'),
  });
};
