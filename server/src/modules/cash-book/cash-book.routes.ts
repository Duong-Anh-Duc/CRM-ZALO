import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validateIdParam } from '../../middleware/validate.middleware';
import { CashBookController } from './cash-book.controller';

const router = Router();
router.use(authenticate);

router.get('/', CashBookController.list);
router.get('/summary', CashBookController.getSummary);
router.post('/', requireRole('ADMIN', 'STAFF'), CashBookController.create);
router.put('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), CashBookController.update);
router.delete('/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), CashBookController.delete);

// Categories
router.get('/categories', CashBookController.listCategories);
router.post('/categories', requireRole('ADMIN', 'STAFF'), CashBookController.createCategory);
router.put('/categories/:id', validateIdParam, requireRole('ADMIN', 'STAFF'), CashBookController.updateCategory);

export default router;
