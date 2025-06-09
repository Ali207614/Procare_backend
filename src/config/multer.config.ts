// src/config/multer.config.ts
import * as multer from 'multer';
import { BadRequestException } from '@nestjs/common';

export const multerMemoryStorage = {
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1 * 1024 * 1024, // 5 MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(
                new BadRequestException({
                    message: '❌ Only image files are allowed.',
                    location: 'invalid_file_type',
                }),
                false
            );
        }
    },
};
