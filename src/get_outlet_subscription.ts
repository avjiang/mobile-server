// import { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/client';
// import { StatusCodes } from 'http-status-codes';

// // Global Prisma client for TENANT schema
// const globalPrisma = new PrismaClient();

// // Interface for API response structure
// interface OutletDetailsResponse {
//   outletId: number;
//   outletName: string;
//   isActive: boolean;
//   subscription: {
//     planName: string;
//     basePlanCost: number;
//     addOns: Array<{
//       name: string;
//       quantity: number;
//       pricePerUnit: number;
//       totalCost: number;
//     }>;
//     discounts: Array<{
//       name: string;
//       type: string;
//       value: number;
//       amount: number;
//     }>;
//     totalCost: number;
//     totalCostBeforeDiscount: number;
//     totalDiscount: number;
//     status: string;
//     subscriptionValidUntil: string;
//   } | null;
// }

// // Get details for a specific outlet
// export const getOutletDetails = async (req: Request, res: Response) => {
//   try {
//     const { outletId } = req.params;
//     const outletIdNum = parseInt(outletId, 10);

//     // Assume tenantId from user auth (replace with your auth middleware)
//     const tenantId = parseInt(req.query.tenantId as string || (req as any).user?.tenantId, 10);

//     if (isNaN(outletIdNum) || isNaN(tenantId)) {
//       return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid outlet ID or tenant ID' });
//     }

//     // Fetch outlet from global DB
//     const outlet = await globalPrisma.outlet.findUnique({
//       where: { id: outletIdNum },
//       include: {
//         tenant: { select: { id: true } },
//         subscriptions: {
//           where: { status: { in: ['active', 'trial'] } },
//           include: {
//             subscriptionPlan: { select: { planName: true, price: true } },
//             discount: true,
//             subscriptionAddOn: {
//               include: { addOn: { select: { name: true, pricePerUnit: true } } },
//             },
//           },
//         },
//       },
//     });

//     if (!outlet || outlet.tenant.id !== tenantId) {
//       return res.status(StatusCodes.NOT_FOUND).json({ error: 'Outlet not found or unauthorized' });
//     }

//     const subscription = outlet.subscriptions[0];
//     const response: OutletDetailsResponse = {
//       outletId: outlet.id,
//       outletName: outlet.outletName,
//       isActive: outlet.isActive,
//       subscription: null,
//     };

//     if (subscription) {
//       const basePlanCost = subscription.subscriptionPlan.price;
//       const addOns = subscription.subscriptionAddOn.map(({ addOn, quantity }) => ({
//         name: addOn.name,
//         quantity,
//         pricePerUnit: addOn.pricePerUnit,
//         totalCost: addOn.pricePerUnit * quantity,
//       }));

//       // Calculate discounts
//       const discounts: Array<{ name: string; type: string; value: number; amount: number }> = [];
//       let discountAmount = 0;

//       // Promotional discount (percentage)
//       if (
//         subscription.discount &&
//         subscription.discount.discountType === 'percentage' &&
//         (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
//       ) {
//         const discountValue = subscription.discount.value / 100;
//         const appliesToPlan = subscription.discount.appliesTo.includes('plan');
//         const appliesToAddOns = subscription.discount.appliesTo.includes('add-on');

//         const planDiscount = appliesToPlan ? basePlanCost * discountValue : 0;
//         const addOnDiscount = appliesToAddOns
//           ? addOns.reduce((sum, addOn) => sum + addOn.totalCost * discountValue, 0)
//           : 0;

//         discountAmount = planDiscount + addOnDiscount;
//         discounts.push({
//           name: subscription.discount.name,
//           type: subscription.discount.discountType,
//           value: subscription.discount.value,
//           amount: discountAmount,
//         });
//       }

//       // Fixed discount (apply if first eligible subscription)
//       let fixedDiscountAmount = 0;
//       const tenantSubscriptions = await globalPrisma.tenantSubscription.findMany({
//         where: {
//           outlet: { tenantId, isActive: true },
//           status: { in: ['active', 'trial'] },
//           discount: { discountType: 'fixed', endDate: { gte: new Date(), isSet: true } },
//         },
//         include: { discount: true },
//         orderBy: { id: 'asc' }, // Assume first subscription gets fixed discount
//       });

//       const firstFixedDiscount = tenantSubscriptions.find(
//         sub => sub.discount?.discountType === 'fixed' && (!sub.discount.endDate || new Date() <= sub.discount.endDate)
//       );

//       if (firstFixedDiscount && firstFixedDiscount.outletId === outletIdNum) {
//         const discount = firstFixedDiscount.discount!;
//         fixedDiscountAmount = Math.min(
//           discount.value,
//           basePlanCost + addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0)
//         );
//         discounts.push({
//           name: discount.name,
//           type: discount.discountType,
//           value: fixedDiscountAmount,
//           amount: fixedDiscountAmount,
//         });
//         discountAmount += fixedDiscountAmount;
//       }

//       // Total cost for this outlet
//       const totalAddOnCost = addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0);
//       const totalCostBeforeDiscount = basePlanCost + totalAddOnCost;
//       const totalCost = Math.max(0, totalCostBeforeDiscount - discountAmount);

//       response.subscription = {
//         planName: subscription.subscriptionPlan.planName,
//         basePlanCost,
//         addOns,
//         discounts,
//         totalCost,
//         totalCostBeforeDiscount,
//         totalDiscount: discountAmount,
//         status: subscription.status,
//         subscriptionValidUntil: subscription.subscriptionValidUntil.toISOString(),
//       };
//     }

//     return res.status(StatusCodes.OK).json(response);
//   } catch (error) {
//     console.error('Error fetching outlet details:', error);
//     return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
//   } finally {
//     await globalPrisma.$disconnect();
//   }
// };