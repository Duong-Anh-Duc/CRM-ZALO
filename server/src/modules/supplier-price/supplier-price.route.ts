import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSupplierPriceSchema, updateSupplierPriceSchema } from './supplier-price.validation';
import { SupplierPriceController } from './supplier-price.controller';

const router = Router();
router.use(authenticate);

router.post('/', requireAbility('manage', 'SupplierPrice'), validate(createSupplierPriceSchema), SupplierPriceController.create);
router.patch('/:id', validateIdParam, requireAbility('manage', 'SupplierPrice'), validate(updateSupplierPriceSchema), SupplierPriceController.update);
router.delete('/:id', validateIdParam, requireAbility('manage', 'SupplierPrice'), SupplierPriceController.delete);

export default router;
