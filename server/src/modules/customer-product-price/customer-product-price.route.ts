import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { upsertCustomerProductPriceSchema } from './customer-product-price.validation';
import { CustomerProductPriceController } from './customer-product-price.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('manage', 'CustomerProductPrice'), CustomerProductPriceController.listByCustomer);
router.post('/', requireAbility('manage', 'CustomerProductPrice'), validate(upsertCustomerProductPriceSchema), CustomerProductPriceController.upsert);
router.delete('/:id', validateIdParam, requireAbility('manage', 'CustomerProductPrice'), CustomerProductPriceController.delete);

export default router;
