import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate, validateIdParam } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './user.validation';
import { UserController } from './user.controller';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('ADMIN'), UserController.list);
router.post('/', requireRole('ADMIN'), validate(createUserSchema), UserController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN'), validate(updateUserSchema), UserController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN'), UserController.deactivate);

export default router;
