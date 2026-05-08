# API Tuzatishlari Bo'yicha Hisobot

Ushbu hujjat so'nggi GitHub pushidan keyin kiritilgan API o'zgarishlari va tuzatishlarini o'z ichiga oladi.

## 1. POST `/users/` - Payload Validatsiyasi

**Muammo:**
`telegram_chat_id` maydoni uchun validatsiya noto'g'ri ishlagani sababli so'rovlar xatolik bilan yakunlanayotgan edi.

**Yechim:**
`CreateUserDto` da `telegram_chat_id` uchun `@IsNumberString` validatori qo'shildi, bu esa raqamlardan iborat qatorlarni qabul qilish imkonini beradi.

**Koddagi o'zgarish:**

*Oldin:*
Taxminan `@IsNumber()` yoki boshqa yaroqsiz validator ishlatilgan.

*Keyin (`src/users/dto/create-user.dto.ts`):*
```typescript
  @ApiProperty({ example: '1234567890', required: false, description: 'Telegram chat ID' })
  @IsOptional()
  @IsNumberString({}, { context: { location: 'telegram_chat_id' } })
  telegram_chat_id?: string;
```

## 2. PATCH `/api/v1/repair-orders/:id/client` - 500 Internal Server Error

**Muammo:**
Mijoz ma'lumotlarini yangilashda `repair_orders` jadvalida mavjud bo'lmagan `first_name`, `last_name` va `email` ustunlariga yozishga urinish tufayli xatolik yuz berayotgan edi.

**Yechim:**
`RepairOrdersService` da ma'lumotlarni bazaga yozishdan oldin ularni moslashtirish (mapping) logikasi qo'shildi. Endi `first_name` va `last_name` birlashtirilib `name` ustuniga, `phone` esa `phone_number` ustuniga yoziladi.

**Koddagi o'zgarish (`src/repair-orders/repair-orders.service.ts`):**

*Oldin:*
To'g'ridan-to'g'ri DTO obyektini yangilashga urinish.

*Keyin:*
```typescript
    const updateFields: Record<string, unknown> = {};

    // Map first_name + last_name → name
    if (updateDto.first_name !== undefined || updateDto.last_name !== undefined) {
      const nameParts = [updateDto.first_name, updateDto.last_name].filter(Boolean);
      if (nameParts.length > 0) {
        updateFields.name = nameParts.join(' ');
      }
    }

    // Map phone → phone_number
    if (updateDto.phone !== undefined) updateFields.phone_number = updateDto.phone;

    await this.knex(this.table).where({ id: repairOrderId }).update(updateFields);
```

## 3. Rental Phone Devices (GET/POST/PUT) - Ma'lumotlar Bazasi Mosligi

**Muammo:**
`rental_phone_devices` jadvalida kutilgan ba'zi ustunlar (`condition`, `specifications` va boshqalar) yetishmayotganligi sababli API 500 xatolik qaytarayotgan edi.

**Yechim:**
Servis logikasi bazadagi mavjud ustunlar bilan to'g'ri ishlashi uchun moslashtirildi va DTO validatsiyalari yangilandi.

**Koddagi o'zgarish (`src/rental-phone-devices/rental-phone-devices.service.ts`):**

*Yechim:*
Ma'lumotlar bazasiga yozish va o'qish jarayoni optimallashtirildi va xavfsiz holatga keltirildi.

## 4. Boshqa Tuzatishlar

- **GET `/repair-parts`**: `status` va `exclude_problem_category_ids` validatsiyasi tuzatildi.
- **PUT `/repair-parts/assignments`**: Payload validatsiyasi to'g'rilandi.
- **POST `/repair-orders`**: Payload strukturasi va validatsiyasi optimallashtirildi.
