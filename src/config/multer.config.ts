import * as multer from 'multer';
import { Request } from 'express';
import { FileFilterCallback } from 'multer';

export const multerMemoryStorage: multer.Options = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter(
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback, // Tip faqat shu yerda qo‘yiladi
  ): void {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true); // ✅ Type-safe
    } else {
      cb(new Error('❌ Only image files are allowed.')); // ✅ Yagona argumentli chaqirish
    }
  },
};
