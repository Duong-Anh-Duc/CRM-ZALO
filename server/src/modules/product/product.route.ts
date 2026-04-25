import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { cache } from '../../middleware/cache.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { uploadImages, handleMulterError } from '../../middleware/upload.middleware';
import { createProductSchema, updateProductSchema } from './product.validation';
import { ProductController } from './product.controller';

const router = Router();

router.use(authenticate);

// Product CRUD
router.get('/', requireAbility('read', 'Product'), cache(60), ProductController.list);
router.get('/export-excel', requireAbility('read', 'Product'), ProductController.exportExcel);
router.get('/:id', validateIdParam, requireAbility('read', 'Product'), cache(60), ProductController.getById);
router.post('/', requireAbility('create', 'Product'), uploadImages, handleMulterError, ProductController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'Product'), validate(updateProductSchema), ProductController.update);
router.delete('/:id', validateIdParam, requireAbility('delete', 'Product'), ProductController.softDelete);

// Product Images
router.post('/:id/images', validateIdParam, requireAbility('manage', 'ProductImage'), uploadImages, handleMulterError, ProductController.uploadImages);
router.delete('/:id/images/:imageId', validateIdParam, requireAbility('manage', 'ProductImage'), ProductController.deleteImage);
router.patch('/:id/images/:imageId/primary', validateIdParam, requireAbility('manage', 'ProductImage'), ProductController.setPrimaryImage);

export default router;
