const express = require('express');

const router = express.Router();

const resourceController = require('../controllers/resource');
const isAuth = require('../middleware/is-auth');
const optionalAuth = require('../middleware/optional-auth');

router.get('/invoices/:filename', resourceController.getFile);

router.get('/search', optionalAuth, resourceController.getSearch);
router.get('/resources/:resourceId', optionalAuth, resourceController.getResource);

router.get('/borrow', isAuth, resourceController.getBorrow);
router.post('/borrow', isAuth, resourceController.postBorrow);
router.get('/checkout', isAuth, resourceController.getCheckout);
router.get('/checkout/success', isAuth, resourceController.getCheckoutSuccess);

router.get('/borrow-history', isAuth, resourceController.getBorrowedHistory);
router.get('/borrow-history/:borrowHistoryId', isAuth, resourceController.getInvoice);

module.exports = router;