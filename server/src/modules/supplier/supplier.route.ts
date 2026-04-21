import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createSupplierSchema, updateSupplierSchema } from './supplier.validation';
import { SupplierController } from './supplier.controller';

const router = Router();

router.use(authenticate);
router.get('/', requireAbility('read', 'Supplier'), SupplierController.list);
router.get('/:id', validateIdParam, requireAbility('read', 'Supplier'), SupplierController.getById);
router.post('/', requireAbility('create', 'Supplier'), validate(createSupplierSchema), SupplierController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'Supplier'), validate(updateSupplierSchema), SupplierController.update);
router.delete('/:id', validateIdParam, requireAbility('delete', 'Supplier'), SupplierController.softDelete);

export default router;
