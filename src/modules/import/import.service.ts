import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerType } from '../employers/entities/employer-type.entity';
import { EmployerSubType } from '../employers/entities/employer-sub-type.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerTier } from '../partners/entities/partner-type.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ClientsService } from '../clients/clients.service';
import { WorkersService } from '../workers/workers.service';
import { PartnersService } from '../partners/partners.service';
import { EmployersService } from '../employers/employers.service';
import { parseCsv, normalizeKey } from './csv-parser';

export type ImportType = 'users' | 'partners' | 'employers' | 'clients' | 'workers';

export interface ImportResult {
  type: ImportType;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: { row: number; reason: string; email?: string }[];
}

const SUPPORTED: ImportType[] = ['users', 'clients', 'workers', 'partners', 'employers'];

@Injectable()
export class ImportService {
  constructor(
    @InjectRepository(Employer) private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser) private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerType) private readonly employerTypeRepo: Repository<EmployerType>,
    @InjectRepository(EmployerSubType) private readonly employerSubTypeRepo: Repository<EmployerSubType>,
    @InjectRepository(Partner) private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerTier) private readonly partnerTierRepo: Repository<PartnerTier>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly usersService: UsersService,
    private readonly clientsService: ClientsService,
    private readonly workersService: WorkersService,
    private readonly partnersService: PartnersService,
    private readonly employersService: EmployersService,
  ) {}

  async importCsv(type: ImportType, file: Express.Multer.File): Promise<ImportResult> {
    if (!SUPPORTED.includes(type)) {
      throw new BadRequestException(`Import for "${type}" is not available.`);
    }
    if (!file?.buffer) throw new BadRequestException('No CSV file uploaded');

    const rows = parseCsv(file.buffer.toString('utf8'));
    if (rows.length === 0) throw new BadRequestException('The CSV file has no data rows');

    if (type === 'users') return this.importUsers(rows);
    if (type === 'clients') return this.importClients(rows);
    if (type === 'workers') return this.importWorkers(rows);
    if (type === 'partners') return this.importPartners(rows);
    return this.importEmployers(rows);
  }

  private field(row: Record<string, string>, aliases: string[]): string {
    const norm: Record<string, string> = {};
    for (const k of Object.keys(row)) norm[normalizeKey(k)] = row[k];
    for (const a of aliases) {
      const v = norm[normalizeKey(a)];
      if (v != null && v !== '') return v.trim();
    }
    return '';
  }

  private parseBool(v: string): boolean {
    if (!v) return true;
    return /^(s|si|sí|y|yes|true|1|activo|active)$/i.test(v.trim());
  }

  private isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  private async resolveRoleId(roleText: string): Promise<number | null> {
    const map: Record<string, number> = {
      admin: 1, administrador: 1,
      partner: 2, socio: 2,
      employer: 3, empleador: 3,
      client: 4, cliente: 4,
      worker: 5, trabajador: 5,
    };
    const value = map[normalizeKey(roleText)];
    if (!value) return null;
    const role = await this.roleRepo.findOne({ where: { value } });
    return role?.id ?? null;
  }

  private async importUsers(rows: Record<string, string>[]): Promise<ImportResult> {
    const result = this.blank('users', rows.length);
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const row = rows[i];
      const firstName = this.field(row, ['Nombre', 'firstName', 'name']);
      const lastName = this.field(row, ['Apellidos', 'lastName']);
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const roleText = this.field(row, ['Rol', 'role']);

      if (!firstName) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      const roleId = await this.resolveRoleId(roleText);
      if (!roleId) { this.fail(result, rowNo, `Unknown Rol "${roleText}"`, email); continue; }

      if (seen.has(email) || (await this.userRepo.findOne({ where: { email } }))) {
        this.skip(result, rowNo, 'Email already exists', email);
        continue;
      }
      seen.add(email);

      try {
        const password = await bcrypt.hash(randomBytes(6).toString('base64').slice(0, 10), 10);
        await this.usersService.create({
          name: `${firstName} ${lastName}`.trim(),
          email,
          password,
          firstName,
          lastName,
          roleId,
        } as any);
        result.imported++;
      } catch (e: any) {
        this.fail(result, rowNo, e?.message || 'Failed to create user', email);
      }
    }
    return result;
  }

  private async employerOwner(emp: Employer): Promise<User | null> {
    const def = await this.employerUserRepo.findOne({
      where: { employer: { id: emp.id }, isDefault: true },
      relations: ['user'],
    });
    if (def?.user) return def.user;
    const any = await this.employerUserRepo.findOne({
      where: { employer: { id: emp.id } },
      relations: ['user'],
    });
    return any?.user ?? null;
  }

  private async employerIndex() {
    const employers = await this.employerRepo.find();
    const byKey = new Map<string, Employer>();
    for (const e of employers) {
      if (e.name) byKey.set(normalizeKey(e.name), e);
      if ((e as any).taxId) byKey.set(normalizeKey((e as any).taxId), e);
    }
    return byKey;
  }

  private async importClients(rows: Record<string, string>[]): Promise<ImportResult> {
    const result = this.blank('clients', rows.length);
    const index = await this.employerIndex();
    const ownerCache = new Map<number, User | null>();
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const row = rows[i];
      const name = this.field(row, ['Nombre', 'name']);
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const type = this.field(row, ['Tipo', 'type']) || 'Particular';
      const employerText = this.field(row, ['Empleador', 'employer']);

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!employerText) { this.fail(result, rowNo, 'Empleador is required', email); continue; }

      const employer = index.get(normalizeKey(employerText));
      if (!employer) { this.fail(result, rowNo, `Employer "${employerText}" not found`, email); continue; }

      if (seen.has(email) || (await this.userRepo.findOne({ where: { email } }))) {
        this.skip(result, rowNo, 'Email already exists', email);
        continue;
      }

      let owner = ownerCache.get(employer.id);
      if (owner === undefined) {
        owner = await this.employerOwner(employer);
        ownerCache.set(employer.id, owner);
      }
      if (!owner) { this.fail(result, rowNo, `Employer "${employerText}" has no account to attach to`, email); continue; }

      try {
        await this.clientsService.createByEmployer(
          {
            name,
            email,
            type,
            taxId: this.field(row, ['NIF', 'taxId', 'cif']),
            code: this.field(row, ['Código', 'Codigo', 'code']) || `IMP-C-${Date.now()}-${rowNo}`,
            address: this.field(row, ['Dirección', 'Direccion', 'address']),
            city: this.field(row, ['Localidad', 'city']),
            province: this.field(row, ['Provincia', 'province']),
            postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
            mobile: this.field(row, ['Teléfono', 'Telefono', 'mobile', 'phone']),
            active: this.parseBool(this.field(row, ['Activo', 'active'])),
            accessAccountStatus: 'postpone',
          },
          owner,
        );
        seen.add(email);
        result.imported++;
      } catch (e: any) {
        const msg = e?.message || 'Failed to create client';
        if (/ya utilizado|already/i.test(msg)) this.skip(result, rowNo, 'Email already exists', email);
        else this.fail(result, rowNo, msg, email);
      }
    }
    return result;
  }

  private async importWorkers(rows: Record<string, string>[]): Promise<ImportResult> {
    const result = this.blank('workers', rows.length);
    const index = await this.employerIndex();
    const ownerCache = new Map<number, User | null>();
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const row = rows[i];
      const name = this.field(row, ['Nombre', 'name']);
      const lastName = this.field(row, ['Apellidos', 'lastName']);
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const employerText = this.field(row, ['Empleador', 'employer']);

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!employerText) { this.fail(result, rowNo, 'Empleador is required', email); continue; }

      const employer = index.get(normalizeKey(employerText));
      if (!employer) { this.fail(result, rowNo, `Employer "${employerText}" not found`, email); continue; }

      if (seen.has(email) || (await this.userRepo.findOne({ where: { email } }))) {
        this.skip(result, rowNo, 'Email already exists', email);
        continue;
      }

      let owner = ownerCache.get(employer.id);
      if (owner === undefined) {
        owner = await this.employerOwner(employer);
        ownerCache.set(employer.id, owner);
      }
      if (!owner) { this.fail(result, rowNo, `Employer "${employerText}" has no account to attach to`, email); continue; }

      try {
        await this.workersService.createByEmployer(
          {
            name,
            lastName,
            email,
            code: this.field(row, ['Código', 'Codigo', 'code']) || `IMP-W-${Date.now()}-${rowNo}`,
            nif: this.field(row, ['NIF', 'nif']),
            occupation: this.field(row, ['Ocupación', 'Ocupacion', 'occupation']),
            address: this.field(row, ['Dirección', 'Direccion', 'address']),
            city: this.field(row, ['Localidad', 'city']),
            province: this.field(row, ['Provincia', 'province']),
            postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
            mobile: this.field(row, ['Teléfono', 'Telefono', 'mobile', 'phone']),
            active: this.parseBool(this.field(row, ['Activo', 'active'])),
            accessAccountStatus: 'postpone',
          } as any,
          owner,
        );
        seen.add(email);
        result.imported++;
      } catch (e: any) {
        const msg = e?.message || 'Failed to create worker';
        if (/ya utilizado|already/i.test(msg)) this.skip(result, rowNo, 'Email already exists', email);
        else this.fail(result, rowNo, msg, email);
      }
    }
    return result;
  }

  private parseNum(v: string, fallback = 0): number {
    if (!v) return fallback;
    const n = Number(v.replace(/%/g, '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : fallback;
  }

  private resolvePartnerType(text: string): string | null {
    const map: Record<string, string> = {
      gold: 'Gold', oro: 'Gold',
      silver: 'Silver', plata: 'Silver',
      bronze: 'Bronze', bronce: 'Bronze',
      affiliate: 'Affiliate', afiliado: 'Affiliate',
    };
    return map[normalizeKey(text)] ?? null;
  }

  private resolvePaymentMethod(text: string): string {
    const map: Record<string, string> = {
      transfer: 'Transfer', transferencia: 'Transfer',
      directdebit: 'Direct Debit', domiciliacion: 'Direct Debit', recibo: 'Direct Debit',
      card: 'Card', tarjeta: 'Card',
      paypal: 'PayPal',
      others: 'Others', otros: 'Others',
    };
    return map[normalizeKey(text)] ?? 'Transfer';
  }

  private async resolveEmployerTypeId(text: string): Promise<number | null> {
    const map: Record<string, string> = {
      home: 'HOME', hogar: 'HOME', domicilio: 'HOME',
      static: 'STATIC', estatico: 'STATIC', fijo: 'STATIC',
      remote: 'REMOTE', remoto: 'REMOTE',
    };
    const enumVal = map[normalizeKey(text)];
    if (!enumVal) return null;
    const row = await this.employerTypeRepo.findOne({ where: { name: enumVal as any } });
    return row?.id ?? null;
  }

  private async resolveEmployerSubTypeId(text: string): Promise<number | null> {
    const map: Record<string, string> = {
      individual: 'INDIVIDUAL', particular: 'INDIVIDUAL',
      freelancer: 'FREELANCER', freelance: 'FREELANCER', autonomo: 'FREELANCER',
      company: 'COMPANY', empresa: 'COMPANY', compania: 'COMPANY',
    };
    const enumVal = map[normalizeKey(text)];
    if (!enumVal) return null;
    const row = await this.employerSubTypeRepo.findOne({ where: { name: enumVal as any } });
    return row?.id ?? null;
  }

  private async importPartners(rows: Record<string, string>[]): Promise<ImportResult> {
    const result = this.blank('partners', rows.length);
    const tiers = await this.partnerTierRepo.find();
    const tierByKey = new Map<string, PartnerTier>();
    for (const tr of tiers) tierByKey.set(normalizeKey(tr.name), tr);
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const row = rows[i];
      const name = this.field(row, ['Nombre', 'name']);
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const address = this.field(row, ['Dirección', 'Direccion', 'address']);
      const mobile = this.field(row, ['Teléfono', 'Telefono', 'Móvil', 'Movil', 'mobile', 'phone']);
      const nif = this.field(row, ['NIF', 'nif', 'cif']);
      const typeOfPartner = this.resolvePartnerType(this.field(row, ['Tipo', 'type']));
      const tierText = this.field(row, ['Tarifa', 'Tier', 'Nivel', 'tier']);

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!address) { this.fail(result, rowNo, 'Dirección is required', email); continue; }
      if (!mobile) { this.fail(result, rowNo, 'Teléfono is required', email); continue; }
      if (!nif) { this.fail(result, rowNo, 'NIF is required', email); continue; }
      if (!typeOfPartner) { this.fail(result, rowNo, 'Unknown/empty Tipo (Gold/Silver/Bronze/Affiliate)', email); continue; }

      const tier = tierText ? tierByKey.get(normalizeKey(tierText)) : (tiers.length === 1 ? tiers[0] : undefined);
      if (!tier) { this.fail(result, rowNo, tierText ? `Unknown Tarifa "${tierText}"` : 'Tarifa is required', email); continue; }

      if (seen.has(email) || (await this.userRepo.findOne({ where: { email } }))) {
        this.skip(result, rowNo, 'Email already exists', email);
        continue;
      }

      try {
        await this.partnersService.create({
          name,
          email,
          address,
          mobile,
          nif,
          typeOfPartner,
          partnerTierId: tier.id,
          commission: this.parseNum(this.field(row, ['Comisión', 'Comision', 'commission'])),
          retention: this.parseNum(this.field(row, ['Retención', 'Retencion', 'retention'])),
          paymentMethod: this.resolvePaymentMethod(this.field(row, ['Método de pago', 'Metodo de pago', 'paymentMethod'])),
          city: this.field(row, ['Localidad', 'city']),
          province: this.field(row, ['Provincia', 'province']),
          postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
          accountIban: this.field(row, ['IBAN', 'iban']),
          bicSwift: this.field(row, ['SWIFT', 'BIC', 'swiftBic']),
          accessAccountStatus: 'postpone',
        } as any);
        seen.add(email);
        result.imported++;
      } catch (e: any) {
        const msg = e?.message || 'Failed to create partner';
        if (/ya utilizado|already/i.test(msg)) this.skip(result, rowNo, 'Email already exists', email);
        else this.fail(result, rowNo, msg, email);
      }
    }
    return result;
  }

  private async importEmployers(rows: Record<string, string>[]): Promise<ImportResult> {
    const result = this.blank('employers', rows.length);
    const partners = await this.partnerRepo.find();
    const partnerByKey = new Map<string, Partner>();
    for (const p of partners) {
      if (p.name) partnerByKey.set(normalizeKey(p.name), p);
      if ((p as any).taxId) partnerByKey.set(normalizeKey((p as any).taxId), p);
    }
    const seen = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowNo = i + 1;
      const row = rows[i];
      const name = this.field(row, ['Nombre', 'name']);
      const taxId = this.field(row, ['NIF', 'nif', 'cif', 'taxId']);
      const address = this.field(row, ['Dirección', 'Direccion', 'address']);
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const partnerText = this.field(row, ['Partner', 'Socio', 'partner']);
      const typeText = this.field(row, ['Tipo', 'type']);
      const subTypeText = this.field(row, ['SubTipo', 'Subtipo', 'Tipo de empresa', 'subType']);

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!taxId) { this.fail(result, rowNo, 'NIF is required', email); continue; }
      if (!address) { this.fail(result, rowNo, 'Dirección is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!partnerText) { this.fail(result, rowNo, 'Partner is required', email); continue; }

      const partner = partnerByKey.get(normalizeKey(partnerText));
      if (!partner) { this.fail(result, rowNo, `Partner "${partnerText}" not found`, email); continue; }

      const typeId = await this.resolveEmployerTypeId(typeText);
      if (!typeId) { this.fail(result, rowNo, 'Unknown/empty Tipo (HOME/STATIC/REMOTE)', email); continue; }
      const subTypeId = await this.resolveEmployerSubTypeId(subTypeText);
      if (!subTypeId) { this.fail(result, rowNo, 'Unknown/empty SubTipo (INDIVIDUAL/FREELANCER/COMPANY)', email); continue; }

      if (seen.has(email) || (await this.userRepo.findOne({ where: { email } }))) {
        this.skip(result, rowNo, 'Email already exists', email);
        continue;
      }

      try {
        await this.employersService.create({
          name,
          taxId,
          address,
          partnerId: partner.publicId,
          typeId,
          subTypeId,
          user: {
            email,
            firstName: this.field(row, ['Nombre Contacto', 'firstName']),
            lastName: this.field(row, ['Apellidos Contacto', 'lastName']),
          },
          city: this.field(row, ['Localidad', 'city']),
          province: this.field(row, ['Provincia', 'province']),
          postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
          mobile: this.field(row, ['Teléfono', 'Telefono', 'mobile', 'phone']),
          responsible: this.field(row, ['Responsable', 'responsible']),
          accessAccountStatus: 'postpone',
        } as any);
        seen.add(email);
        result.imported++;
      } catch (e: any) {
        const msg = e?.message || 'Failed to create employer';
        if (/ya utilizado|already|in use/i.test(msg)) this.skip(result, rowNo, 'Email already exists', email);
        else this.fail(result, rowNo, msg, email);
      }
    }
    return result;
  }

  private blank(type: ImportType, total: number): ImportResult {
    return { type, total, imported: 0, skipped: 0, failed: 0, errors: [] };
  }

  private fail(r: ImportResult, row: number, reason: string, email?: string) {
    r.failed++;
    r.errors.push({ row, reason, email });
  }

  private skip(r: ImportResult, row: number, reason: string, email?: string) {
    r.skipped++;
    r.errors.push({ row, reason, email });
  }
}
