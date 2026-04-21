import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { validateIdParam } from '../../middleware/validate.middleware';
import { CashBookController } from './cash-book.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireAbility('read', 'CashTransaction'), CashBookController.list);
router.get('/summary', requireAbility('read', 'CashTransaction'), CashBookController.getSummary);
router.post('/', requireAbility('create', 'CashTransaction'), CashBookController.create);
router.put('/:id', validateIdParam, requireAbility('update', 'CashTransaction'), CashBookController.update);
router.delete('/:id', validateIdParam, requireAbility('delete', 'CashTransaction'), CashBookController.delete);

// Categories
router.get('/categories', requireAbility('read', 'CashCategory'), CashBookController.listCategories);
router.post('/categories', requireAbility('manage', 'CashCategory'), CashBookController.createCategory);
router.put('/categories/:id', validateIdParam, requireAbility('manage', 'CashCategory'), CashBookController.updateCategory);

export default router;
