/**
 * Notification Messages - Indonesian
 *
 * All push notification titles and messages for the application.
 * Currently using Indonesian (Bahasa Indonesia) as the default language.
 */

export const NotificationMessages = {
  // Sales Notifications
  sales: {
    newSaleCompleted: {
      title: 'Penjualan Baru Selesai',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Rp ${amount}`
    },
    paymentAdded: {
      title: 'Pembayaran Ditambahkan',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Pembayaran Rp ${amount}`
    },
    paymentCompleted: {
      title: 'Pembayaran Piutang Selesai',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Pembayaran Rp ${amount}`
    },
    saleVoided: {
      title: 'Penjualan Dibatalkan',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Rp ${amount} telah dibatalkan`
    },
    saleReturned: {
      title: 'Penjualan Dikembalikan',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Rp ${amount} telah dikembalikan`
    },
    saleRefunded: {
      title: 'Penjualan Direfund',
      message: (saleId: number, amount: string) => `Penjualan #${saleId} - Rp ${amount} telah direfund`
    }
  },

  // Inventory Notifications
  inventory: {
    outOfStock: {
      title: {
        single: 'Peringatan Stok Habis',
        multiple: (count: number) => `${count} Barang Stok Habis`
      },
      message: {
        single: (itemName: string) => `${itemName} sudah habis stoknya`,
        twoOrThree: (itemNames: string[]) => itemNames.join(', '),
        moreThanThree: (firstTwo: string[], remaining: number) =>
          `${firstTwo.join(', ')} dan ${remaining} lainnya`
      }
    },
    lowStock: {
      title: {
        single: 'Peringatan Stok Menipis',
        multiple: (count: number) => `${count} Barang Stok Menipis`
      },
      message: {
        single: (itemName: string, quantity: string) =>
          `${itemName} stoknya menipis (${quantity} tersisa)`,
        twoOrThree: (itemNames: string[]) => itemNames.join(', '),
        moreThanThree: (firstTwo: string[], remaining: number) =>
          `${firstTwo.join(', ')} dan ${remaining} lainnya`
      }
    }
  },

  // Delivery Notifications
  delivery: {
    deliveriesConfirmed: {
      title: 'Pengiriman Dikonfirmasi',
      message: (count: number) => `${count} pesanan pengiriman telah dikirim`
    }
  },

  // Order Notifications (future)
  order: {
    statusUpdated: {
      title: 'Status Pesanan Diperbarui',
      message: (orderId: string, status: string) => `Pesanan #${orderId} sekarang ${status}`
    }
  },

  // Financial Notifications (future)
  financial: {
    purchaseOrderApproved: {
      title: 'Purchase Order Disetujui',
      message: (poNumber: string, approver: string) =>
        `PO #${poNumber} disetujui oleh ${approver}`
    }
  },

  // Staff Notifications (future)
  staff: {
    shiftReminder: {
      title: 'Pengingat Shift',
      message: 'Shift Anda dimulai dalam 30 menit'
    }
  },

  // System Notifications (future)
  system: {
    subscriptionAlert: {
      title: 'Peringatan Langganan',
      message: (days: number) => `Langganan Anda akan berakhir dalam ${days} hari`
    }
  },

  // Direct User Notifications (future)
  direct: {
    importantMessage: {
      title: 'Pesan Penting',
      message: 'Silakan periksa persetujuan yang tertunda'
    }
  }
};

/**
 * Helper function to format item names for out of stock notifications
 */
export function formatOutOfStockMessage(items: Array<{ itemName: string }>): string {
  if (items.length === 1) {
    return NotificationMessages.inventory.outOfStock.message.single(items[0].itemName);
  } else if (items.length <= 3) {
    return NotificationMessages.inventory.outOfStock.message.twoOrThree(
      items.map(i => i.itemName)
    );
  } else {
    return NotificationMessages.inventory.outOfStock.message.moreThanThree(
      items.slice(0, 2).map(i => i.itemName),
      items.length - 2
    );
  }
}

/**
 * Helper function to format item names for low stock notifications
 */
export function formatLowStockMessage(
  items: Array<{ itemName: string; newAvailableQuantity: number }>
): string {
  if (items.length === 1) {
    return NotificationMessages.inventory.lowStock.message.single(
      items[0].itemName,
      items[0].newAvailableQuantity.toFixed(0)
    );
  } else if (items.length <= 3) {
    return NotificationMessages.inventory.lowStock.message.twoOrThree(
      items.map(i => i.itemName)
    );
  } else {
    return NotificationMessages.inventory.lowStock.message.moreThanThree(
      items.slice(0, 2).map(i => i.itemName),
      items.length - 2
    );
  }
}

/**
 * Helper function to get title for out of stock notifications
 */
export function getOutOfStockTitle(itemCount: number): string {
  if (itemCount === 1) {
    return NotificationMessages.inventory.outOfStock.title.single;
  } else {
    return NotificationMessages.inventory.outOfStock.title.multiple(itemCount);
  }
}

/**
 * Helper function to get title for low stock notifications
 */
export function getLowStockTitle(itemCount: number): string {
  if (itemCount === 1) {
    return NotificationMessages.inventory.lowStock.title.single;
  } else {
    return NotificationMessages.inventory.lowStock.title.multiple(itemCount);
  }
}
