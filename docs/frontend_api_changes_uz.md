# Frontend uchun API o'zgarishlari bo'yicha batafsil hujjat (Oldin va Keyin)

Ushbu hujjat frontend dasturchilari uchun API dagi so'nggi o'zgarishlarni tushuntiradi. Faqat so'rov va endpoint darajasidagi o'zgarishlar keltirilgan.

---

## 1. Employees (Admins) moduli
### Endpoint: `PATCH /api/v1/admins/change-password`
*   **Xolati**: O'chirildi (**Deleted**)
*   **Oldin**: Parolni o'zgartirish uchun ushbu manzildan foydalanilar edi.
*   **Keyin**: Ushbu endpoint endi mavjud emas. Parolni o'zgartirish umumiy autentifikatsiya yoki parolni tiklash (password reset) oqimi orqali amalga oshiriladi.

---

## 2. Repair Order Statuses moduli
### Endpoint: `GET /api/v1/repair-order-statuses` va `/viewable`
*   **Xolati**: Tuzatildi (**Fixed**)
*   **So'rov parametrlari**: `limit`, `offset`
*   **Oldin**: `limit` parametri yuborilsa ham API uni inobatga olmasdi (doim hammasini yoki default 20 ta qaytarardi).
*   **Keyin**: `limit` va `offset` parametrlari endi to'liq ishlaydi. 
    *   `limit` uchun default qiymat: `20`
    *   Max qiymat: `100`

---

## 3. Repair Parts moduli
### Endpoint: `GET /api/v1/repair-parts`
*   **Xolati**: Yaxshilandi (**Improved**)
*   **So'rov parametrlari**: `status[]`, `problem_category_ids[]`, `exclude_problem_category_ids[]`
*   **Oldin**: Parametrlar faqat ma'las bir formatda qabul qilinardi, qavsli ko'rinishda (`[]`) muammolar bo'lishi mumkin edi.
*   **Keyin**: So'rovlar yanada moslashuvchan bo'ldi. Endi frontend quyidagi formatlarda yuborishi mumkin:
    *   Massiv ko'rinishida: `?status[]=Open&status[]=Deleted`
    *   Vergul bilan ajratilgan: `?status=Open,Deleted`
    *   API avtomatik ravishda noto'g'ri kalitlarni (masalan `status[0]`) ham tozalab to'g'ri qabul qiladi.

---

## 4. Permissions moduli
### Endpoint: `GET /api/v1/permissions`
*   **Xolati**: Yangilandi (**Improved**)
*   **Yangi parametrlar**: `limit`, `offset`, `sort_by`, `sort_order`
*   **Oldin**: Pagination mavjud emas edi, barcha ruxsatnomalar bir vaqtda qaytarilardi.
*   **Keyin**: 
    *   Pagination qo'shildi. `limit` va `offset` orqali ma'lumotlarni qismlarga bo'lib olish mumkin.
    *   `limit` parametri uchun maksimum `100` qiymati o'rnatildi.
    *   `sort_by=name` orqali alifbo tartibida saralash mumkin.

---

## 5. Roles moduli
### Endpoint: `GET /api/v1/roles`
*   **Xolati**: Qat'iylashtirildi (**Improved**)
*   **Oldin**: `limit` parametri uchun qat'iy chegara yo'q edi.
*   **Keyin**: 
    *   `limit` parametri uchun maksimum `100` qiymati o'rnatildi. Agar 100 dan katta son yuborilsa, ValidationError qaytadi.
    *   `sort_by` parametri uchun enum (belgilangan qiymatlar) tekshiruvi qo'shildi.
    *   `is_active` va `is_protected` filtrlari endi faqat `'true'` yoki `'false'` qiymatlarini qabul qiladi.
