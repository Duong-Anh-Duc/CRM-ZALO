import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { upsertCustomerProductPriceSchema } from './customer-product-price.validation';
import { CustomerProductPriceController } from './customer-product-price.controller';

const router = Router();
router.use(authenticate);

router.get('/', CustomerProductPriceController.listByCustomer);
router.post('/', requireRole('ADMIN', 'STAFF'), validate(upsertCustomerProductPriceSchema), CustomerProductPriceController.upsert);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), CustomerProductPriceController.delete);

export default router;
