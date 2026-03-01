repair-order'ni create qilishda name, phone_numberlarni olib, user_id'siz repair-order yaratib yuboradigan qilindi.
---
phone_number'larni unique qilgandik. Vazifa yaratayotganda user_id'ni bermasdan name bilan phone_number'ni bersada, lekin o'sha nomer bilan user mavjud bo'lsa, backend o'sha user'ni avtomatik assign qilib qo'yadigan qilindi.
---
GET problem-categories endpoint har bir problem category bilan birga unga biriktirilgan repair part'larni (`assigned_parts`) qaytaradigan qilindi.
---
Repair order'larni olishda (`find-by-id` va `find-all-by-admin-branch`) `repair_order_status` ob'ektiga `can_user_view` maydoni qo'shildi.
---
Repair order create qilishda `phone_category_id` optional qilindi. Agar create paytida `initial_problems` yoki `final_problems` berilsa, unda `phone_category_id` bo'lishi shart, aks holda xatolik beradi.
---
Campaigns module'da API izchilligi uchun `:id` o'rniga `:campaign_id` ishlatildi va `NotFoundException` o'rniga `BadRequestException`ga o'tildi.
---
Performance va consistency'ni oshirish maqsadida `AdminsService`, `BranchesService` va `RolesService`larda Redis cache'ni tozalash amallari DB transaction'dan tashqariga chiqarildi.
---
Repair order SQL query'lariga (`find-by-id`, `find-all-by-admin-branch`) bevosita `name` va `phone_number` maydonlari qo'shildi.