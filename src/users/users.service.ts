/*
https://docs.nestjs.com/providers#services
*/

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from 'nestjs-knex';
import { CreateUserDto } from './dto/create-user.dto';
import { FindAllUsersDto } from './dto/find-all-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {

    constructor(
        @InjectKnex() private readonly knex: Knex,
    ) { }

    async create(dto: CreateUserDto) {
        const exists = await this.knex('users')
            .whereRaw('LOWER(phone_number) = ?', dto.phone_number.toLowerCase())
            .andWhereNot({ status: 'Deleted' })
            .first();

        if (exists) {
            throw new BadRequestException({
                message: 'Phone number already exists',
                location: 'phone_number',
            });
        }

        const [user] = await this.knex('users')
            .insert({
                first_name: dto.first_name,
                last_name: dto.last_name,
                phone_number: dto.phone_number,
                passport_series: dto.passport_series ?? null,
                birth_date: dto.birth_date ?? null,
                id_card_number: dto.id_card_number ?? null,
                language: dto.language ?? 'uz',
                status: 'Pending',
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
            })
            .returning('*');

        return {
            message: 'User created successfully',
            data: user,
        };
    }

    async findAll(query: FindAllUsersDto) {
        const offset = Number(query.offset) || 0;
        const limit = Number(query.limit) || 20;

        const q = this.knex('users')
            .select('*')
            .orderBy('created_at', 'desc')
            .offset(offset)
            .limit(limit);

        if (query.search) {
            const term = `%${query.search.toLowerCase()}%`;
            q.whereRaw(`
            LOWER(first_name) LIKE ?
            OR LOWER(last_name) LIKE ?
            OR phone_number ILIKE ?
            OR passport_series ILIKE ?
            OR id_card_number ILIKE ?
          `, [term, term, term, term, term]);
        }

        const data = await q;

        return data
    }

    async update(userId: string, dto: UpdateUserDto) {
        const user = await this.knex('users').where({ id: userId, status: 'Open' }).first();

        if (!user) {
            throw new NotFoundException({
                message: 'User not found',
                location: 'user_not_found',
            });
        }

        await this.knex('users')
            .where({ id: userId })
            .update({
                ...dto,
                updated_at: new Date(),
            });

        return { message: 'User updated successfully' };
    }

    async delete(userId: string) {
        const user = await this.knex('users').where({ id: userId, status: 'Open' }).first();

        if (!user) {
            throw new NotFoundException({
                message: 'User not found or already deleted',
                location: 'user_not_found',
            });
        }

        await this.knex('users')
            .where({ id: userId })
            .update({
                status: 'Deleted',
                is_active: false,
                updated_at: new Date(),
            });

        return { message: 'User deleted successfully' };
    }

}
