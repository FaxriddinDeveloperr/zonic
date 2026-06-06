// Port of Zonic.ServiceLayer/Sys/UserServices/UserService.cs + User.CreateUser
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { createRandomSalt, hashPassword } from '../common/helpers/password';
import { STATE_ACTIVE } from '../common/constants';
import { badRequest } from '../common/validation-problem';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

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
}
