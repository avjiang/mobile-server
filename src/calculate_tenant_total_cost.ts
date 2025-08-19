// import { Request, Response } from 'express';
// import { PrismaClient } from '@prisma/tenant-prisma';
// import { StatusCodes } from 'http-status-codes';

// // Global Prisma client for TENANT schema
// const globalPrisma = new PrismaClient();

// // Interface for API response structure
// interface TenantCostResponse {
//     tenantId: number;
//     tenantName: string;
//     outletCount: number;
//     outlets: Array<{
//         outletId: number;
//         outletName: string;
//         subscription: {
//             planName: string;
//             basePlanCost: number;
//             addOns: Array<{
//                 name: string;
//                 quantity: number;
//                 pricePerUnit: number;
//                 totalCost: number;
//             }>;
//             discounts: Array<{
//                 name: string;
//                 type: string;
//                 value: number;
//                 amount: number;
//             }>;
//             totalCost: number;
//             totalCostBeforeDiscount: number;
//             totalDiscount: number;
//             status: string;
//             subscriptionValidUntil: string;
//         } | null;
//     }>;
//     totalMonthlyCost: number;
//     totalCostBeforeDiscount: number;
//     totalDiscount: number;
// }

// // Calculate cost for a tenant
// export const getTenantCost = async (req: Request, res: Response) => {
//     try {
//         const { tenantId } = req.params;
//         const tenantIdNum = parseInt(tenantId, 10);

//         if (isNaN(tenantIdNum)) {
//             return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid tenant ID' });
//         }

//         // Fetch tenant from global DB
//         const tenant = await globalPrisma.tenant.findUnique({
//             where: { id: tenantIdNum },
//             include: {
//                 outlets: {
//                     where: { isActive: true },
//                     include: {
//                         subscriptions: {
//                             where: { status: { in: ['active', 'trial'] } },
//                             include: {
//                                 subscriptionPlan: true,
//                                 discount: true,
//                                 subscriptionAddOn: {
//                                     include: { addOn: true },
//                                 },
//                             },
//                         },
//                     },
//                 },
//             },
//         });

//         if (!tenant) {
//             return res.status(StatusCodes.NOT_FOUND).json({ error: 'Tenant not found' });
//         }

//         // Calculate outlet count
//         const outletCount = tenant.outlets.length;
//         const response: TenantCostResponse = {
//             tenantId: tenant.id,
//             tenantName: tenant.tenantName,
//             outletCount,
//             outlets: [],
//             totalMonthlyCost: 0,
//             totalCostBeforeDiscount: 0,
//             totalDiscount: 0,
//         };

//         // Track fixed discount application
//         let remainingFixedDiscount = 0;
//         let fixedDiscountName = '';
//         let fixedDiscountType = '';

//         // Check for tenant-wide fixed discount
//         const subscriptionsWithFixedDiscount = tenant.outlets
//             .flatMap(outlet => outlet.subscriptions)
//             .filter(sub => sub.discount?.discountType === 'fixed' && (!sub.discount.endDate || new Date() <= sub.discount.endDate));

//         if (subscriptionsWithFixedDiscount.length > 0) {
//             const discount = subscriptionsWithFixedDiscount[0].discount!;
//             remainingFixedDiscount = discount.value;
//             fixedDiscountName = discount.name;
//             fixedDiscountType = discount.discountType;
//         }

//         // Process each active outlet
//         for (const outlet of tenant.outlets) {
//             const subscription = outlet.subscriptions[0];
//             const outletData: TenantCostResponse['outlets'][0] = {
//                 outletId: outlet.id,
//                 outletName: outlet.outletName,
//                 subscription: null,
//             };

//             if (subscription) {
//                 const basePlanCost = subscription.subscriptionPlan.price;
//                 const addOns = subscription.subscriptionAddOn.map(({ addOn, quantity }) => ({
//                     name: addOn.name,
//                     quantity,
//                     pricePerUnit: addOn.pricePerUnit,
//                     totalCost: addOn.pricePerUnit * quantity,
//                 }));

//                 // Calculate discounts
//                 const discounts: Array<{ name: string; type: string; value: number; amount: number }> = [];

//                 // Promotional discount (percentage)
//                 let discountAmount = 0;
//                 if (
//                     subscription.discount &&
//                     subscription.discount.discountType === 'percentage' &&
//                     (!subscription.discount.endDate || new Date() <= subscription.discount.endDate)
//                 ) {
//                     const discountValue = subscription.discount.value / 100;
//                     const appliesToPlan = subscription.discount.appliesTo.includes('plan');
//                     const appliesToAddOns = subscription.discount.appliesTo.includes('add-on');

//                     const planDiscount = appliesToPlan ? basePlanCost * discountValue : 0;
//                     const addOnDiscount = appliesToAddOns
//                         ? addOns.reduce((sum, addOn) => sum + addOn.totalCost * discountValue, 0)
//                         : 0;

//                     discountAmount = planDiscount + addOnDiscount;
//                     discounts.push({
//                         name: subscription.discount.name,
//                         type: subscription.discount.discountType,
//                         value: subscription.discount.value,
//                         amount: discountAmount,
//                     });
//                 }

//                 // Fixed discount (apply to first outlet)
//                 if (remainingFixedDiscount > 0) {
//                     const fixedAmount = Math.min(remainingFixedDiscount, basePlanCost + addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0));
//                     discounts.push({
//                         name: fixedDiscountName,
//                         type: fixedDiscountType,
//                         value: fixedAmount,
//                         amount: fixedAmount,
//                     });
//                     discountAmount += fixedAmount;
//                     remainingFixedDiscount -= fixedAmount;
//                 }

//                 // Total cost for this outlet
//                 const totalAddOnCost = addOns.reduce((sum, addOn) => sum + addOn.totalCost, 0);
//                 const totalCostBeforeDiscount = basePlanCost + totalAddOnCost;
//                 const totalCost = Math.max(0, totalCostBeforeDiscount - discountAmount);

//                 outletData.subscription = {
//                     planName: subscription.subscriptionPlan.planName,
//                     basePlanCost,
//                     addOns,
//                     discounts,
//                     totalCost,
//                     totalCostBeforeDiscount,
//                     totalDiscount: discountAmount,
//                     status: subscription.status,
//                     subscriptionValidUntil: subscription.subscriptionValidUntil.toISOString(),
//                 };

//                 response.totalMonthlyCost += totalCost;
//                 response.totalCostBeforeDiscount += totalCostBeforeDiscount;
//                 response.totalDiscount += discountAmount;
//             }

//             response.outlets.push(outletData);
//         }

//         return res.status(StatusCodes.OK).json(response);
//     } catch (error) {
//         console.error('Error calculating tenant cost:', error);
//         return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
//     } finally {
//         await globalPrisma.$disconnect();
//     }
// };