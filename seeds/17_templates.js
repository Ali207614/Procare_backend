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
    {
      id: 'a0000000-0000-0000-0000-000000000013',
      name_uz: 'Qismlar yetib keldi',
      name_ru: 'Запчасти прибыли',
      name_en: 'Parts Arrived',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtma uchun kerakli qismlar yetib keldi.\n\nTa\'mirni boshlashga tayyormiz.\n\nTez orada sizga xabar beramiz.\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 13,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000014',
      name_uz: 'Ta\'mir boshlangan',
      name_ru: 'Ремонт начат',
      name_en: 'Repair Started',
      content: 'Salom {{customer_name}}!\n\n{{order_number}} buyurtma uchun ta\'mir ishlari boshlandi.\n\nTaxminiy tayyor bo\'lish vaqti: {{estimated_completion_date}}\n\nBiz sizga xabar beramiz.\n\nProcare jamoasi',
      type: 'sms',
      is_active: true,
      sort: 14,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000015',
      name_uz: 'Sinov jarayoni',
      name_ru: 'Процесс тестирования',
      name_en: 'Testing Process',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtma sinov jarayonida.\n\nBarcha funksiyalar tekshirilmoqda.\n\nTez orada tayyor bo\'ladi.\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 15,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000016',
      name_uz: 'To\'lov muvaffaqiyatli',
      name_ru: 'Оплата успешна',
      name_en: 'Payment Successful',
      content: 'Tabriklaymiz {{customer_name}}!\n\n{{order_number}} buyurtma uchun to\'lov muvaffaqiyatli amalga oshirildi.\n\nTo\'lov miqdori: {{amount}} so\'m\nTo\'lov usuli: {{payment_method}}\n\nRahmat!\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 16,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000017',
      name_uz: 'Kafolat karta',
      name_ru: 'Гарантийная карта',
      name_en: 'Warranty Card',
      content: 'Hurmatli {{customer_name}}!\n\n{{order_number}} buyurtma uchun kafolat karta tayyor.\n\nKafolat muddati: {{warranty_period}} oy\n\nKafolat kartani filialdan olishingiz mumkin.\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 17,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000018',
      name_uz: 'Mijozga eslatma',
      name_ru: 'Напоминание клиенту',
      name_en: 'Customer Reminder',
      content: 'Salom {{customer_name}}!\n\n{{order_number}} buyurtmangizni eslatib o\'tamiz.\n\nHolati: {{current_status}}\n\nSavollaringiz bo\'lsa, biz bilan bog\'laning.\n\nProcare',
      type: 'sms',
      is_active: true,
      sort: 18,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000019',
      name_uz: 'Email - Buyurtma tasdiqlanishi',
      name_ru: 'Email - Подтверждение заказа',
      name_en: 'Email - Order Confirmation',
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
        .order-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Buyurtma tasdiqlandi</h1>
        </div>
        <div class="content">
            <p>Hurmatli {{customer_name}},</p>
            <p>Sizning buyurtmangiz muvaffaqiyatli qabul qilindi!</p>
            
            <div class="order-info">
                <h3>Buyurtma ma'lumotlari:</h3>
                <p><strong>Buyurtma raqami:</strong> {{order_number}}</p>
                <p><strong>Telefon modeli:</strong> {{phone_model}}</p>
                <p><strong>Muammo:</strong> {{problem_description}}</p>
                <p><strong>Taxminiy narx:</strong> {{estimated_price}} so'm</p>
            </div>
            
            <p>Biz tez orada siz bilan bog'lanamiz va diagnostika natijalarini taqdim etamiz.</p>
            
            <a href="{{order_link}}" class="button">Buyurtmani ko'rish</a>
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
      sort: 19,
    },
    {
      id: 'a0000000-0000-0000-0000-000000000020',
      name_uz: 'Telegram - Yangi buyurtma',
      name_ru: 'Telegram - Новый заказ',
      name_en: 'Telegram - New Order',
      content: '✅ *Yangi buyurtma qabul qilindi*\n\n📱 *Telefon:* {{phone_model}}\n📝 *Buyurtma:* {{order_number}}\n🔧 *Muammo:* {{problem_description}}\n💰 *Narx:* {{estimated_price}} som\n\n[Buyurtmani ko\'rish]({{order_link}})',
      type: 'telegram',
      is_active: true,
      sort: 20,
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