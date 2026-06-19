import { IsNull, Repository } from 'typeorm';
import { AdminUser } from '../../users/entities/admin-user.entity';

export interface CompanyIdentity {
  name: string;
  taxId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
}

/**
 * Company block shown on invoices, sourced from the default admin's "Mis Datos".
 * Falls back to the first top-level admin when no default flag is set.
 */
export async function resolveCompanyIdentity(
  adminUserRepo: Repository<AdminUser>,
): Promise<CompanyIdentity | null> {
  let admin = await adminUserRepo.findOne({
    where: { isDefault: true },
    relations: ['user'],
    order: { id: 'ASC' },
  });
  if (!admin) {
    admin = await adminUserRepo.findOne({
      where: { parentUserId: IsNull() },
      relations: ['user'],
      order: { id: 'ASC' },
    });
  }
  if (!admin) return null;
  return {
    name: admin.user?.name || '',
    taxId: admin.nif,
    address: admin.address,
    postalCode: admin.postalCode,
    city: admin.city,
    province: admin.province,
    country: admin.country,
  };
}
