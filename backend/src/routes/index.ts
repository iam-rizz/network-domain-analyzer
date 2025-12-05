/**
 * Routes Index
 * Exports all route modules
 */

import { Router } from 'express';
import dnsRoutes from './dns.routes';
import rdapRoutes from './rdap.routes';
import whoisRoutes from './whois.routes';
import hostRoutes from './host.routes';
import ipRoutes from './ip.routes';
import batchRoutes from './batch.routes';
import historyRoutes from './history.routes';

const router = Router();

// Mount all routes
router.use('/dns', dnsRoutes);
router.use('/rdap', rdapRoutes);
router.use('/whois', whoisRoutes);
router.use('/host', hostRoutes);
router.use('/ip', ipRoutes);
router.use('/batch', batchRoutes);
router.use('/history', historyRoutes);

export default router;
