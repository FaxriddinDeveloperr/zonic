// Port of Zonic.ServiceLayer/Sys/UserServices/UserService.cs + User.CreateUser
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { createRandomSalt, hashPassword, verifyPassword } from '../common/helpers/password';
import { STATE_ACTIVE } from '../common/constants';
import { badRequest } from '../common/validation-problem';
import { ZonesService } from '../zones/zones.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly zones: ZonesService,
  ) {}

  async register(dto: CreateUserDto): Promise<RegisterResponseDto> {
    // UserService.Validate — uniqueness checks (length/required handled by ValidationPipe)
    const existingUser = await this.users.findOne({ where: { username: dto.username } });
    if (existingUser) {
      throw badRequest(['Tizimda ushbu username bilan foydalanuvchi mavjud']);
    }

    if (dto.email) {
      const existingEmail = await this.users.findOne({ where: { email: dto.email } });
      if (existingEmail) {
        throw badRequest(['Tizimda ushbu email orqali boshqa foydalanuvchi mavjud']);
      }
    }

    // User.CreateUser: new id, salt+hash (SetPassword), StateId = ACTIVE
    const salt = createRandomSalt();
    const entity = this.users.create({
      username: dto.username,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      passwordSalt: salt,
      passwordHash: hashPassword(dto.password, salt),
      stateId: STATE_ACTIVE,
    });

    const saved = await this.users.save(entity);
    return { id: saved.id };
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (dto.username !== undefined && dto.username !== user.username) {
      const taken = await this.users.findOne({
        where: { username: dto.username, id: Not(userId) },
      });
      if (taken) throw badRequest(['Tizimda ushbu username bilan foydalanuvchi mavjud']);
      user.username = dto.username;
    }

    if (dto.email !== undefined && dto.email !== user.email) {
      if (dto.email) {
        const taken = await this.users.findOne({
          where: { email: dto.email, id: Not(userId) },
        });
        if (taken) throw badRequest(['Tizimda ushbu email orqali boshqa foydalanuvchi mavjud']);
      }
      user.email = dto.email || null;
    }

    if (dto.phone !== undefined) {
      user.phone = dto.phone || null;
    }

    if (dto.newPassword) {
      if (!dto.oldPassword) throw badRequest(['oldPassword is required to set a new password.']);
      if (!verifyPassword(dto.oldPassword, user.passwordSalt, user.passwordHash)) {
        throw badRequest(['Old password is incorrect.']);
      }
      const salt = createRandomSalt();
      user.passwordSalt = salt;
      user.passwordHash = hashPassword(dto.newPassword, salt);
    }

    let recolor = false;
    if (dto.color !== undefined && dto.color !== user.color) {
      user.color = dto.color;
      recolor = true;
    }

    // ─── Onboarding / profile fields (Phase D) ───
    // Cascade: changing the country clears the region unless a new region is sent in the
    // same request (TZ: "Davlat o'zgartirgan ondayoq, Hudud avtomatik tozalanishi").
    let countryChanged = false;
    if (dto.countryId !== undefined) {
      countryChanged = dto.countryId !== user.countryId;
      user.countryId = dto.countryId;
    }
    if (dto.regionId !== undefined) {
      user.regionId = dto.regionId;
    } else if (countryChanged) {
      user.regionId = null;
    }
    if (user.regionId != null) {
      const rows: Array<{ countryid: number }> = await this.users.manager.query(
        'SELECT countryid FROM info_region WHERE id = $1',
        [user.regionId],
      );
      if (rows.length === 0) throw badRequest(['Region not found.']);
      if (user.countryId != null && Number(rows[0].countryid) !== user.countryId) {
        throw badRequest(['Region does not belong to the selected country.']);
      }
    }
    if (dto.age !== undefined) user.age = dto.age;
    if (dto.heightCm !== undefined) user.heightCm = dto.heightCm;
    if (dto.weightKg !== undefined) user.weightKg = dto.weightKg;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.level !== undefined) user.level = dto.level;
    if (dto.privacyLat !== undefined) user.privacyLat = dto.privacyLat;
    if (dto.privacyLng !== undefined) user.privacyLng = dto.privacyLng;
    if (dto.privacyRadiusM !== undefined) user.privacyRadiusM = dto.privacyRadiusM;

    await this.users.save(user);

    // Color is the user's personal/team color → all their zones adopt it.
    if (recolor && dto.color) {
      await this.zones.recolorUserZones(userId, dto.color);
    }
  }
}
