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
import { Gender } from '../../shared/entities/gender.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ClientsService } from '../clients/clients.service';
import { WorkersService } from '../workers/workers.service';
import { PartnersService } from '../partners/partners.service';
import { EmployersService } from '../employers/employers.service';
import { parseCsv, normalizeKey, decodeCsvBuffer } from './csv-parser';

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
    @InjectRepository(Gender) private readonly genderRepo: Repository<Gender>,
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

    const rows = parseCsv(decodeCsvBuffer(file.buffer));
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
            responsible: this.field(row, ['Responsable', 'responsible']),
            address: this.field(row, ['Dirección', 'Direccion', 'address']),
            floorDoor: this.field(row, ['Piso&Portal', 'Piso y Portal', 'floorDoor']),
            city: this.field(row, ['Localidad', 'city']),
            province: this.field(row, ['Provincia', 'province']),
            country: this.field(row, ['País', 'Pais', 'country']),
            postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
            mobile: this.field(row, ['Móvil', 'Movil', 'mobile']),
            landline: this.field(row, ['Teléfono', 'Telefono', 'landline']),
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
      const nombre = this.field(row, ['Nombre', 'name']);
      const apellidos = this.field(row, ['Apellidos', 'lastName']);
      const combined = this.field(row, ['Apellidos&Nombre', 'Apellidos y Nombre', 'Apellidos Nombre', 'fullName']);
      const name = nombre || combined;
      const lastName = nombre ? apellidos : '';
      const email = this.field(row, ['Email', 'correo']).toLowerCase();
      const employerText = this.field(row, ['Empleador', 'employer']);

      if (!name) { this.fail(result, rowNo, 'Nombre / Apellidos&Nombre is required', email); continue; }
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

      const genderId = await this.resolveGenderId(this.field(row, ['Sexo', 'gender', 'sex']))
      try {
        await this.workersService.createByEmployer(
          {
            name,
            lastName,
            email,
            code: this.field(row, ['Código', 'Codigo', 'code']) || `IMP-W-${Date.now()}-${rowNo}`,
            nif: this.field(row, ['NIF', 'nif']),
            occupation: this.field(row, ['Ocupación', 'Ocupacion', 'occupation']),
            gender: genderId != null ? String(genderId) : undefined,
            birthday: this.parseDate(this.field(row, ['F. Nacimiento', 'Fecha Nacimiento', 'F Nacimiento', 'birthday'])),
            address: this.field(row, ['Dirección', 'Direccion', 'address']),
            floorDoor: this.field(row, ['Piso&Portal', 'Piso y Portal', 'floorDoor']),
            city: this.field(row, ['Localidad', 'city']),
            province: this.field(row, ['Provincia', 'province']),
            country: this.field(row, ['País', 'Pais', 'country']),
            postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
            mobile: this.field(row, ['Móvil', 'Movil', 'mobile']),
            landline: this.field(row, ['Teléfono', 'Telefono', 'landline']),
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

  private employerTypeName(text: string): string | null {
    const map: Record<string, string> = {
      home: 'HOME', hogar: 'HOME', domicilio: 'HOME',
      static: 'STATIC', estatico: 'STATIC', fijo: 'STATIC',
      remote: 'REMOTE', remoto: 'REMOTE',
    };
    return map[normalizeKey(text)] ?? null;
  }

  private employerSubTypeName(text: string): string | null {
    const map: Record<string, string> = {
      individual: 'INDIVIDUAL', particular: 'INDIVIDUAL', particulares: 'INDIVIDUAL',
      freelancer: 'FREELANCER', freelance: 'FREELANCER', autonomo: 'FREELANCER', autonomos: 'FREELANCER',
      company: 'COMPANY', empresa: 'COMPANY', empresas: 'COMPANY', compania: 'COMPANY',
    };
    return map[normalizeKey(text)] ?? null;
  }

  // Clase (subtype) ↔ Tarifa (type) coherence the client requires:
  // Particular→Home, Empresa/Autónomo→Static|Remote.
  private isCoherentEmployer(sub: string, type: string): boolean {
    if (sub === 'INDIVIDUAL') return type === 'HOME';
    return type === 'STATIC' || type === 'REMOTE';
  }

  private async resolveGenderId(text: string): Promise<number | null> {
    if (!text) return null;
    const map: Record<string, string> = {
      male: 'MALE', hombre: 'MALE', h: 'MALE', masculino: 'MALE', m: 'MALE', man: 'MALE',
      female: 'FEMALE', mujer: 'FEMALE', f: 'FEMALE', femenino: 'FEMALE', woman: 'FEMALE',
    };
    const enumVal = map[normalizeKey(text)];
    if (!enumVal) return null;
    const row = await this.genderRepo.findOne({ where: { name: enumVal as any } });
    return row?.id ?? null;
  }

  private parseDate(v: string): string | undefined {
    if (!v) return undefined;
    const s = v.trim();
    const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return undefined;
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
      const mobile = this.field(row, ['Móvil', 'Movil', 'mobile']);
      const nif = this.field(row, ['NIF', 'nif', 'cif']);
      const typeOfPartner = this.resolvePartnerType(this.field(row, ['Tipo', 'type']));

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!address) { this.fail(result, rowNo, 'Dirección is required', email); continue; }
      if (!mobile) { this.fail(result, rowNo, 'Móvil is required', email); continue; }
      if (!nif) { this.fail(result, rowNo, 'NIF is required', email); continue; }
      if (!typeOfPartner) { this.fail(result, rowNo, 'Unknown/empty Tipo (Gold/Silver/Bronze/Affiliate)', email); continue; }

      // Tier is derived from Tipo (Gold/Silver/Bronze/Affiliate match a partner tier of the same name).
      const tier = tierByKey.get(normalizeKey(typeOfPartner)) ?? (tiers.length === 1 ? tiers[0] : undefined);
      if (!tier) { this.fail(result, rowNo, `No partner tier matching Tipo "${typeOfPartner}"`, email); continue; }

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
          landline: this.field(row, ['Teléfono', 'Telefono', 'landline']),
          nif,
          responsible: this.field(row, ['Responsable', 'responsible']),
          typeOfPartner,
          partnerTierId: tier.id,
          commission: this.parseNum(this.field(row, ['Comisión', 'Comision', 'commission'])),
          retention: this.parseNum(this.field(row, ['Retención', 'Retencion', 'retention'])),
          paymentMethod: 'Transfer',
          floorDoor: this.field(row, ['Piso&Puerta', 'Piso y Puerta', 'floorDoor']),
          postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
          city: this.field(row, ['Localidad', 'city']),
          province: this.field(row, ['Provincia', 'province']),
          country: this.field(row, ['País', 'Pais', 'country']),
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
      const subTypeName = this.employerSubTypeName(this.field(row, ['Clase', 'class', 'SubTipo', 'subType']));
      const typeName = this.employerTypeName(this.field(row, ['Tarifa', 'Tipo', 'type']));

      if (!name) { this.fail(result, rowNo, 'Nombre is required', email); continue; }
      if (!taxId) { this.fail(result, rowNo, 'NIF is required', email); continue; }
      if (!address) { this.fail(result, rowNo, 'Dirección is required', email); continue; }
      if (!this.isValidEmail(email)) { this.fail(result, rowNo, 'A valid Email is required', email); continue; }
      if (!partnerText) { this.fail(result, rowNo, 'Partner is required', email); continue; }

      const partner = partnerByKey.get(normalizeKey(partnerText));
      if (!partner) { this.fail(result, rowNo, `Partner "${partnerText}" not found`, email); continue; }

      if (!subTypeName) { this.fail(result, rowNo, 'Unknown/empty Clase (Particular/Empresa/Autónomo)', email); continue; }
      if (!typeName) { this.fail(result, rowNo, 'Unknown/empty Tarifa (Home/Static/Remote)', email); continue; }
      if (!this.isCoherentEmployer(subTypeName, typeName)) {
        this.fail(result, rowNo, 'Incoherent Clase/Tarifa: Particular→Home, Empresa/Autónomo→Static or Remote', email);
        continue;
      }

      const discount = this.parseNum(this.field(row, ['%Dto', '% Dto', 'Dto', 'discount']));
      if (discount > Number(partner.commission ?? 0)) {
        this.fail(result, rowNo, `%Dto (${discount}) exceeds partner commission (${partner.commission})`, email);
        continue;
      }

      const [typeRow, subTypeRow] = await Promise.all([
        this.employerTypeRepo.findOne({ where: { name: typeName as any } }),
        this.employerSubTypeRepo.findOne({ where: { name: subTypeName as any } }),
      ]);
      if (!typeRow || !subTypeRow) { this.fail(result, rowNo, 'Employer type/sub-type not configured in system', email); continue; }

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
          typeId: typeRow.id,
          subTypeId: subTypeRow.id,
          discount,
          probationPeriod: this.field(row, ['Prueba', 'probationPeriod']),
          user: { email },
          floorDoor: this.field(row, ['Piso&Portal', 'Piso y Portal', 'floorDoor']),
          postalCode: this.field(row, ['Código Postal', 'Codigo Postal', 'postalCode', 'cp']),
          city: this.field(row, ['Localidad', 'city']),
          province: this.field(row, ['Provincia', 'province']),
          country: this.field(row, ['País', 'Pais', 'country']),
          mobile: this.field(row, ['Móvil', 'Movil', 'mobile']),
          landline: this.field(row, ['Teléfono', 'Telefono', 'landline']),
          phone: this.field(row, ['Teléfono', 'Telefono', 'phone']),
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
