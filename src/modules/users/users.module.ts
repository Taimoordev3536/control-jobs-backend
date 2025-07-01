import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { AwsModule } from '../aws/aws.module';
import { Role } from './entities/role.entity';
import { RolesSeedService } from './roles.seed';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    AwsModule,
    forwardRef(() => AuthModule),
  ],
  providers: [UsersService, RolesSeedService],
  controllers: [UsersController],
  exports: [UsersService, RolesSeedService,TypeOrmModule],
})
export class UsersModule {
  constructor(private rolesSeedService: RolesSeedService) {
    // Commenting out seed service initialization since roles are already created
    // this.seedRoles();
  }

  private async seedRoles() {
    try {
      await this.rolesSeedService.seed();
    } catch (error) {
      console.error('Error seeding roles:', error);
    }
  }
}
