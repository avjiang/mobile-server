import express, { NextFunction, Request, Response } from "express"
import DeviceController from './device.controller';
import authorizeMiddleware from '../middleware/authorize-middleware';

const router = express.Router();

// Device management routes
router.post('/devices/register',
    authorizeMiddleware,
    DeviceController.registerDevice
);

router.delete('/devices/:deviceToken',
    authorizeMiddleware,
    DeviceController.unregisterDevice
);

router.get('/devices/user',
    authorizeMiddleware,
    DeviceController.getUserDevices
);

router.patch('/devices/:deviceToken/status',
    authorizeMiddleware,
    DeviceController.updateDeviceStatus
);

// Admin routes
router.get('/admin/devices/stats',
    authorizeMiddleware,
    DeviceController.getTenantDeviceStats
);

router.post('/admin/devices/purchase',
    authorizeMiddleware,
    DeviceController.purchaseAdditionalDevice
);

export = router;