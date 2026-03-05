# Procare Real-Time Bildirishnomalar Tizimi (Frontend Qo'llanma)

Ushbu hujjat frontend developerlar uchun Procare backend tizimidan real vaqt rejimidagi bildirishnomalarni qanday qabul qilish va qayta ishlash bo'yicha yo'riqnoma hisoblanadi.

## 1. Socket.io Ulanishi

Backend **Socket.io** kutubxonasidan foydalanadi. Ulanish paytida `adminId` query parametri yuborilishi shart. Tizim avtomatik ravishda ushbu admin tegishli bo'lgan barcha filiallar (branch) "xonalariga" (rooms) qo'shadi.

### Ulanish kodi (JavaScript/TypeScript):

```javascript
import { io } from "socket.io-client";

const socket = io("BACKEND_URL", {
  query: {
    adminId: "ADMIN_ID_SHU_YERDA"
  }
});

socket.on("connect", () => {
  console.log("Socket ulandi: ", socket.id);
});
```

---

## 2. Bildirishnomalarni Qabul Qilish

Barcha turdagi bildirishnomalar bitta event orqali yuboriladi: `notification`.

### Misol:

```javascript
socket.on("notification", (data) => {
  console.log("Yangi bildirishnoma keldi:", data);
  
  // Bildirishnomani UI'da ko'rsatish (Toast, Notification va h.k.)
  toast.info(data.message, {
    title: data.title
  });
});
```

---

## 3. Ma'lumotlar Tuzilmasi (Payload Structure)

Qabul qilinadigan obyekt formati quyidagicha:

| Maydon | Turi | Tavsif |
| :--- | :--- | :--- |
| `title` | `string` | Bildirishnoma sarlavhasi (masalan: "Yangi buyurtma") |
| `message` | `string` | Bildirishnoma matni |
| `type` | `string` | Xabar turi (`info`, `success`, `warning`, `error`) |
| `meta` | `object` | Qo'shimcha ma'lumotlar (buyurtma haqida to'liq kontekst) |

### Meta obyektining tarkibi:

`meta` obyekti bildirishnoma nima haqida ekanligini bildiradi va har doim quyidagi maydonlarni o'z ichiga oladi:

| Maydon | Turi | Tavsif |
| :--- | :--- | :--- |
| `order_id` | `string` | Tegishli repair orderning UUIDsi |
| `number_id` | `string` | Repair orderning tartib raqami (masalan: `"1024"`) |
| `sort` | `number` | Orderning o'z status ustunidagi tartib pozitsiyasi |
| `phone_category_name` | `string \| null` | Qurilma kategoriyasining nomi (masalan: `"iPhone 14 Pro"`) |
| `user_full_name` | `string \| null` | Mijozning to'liq ismi |
| `user_phone_number` | `string \| null` | Mijozning telefon raqami |
| `pickup_method` | `string` | Qabul qilish usuli (`Self`, `Courier`, va h.k.) |
| `delivery_method` | `string` | Yetkazib berish usuli (`Self`, `Courier`, va h.k.) |
| `priority` | `string` | Buyurtma ustuvorligi (`Low`, `Medium`, `High`) |
| `source` | `string` | Buyurtma manbasi |
| `assigned_admins` | `string \| null` | Tayinlangan adminlarning to'liq ismlari (vergul bilan ajratilgan) |
| `action` | `string` | Sodir bo'lgan amal turi (pastda batafsil) |

#### `order_created` action uchun qo'shimcha maydonlar:

*(yuqoridagi barcha maydonlarga qo'shimcha ravishda)*

*(hech qanday qo'shimcha maydon yo'q)*

#### `status_changed` action uchun qo'shimcha maydonlar:

| Maydon | Turi | Tavsif |
| :--- | :--- | :--- |
| `from_status_id` | `string` | Oldingi status UUIDsi |
| `to_status_id` | `string` | Yangi status UUIDsi |

#### `assigned_to_order` action uchun qo'shimcha maydonlar:

| Maydon | Turi | Tavsif |
| :--- | :--- | :--- |
| `branch_id` | `string` | Filial UUIDsi |
| `assigned_by` | `string` | Tayinlashni amalga oshirgan admin UUIDsi |

---

## 4. Action Turlari (Harakatlar)

Frontend `meta.action` maydoniga qarab foydalanuvchini kerakli sahifaga yo'naltirishi yoki ma'lumotlarni yangilashi mumkin:

| `action` | Hodisa | Tavsif |
| :--- | :--- | :--- |
| `order_created` | Yangi buyurtma | Filialda yangi repair order yaratilganda |
| `status_changed` | Status o'zgardi | Buyurtma bir statusdan boshqasiga o'tkazilganda |
| `assigned_to_order` | Mas'ul tayinlandi | Adminga aniq bir buyurtma biriktirilganda |

---

## 5. TypeScript uchun Interfeyslar

Agar loyihada TypeScript ishlatilayotgan bo'lsa, quyidagi interfeyslardan foydalanish tavsiya etiladi:

```typescript
interface NotificationMeta {
  order_id: string;
  number_id: string;
  sort: number;
  phone_category_name: string | null;
  user_full_name: string | null;
  user_phone_number: string | null;
  pickup_method: string;
  delivery_method: string;
  priority: string;
  source: string;
  assigned_admins: string | null;
  action: 'order_created' | 'status_changed' | 'assigned_to_order';
  // status_changed only
  from_status_id?: string;
  to_status_id?: string;
  // assigned_to_order only
  branch_id?: string;
  assigned_by?: string;
}

interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  meta: NotificationMeta;
}
```

---

## Muhim Eslatmalar:
1.  **Xonalar (Rooms)**: Frontend'ga xonalarga qo'shilish bo'yicha buyruq berish shart emas. Backend ulanish vaqtida adminning ruxsatlarini tekshirib, uni avtomatik ravishda filiallar xonasiga qo'shadi.
2.  **Authorization**: Socket ulanishi xavfsizligini ta'minlash uchun auth tokenlarini ham qo'shish tavsiya etiladi (agar backend'da JWT ruxsatnomasi yoqilgan bo'lsa).
