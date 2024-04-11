import { Prisma, Sales, SalesItem } from "@prisma/client";
import { CreateSalesItemRequestBody, CreateSalesRequestBody } from "./sales.model";

let mapSalesPOToSalesDO = (sales: Sales, salesItems: SalesItem[]) => {
    let mappedSales: CreateSalesRequestBody = {
        id: sales.id,
        created: sales.created,
        outletId: sales.outletId,
        businessDate: sales.businessDate,
        salesType: sales.salesType,
        customerId: sales.customerId ? parseInt(sales.customerId.toString()) : 0,
        billStreet: sales.billStreet,
        billCity: sales.billCity,
        billState: sales.billState,
        billPostalCode: sales.billPostalCode,
        billCountry: sales.billCountry,
        shipStreet: sales.shipStreet,
        shipCity: sales.shipCity,
        shipState: sales.shipState,
        shipPostalCode: sales.shipPostalCode,
        shipCountry: sales.shipCountry,
        totalItemDiscountAmount: parseFloat(sales.totalItemDiscountAmount.toString()),
        discountPercentage: parseFloat(sales.discountPercentage.toString()),
        discountAmount: parseFloat(sales.discountAmount.toString()),
        profitAmount: parseFloat(sales.profitAmount.toString()),
        serviceChargeAmount: parseFloat(sales.serviceChargeAmount.toString()),
        taxAmount: parseFloat(sales.taxAmount.toString()),
        roundingAmount: parseFloat(sales.roundingAmount.toString()),
        subtotalAmount: parseFloat(sales.subtotalAmount.toString()),
        totalAmount: parseFloat(sales.totalAmount.toString()),
        paidAmount: parseFloat(sales.paidAmount.toString()),
        changeAmount: parseFloat(sales.changeAmount.toString()),
        status: sales.status,
        remark: sales.remark,
        declarationSessionId: sales.declarationSessionId,
        eodId: sales.eodId,
        salesQuotationId: sales.salesQuotationId ? parseInt(sales.salesQuotationId.toString()) : 0,
        performedBy: sales.performedBy,
        deleted: sales.deleted,
        items: mapSalesItemsPOToSalesItemsDO(salesItems) 
    }

    return mappedSales
}

let mapSalesDOToSalesPO = (sales: CreateSalesRequestBody) => {
    let mappedSales: Sales = {
        id: sales.id,
        created: sales.created,
        outletId: sales.outletId,
        businessDate: sales.businessDate,
        salesType: sales.salesType,
        customerId: sales.customerId,
        billStreet: sales.billStreet,
        billCity: sales.billCity,
        billState: sales.billState,
        billPostalCode: sales.billPostalCode,
        billCountry: sales.billCountry,
        shipStreet: sales.shipStreet,
        shipCity: sales.shipCity,
        shipState: sales.shipState,
        shipPostalCode: sales.shipPostalCode,
        shipCountry: sales.shipCountry,
        totalItemDiscountAmount: new Prisma.Decimal(sales.totalItemDiscountAmount),
        discountPercentage: new Prisma.Decimal(sales.discountPercentage),
        discountAmount: new Prisma.Decimal(sales.discountAmount),
        profitAmount: new Prisma.Decimal(sales.profitAmount),
        serviceChargeAmount: new Prisma.Decimal(sales.serviceChargeAmount),
        taxAmount: new Prisma.Decimal(sales.taxAmount),
        roundingAmount: new Prisma.Decimal(sales.roundingAmount),
        subtotalAmount: new Prisma.Decimal(sales.subtotalAmount),
        totalAmount: new Prisma.Decimal(sales.totalAmount),
        paidAmount: new Prisma.Decimal(sales.paidAmount),
        changeAmount: new Prisma.Decimal(sales.changeAmount),
        status: sales.status,
        remark: sales.remark,
        declarationSessionId: sales.declarationSessionId,
        eodId: sales.eodId,
        salesQuotationId: sales.salesQuotationId,
        performedBy: sales.performedBy,
        deleted: sales.deleted
    }
    return mappedSales
}

let mapSalesItemsPOToSalesItemsDO = (salesItems: SalesItem[]) => {
    let mappedSalesItems: CreateSalesItemRequestBody[] = salesItems.map(salesItem => {
        let mappedSalesItem: CreateSalesItemRequestBody = {
            id: salesItem.id,
            created: salesItem.created,
            salesId: salesItem.salesId,
            itemId: salesItem.itemId,
            itemCode: salesItem.itemCode,
            itemName: salesItem.itemName,
            quantity: parseFloat(salesItem.quantity.toString()),
            cost: parseFloat(salesItem.cost.toString()),
            price: parseFloat(salesItem.price.toString()),
            profit: parseFloat(salesItem.profit.toString()),
            discountPercentage: parseFloat(salesItem.discountPercentage.toString()),
            discountAmount: parseFloat(salesItem.discountAmount.toString()),
            serviceChargeAmount: parseFloat(salesItem.serviceChargeAmount.toString()),
            taxAmount: parseFloat(salesItem.taxAmount.toString()),
            subtotalAmount: parseFloat(salesItem.subtotalAmount.toString()),
            remark: salesItem.remark,
            deleted: salesItem.deleted,
        }
        return mappedSalesItem
    })
    return mappedSalesItems
}

let mapSalesItemsDOToSalesItemsPO = (salesItems: CreateSalesItemRequestBody[]) => {
    let mappedSalesItems: SalesItem[] = salesItems.map(salesItem => {
        let mappedSalesItem: SalesItem = {
            id: salesItem.id,
            created: salesItem.created,
            salesId: salesItem.salesId,
            itemId: salesItem.itemId,
            itemCode: salesItem.itemCode,
            itemName: salesItem.itemName,
            quantity: new Prisma.Decimal(salesItem.quantity),
            cost: new Prisma.Decimal(salesItem.cost),
            price: new Prisma.Decimal(salesItem.price),
            profit: new Prisma.Decimal(salesItem.profit),
            discountPercentage: new Prisma.Decimal(salesItem.discountPercentage),
            discountAmount: new Prisma.Decimal(salesItem.discountAmount),
            serviceChargeAmount: new Prisma.Decimal(salesItem.serviceChargeAmount),
            taxAmount: new Prisma.Decimal(salesItem.taxAmount),
            subtotalAmount: new Prisma.Decimal(salesItem.subtotalAmount),
            remark: salesItem.remark,
            deleted: salesItem.deleted,
        }
        return mappedSalesItem
    })
    return mappedSalesItems
}

export = {mapSalesDOToSalesPO, mapSalesPOToSalesDO, mapSalesItemsDOToSalesItemsPO, mapSalesItemsPOToSalesItemsDO}