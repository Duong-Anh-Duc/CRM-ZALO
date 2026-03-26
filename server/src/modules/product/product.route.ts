import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { cache } from '../../middleware/cache.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { uploadImages, handleMulterError } from '../../middleware/upload.middleware';
import { createProductSchema, updateProductSchema } from './product.validation';
import { ProductController } from './product.controller';

const router = Router();

router.use(authenticate);

// Product CRUD
router.get('/', cache(60), ProductController.list);
router.get('/:id', validateIdParam, cache(60), ProductController.getById);
router.get('/:id/compatible-caps', validateIdParam, cache(120), ProductController.getCompatibleCaps);
router.post('/', requireRole('ADMIN', 'STAFF'), uploadImages, handleMulterError, ProductController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateProductSchema), ProductController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), ProductController.softDelete);

// Product Images
router.post('/:id/images', validateIdParam, requireRole('ADMIN', 'STAFF'), uploadImages, handleMulterError, ProductController.uploadImages);
router.delete('/:id/images/:imageId', validateIdParam, requireRole('ADMIN', 'STAFF'), ProductController.deleteImage);
router.patch('/:id/images/:imageId/primary', validateIdParam, requireRole('ADMIN', 'STAFF'), ProductController.setPrimaryImage);

export default router;
