const calculateTotal = (items, deliveryFee = 0, promoDiscount = 0) => {
  const itemsTotal = items.reduce((acc, item) => {
    // Narxni tekshirish (Price snapshot bo'lsa shuni oladi)
    const price = item.priceAtTime || (item.discountPrice > 0 ? item.discountPrice : item.price);
    return acc + (price * (item.quantity || 1));
  }, 0);

  const finalTotal = itemsTotal + Number(deliveryFee) - Number(promoDiscount);
  
  // Narxlarni 2 ta kasr raqamigacha yaxlitlaymiz (masalan: 12500.50)
  return {
    itemsTotal: Math.round(itemsTotal),
    deliveryFee: Math.round(deliveryFee),
    promoDiscount: Math.round(promoDiscount),
    finalTotal: finalTotal < 0 ? 0 : Math.round(finalTotal)
  };
};

module.exports = { calculateTotal };