import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSupplierPriceSchema, updateSupplierPriceSchema } from './supplier-price.validation';
import { SupplierPriceController } from './supplier-price.controller';

const router = Router();
router.use(authenticate);

router.post('/', requireRole('ADMIN', 'STAFF'), validate(createSupplierPriceSchema), SupplierPriceController.create);
router.patch('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), validate(updateSupplierPriceSchema), SupplierPriceController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), SupplierPriceController.delete);

export default router;
