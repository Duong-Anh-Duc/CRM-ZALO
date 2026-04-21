import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './user.validation';
import { UserController } from './user.controller';

const router = Router();

router.use(authenticate);
router.get('/', requireAbility('read', 'User'), UserController.list);
router.post('/', requireAbility('create', 'User'), validate(createUserSchema), UserController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'User'), validate(updateUserSchema), UserController.update);
router.delete('/:id', validateIdParam, requireAbility('delete', 'User'), UserController.deactivate);

export default router;
