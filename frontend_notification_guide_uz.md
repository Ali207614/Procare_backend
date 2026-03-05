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
| `meta` | `object` | Qo'shimcha ma'lumotlar (IDlar va harakat turi) |

### Meta obyektining tarkibi:

`meta` obyekti bildirishnoma nima haqida ekanligini bildiradi:

*   **`order_id`**: Tegishli repair orderning UUIDsi.
*   **`action`**: Sodir bo'lgan amal turi.

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
interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  meta: {
    order_id: string;
    action: 'order_created' | 'status_changed' | 'assigned_to_order';
    from_status_id?: string;
    to_status_id?: string;
    [key: string]: any;
  };
}
```

---

## Muhim Eslatmalar:
1.  **Xonalar (Rooms)**: Frontend'ga xonalarga qo'shilish bo'yicha buyruq berish shart emas. Backend ulanish vaqtida adminning ruxsatlarini tekshirib, uni avtomatik ravishda filiallar xonasiga qo'shadi.
2.  **Authorization**: Socket ulanishi xavfsizligini ta'minlash uchun auth tokenlarini ham qo'shish tavsiya etiladi (agar backend'da JWT ruxsatnomasi yoqilgan bo'lsa).
