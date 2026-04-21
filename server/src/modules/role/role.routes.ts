import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
} from './role.validation';
import { RoleController } from './role.controller';

const router = Router();

router.use(authenticate);
router.use(requireAbility('manage', 'Role'));

router.get('/', RoleController.list);
router.get('/permissions', RoleController.listPermissions);
router.get('/:id', validateIdParam, RoleController.getById);
router.post('/', validate(createRoleSchema), RoleController.create);
router.put('/:id', validateIdParam, validate(updateRoleSchema), RoleController.update);
router.put(
  '/:id/permissions',
  validateIdParam,
  validate(updateRolePermissionsSchema),
  RoleController.updatePermissions,
);
router.delete('/:id', validateIdParam, RoleController.delete);

export default router;
