import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AdminsService } from 'src/admins/admins.service';
import { RoleType } from 'src/common/types/role-type.enum';

interface JwtPayload {
  id: string;
  phone_number: string;
  roles: { name: string; id: string; type?: RoleType | null }[];
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    configService: ConfigService,
    private adminsService: AdminsService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const roles = await this.adminsService.findRolesByAdminId(payload.id);
    return {
      id: payload.id,
      phone_number: payload.phone_number,
      roles: roles || [],
    };
  }
}
