import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import * as cases from '../controllers/case.controller';
import * as clients from '../controllers/client.controller';
import * as contracts from '../controllers/contract.controller';
import * as documents from '../controllers/document.controller';
import * as hearings from '../controllers/hearing.controller';
import * as invoices from '../controllers/invoice.controller';
import * as notifications from '../controllers/notification.controller';
import * as system from '../controllers/system.controller';
import * as users from '../controllers/user.controller';
import { authenticate, authorize } from '../middleware/auth';
import { authLimiter, refreshLimiter } from '../middleware/rate-limit';
import { upload } from '../middleware/upload';

const managers = authorize('ADMIN', 'LAWYER');
const adminOnly = authorize('ADMIN');

function authRoutes() {
  const router = Router();
  router.post('/register', authLimiter, auth.register);
  router.post('/login', authLimiter, auth.login);
  router.post('/refresh', refreshLimiter, auth.refresh);
  router.post('/logout', auth.logout);
  router.post('/forgot-password', authLimiter, auth.forgotPassword);
  router.post('/reset-password', authLimiter, auth.resetPassword);
  router.get('/me', authenticate, auth.me);
  router.put('/profile', authenticate, auth.updateProfile);
  router.put('/password', authenticate, authLimiter, auth.changePassword);
  return router;
}

function userRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/lookup', managers, users.lookup);
  router.get('/', adminOnly, users.list);
  router.post('/', adminOnly, users.create);
  router.get('/:id', adminOnly, users.get);
  router.put('/:id', adminOnly, users.update);
  return router;
}

function clientRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', clients.list);
  router.post('/', managers, clients.create);
  router.get('/:id', clients.get);
  router.get('/:id/timeline', clients.timeline);
  router.put('/:id', managers, clients.update);
  router.delete('/:id', managers, clients.remove);
  router.post('/:id/restore', managers, clients.restore);
  return router;
}

function caseRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', cases.list);
  router.post('/', managers, cases.create);
  router.get('/:id', cases.get);
  router.get('/:id/timeline', cases.timeline);
  router.put('/:id', managers, cases.update);
  router.post('/:id/close', managers, cases.close);
  router.post('/:id/reopen', managers, cases.reopen);
  router.delete('/:id', managers, cases.remove);
  return router;
}

function hearingRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', hearings.list);
  router.post('/', hearings.create);
  router.get('/:id', hearings.get);
  router.put('/:id', hearings.update);
  router.post('/:id/complete', hearings.complete);
  router.delete('/:id', hearings.remove);
  return router;
}

function documentRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', documents.list);
  router.post('/', upload.single('file'), documents.upload);
  router.get('/:id', documents.get);
  router.get('/:id/download', documents.download);
  router.patch('/:id', documents.update);
  router.delete('/:id', documents.remove);
  return router;
}

function contractRoutes() {
  const router = Router();
  router.use(authenticate, managers);
  router.get('/', contracts.list);
  router.post('/', contracts.create);
  router.get('/:id', contracts.get);
  router.put('/:id', contracts.update);
  router.delete('/:id', contracts.remove);
  return router;
}

function invoiceRoutes() {
  const router = Router();
  router.use(authenticate, managers);
  router.get('/', invoices.list);
  router.post('/', invoices.create);
  router.get('/:id', invoices.get);
  router.put('/:id', invoices.update);
  router.post('/:id/pay', invoices.pay);
  router.post('/:id/cancel', invoices.cancel);
  router.delete('/:id', invoices.remove);
  return router;
}

function notificationRoutes() {
  const router = Router();
  router.use(authenticate);
  router.get('/', notifications.list);
  router.get('/unread-count', notifications.unreadCount);
  router.patch('/read-all', notifications.markAllRead);
  router.patch('/:id/read', notifications.markRead);
  router.delete('/:id', notifications.remove);
  return router;
}

export function apiRouter(): Router {
  const router = Router();
  router.use('/auth', authRoutes());
  router.use('/users', userRoutes());
  router.use('/clients', clientRoutes());
  router.use('/cases', caseRoutes());
  router.use('/hearings', hearingRoutes());
  router.use('/documents', documentRoutes());
  router.use('/contracts', contractRoutes());
  router.use('/invoices', invoiceRoutes());
  router.use('/notifications', notificationRoutes());
  router.get('/dashboard/stats', authenticate, system.dashboard);
  router.get('/reports', authenticate, managers, system.reports);
  router.get('/settings', authenticate, system.readSettings);
  router.put('/settings', authenticate, adminOnly, system.writeSettings);
  router.post('/admin/jobs/reminders', authenticate, adminOnly, system.triggerReminders);
  return router;
}
