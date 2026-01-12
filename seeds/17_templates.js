exports.seed = async function (knex) {
  await knex('templates').del();

  const templates = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name_uz: 'Yangi buyurtma tasdiqlanishi',
      name_ru: 'Подтверждение нового заказа',
      name_en: 'New Order Confirmation',
      content: 'Assalomu alaykum {{customer_name}}!\n\nSizning {{order_number}} raqamli buyurtmangiz muvaffaqiyatli qabul qilindi.\n\nTelefon modeli: {{phone_model}}\nMuammo: {{problem}}\nTaxminiy narx: {{price}} so\'m\n\nBiz tez orada siz bilan bog\'lanamiz.\n\nRahmat!\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 1,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      name_uz: 'Diagnostika tugallandi',
      name_ru: 'Диагностика завершена',
      name_en: 'Diagnosis Completed',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtma uchun diagnostika tugallandi.\n\nMuammo: {{final_problem}}\nTa\'mir narxi: {{final_price}} so\'m\nTaxminiy vaqt: {{estimated_time}} soat\n\nTa\'mirni boshlashga rozimisiz?\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 2,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      name_uz: 'Ta\'mir tayyor',
      name_ru: 'Ремонт готов',
      name_en: 'Repair Ready',
      content: 'Tabriklaymiz {{customer_name}}!\n\n{{order_number}} buyurtmangiz tayyor.\n\nTelefoningizni olib ketishingiz mumkin.\n\nIsh vaqti: 09:00-20:00\nManzil: {{branch_address}}\n\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 3,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      name_uz: 'Yetkazib berish yo\'lda',
      name_ru: 'Доставка в пути',
      name_en: 'Out for Delivery',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtmangiz yetkazib berish uchun yo\'lga chiqarildi.\n\nKurier: {{courier_name}}\nTelefon: {{courier_phone}}\nTaxminiy yetkazib berish vaqti: {{delivery_time}}\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 4,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      name_uz: 'Buyurtma bekor qilindi',
      name_ru: 'Заказ отменен',
      name_en: 'Order Cancelled',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtmangiz bekor qilindi.\n\nSabab: {{cancellation_reason}}\n\nSavollaringiz bo\'lsa, biz bilan bog\'laning.\n\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 5,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      name_uz: 'To\'lov eslatmasi',
      name_ru: 'Напоминание об оплате',
      name_en: 'Payment Reminder',
      content: 'Salom {{customer_name}}!\n\n{{order_number}} buyurtma uchun to\'lov kutilmoqda.\n\nTo\'lov miqdori: {{amount}} so\'m\nMuddati: {{payment_deadline}}\n\nOnlayn to\'lov: {{payment_link}}\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 6,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000007',
      name_uz: 'Ijara telefoni',
      name_ru: 'Аренда телефона',
      name_en: 'Phone Rental',
      content: 'Salom {{customer_name}}!\n\nSizga ijara telefoni taqdim etildi:\n\nModel: {{rental_phone_model}}\nKunlik narx: {{daily_price}} so\'m\nMuddat: {{rental_period}} kun\n\nTelefonnni ehtiyotkorlik bilan ishlating.\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 7,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000008',
      name_uz: 'Kafolat tugayotgani haqida',
      name_ru: 'Окончание гарантии',
      name_en: 'Warranty Expiring',
      content: 'Diqqat {{customer_name}}!\n\n{{order_number}} buyurtma uchun kafolat muddati tugayapti.\n\nKafolat tugashi: {{warranty_end_date}}\n\nMuammolar mavjudmi? Biz bilan bog\'laning.\n\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 8,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000009',
      name_uz: 'Yangi aksiya e\'loni',
      name_ru: 'Объявление новой акции',
      name_en: 'New Promotion Announcement',
      content: 'Yangi aksiya! 🎉\n\n{{promotion_title}}\n{{promotion_description}}\n\nAksiya muddati: {{promotion_period}}\nPromokod: {{promo_code}}\n\nTezroq foydalaning!\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 9,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000010',
      name_uz: 'Mijoz fikri so\'rash',
      name_ru: 'Запрос отзыва клиента',
      name_en: 'Customer Feedback Request',
      content: 'Rahmat {{customer_name}}!\n\nXizmatimizdan qoniqishingizni bilishni xohlaymiz.\n\n{{order_number}} buyurtma uchun baholang:\n{{feedback_link}}\n\nFikringiz biz uchun muhim!\n\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 10,
    },
    // Email Templates
    {
      id: 'a0000000-0000-0000-0000-000000000011',
      name_uz: 'Batafsil buyurtma ma\'lumoti',
      name_ru: 'Подробная информация о заказе',
      name_en: 'Detailed Order Information',
      content: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #666; }
        .order-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Buyurtma tafsilotlari</h1>
        </div>
        <div class="content">
            <p>Hurmatli {{customer_name}},</p>
            <p>Sizning {{order_number}} raqamli buyurtmangiz haqida batafsil ma'lumot:</p>

            <div class="order-details">
                <h3>Telefon ma'lumotlari:</h3>
                <p><strong>Model:</strong> {{phone_model}}</p>
                <p><strong>Muammo:</strong> {{problem_description}}</p>
                <p><strong>Holati:</strong> {{current_status}}</p>
            </div>

            <div class="order-details">
                <h3>Narx ma'lumotlari:</h3>
                <p><strong>Diagnostika:</strong> {{diagnostic_price}} so'm</p>
                <p><strong>Ta'mir:</strong> {{repair_price}} so'm</p>
                <p><strong>Qismlar:</strong> {{parts_price}} so'm</p>
                <p><strong>Jami:</strong> {{total_price}} so'm</p>
            </div>

            <p>Savollaringiz bo'lsa, biz bilan bog'laning: +998 71 123 45 67</p>
        </div>
        <div class="footer">
            <p>© 2025 Procare. Barcha huquqlar himoyalangan.</p>
        </div>
    </div>
</body>
</html>
      `,
      type: 'email',
      is_active: true,
      sort: 11,
    },
    // Telegram Templates
    {
      id: 'a0000000-0000-0000-0000-000000000012',
      name_uz: 'Telegram buyurtma holati',
      name_ru: 'Telegram статус заказа',
      name_en: 'Telegram Order Status',
      content: '🔧 *Buyurtma holati yangilandi*\n\n📱 *Telefon:* {{phone_model}}\n📝 *Buyurtma:* {{order_number}}\n⚡ *Holat:* {{current_status}}\n💰 *Narx:* {{price}} som\n📅 *Sana:* {{update_date}}\n\n[Batafsil ko\'rish]({{order_link}})',
      type: 'telegram',
      is_active: true,
      sort: 12,
    },
  ];

  for (const template of templates) {
    await knex('templates').insert({
      id: template.id,
      name_uz: template.name_uz,
      name_ru: template.name_ru,
      name_en: template.name_en,
      content: template.content,
      type: template.type,
      is_active: template.is_active,
      sort: template.sort,
      status: 'Open',
      created_by: '00000000-0000-0000-0000-000000000001', // Super admin
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });
  }
};