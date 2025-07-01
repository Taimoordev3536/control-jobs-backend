import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesSeedService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) { }

  async seed(): Promise<void> {
    const roles = [
      { name: 'Admin', value: 1 },
      { name: 'Partner', value: 2 },
      { name: 'Employer', value: 3 },
      { name: 'Client', value: 4 },
      { name: 'Worker', value: 5 },
    ];

    for (const role of roles) {
      const existingRole = await this.rolesRepository.findOne({
        where: { value: role.value },
      });

      if (!existingRole) {
        console.log(`Creating role: ${role.name} (value: ${role.value})`);
        await this.rolesRepository.save(role);
      } else {
        console.log(`Role already exists: ${role.name} (value: ${role.value})`);
      }
    }

    // Verify roles exist
    const allRoles = await this.rolesRepository.find();
    console.log(
      'Available roles:',
      allRoles.map((r) => ({
        id: r.id,
        name: r.name,
        value: r.value,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  }
}
