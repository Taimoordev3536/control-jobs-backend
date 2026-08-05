
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DateTime } from 'luxon';
import { createHash } from 'crypto';
import { ManualAttendanceRequest } from '../manual-attendance/entities/manual-attendance-request.entity';
import { ManualAttendanceRequestType } from '../manual-attendance/enums/request-type.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { convertDurationToMinutes, convertMinutesToDuration } from './helpers/duration-converter';
import { madridNow, madridTodayKey, madridCivilToday } from '../../common/helpers/business-time';

// Mock WorkCenter data (used for every client)
const MOCK_WORK_CENTER = { id: 1, name: 'WorkCenter 1' };
import { Repository, DataSource, IsNull, In, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Job } from './entities/job.entity';
import { Shift, Weekday, ScheduleType } from './entities/shift.entity';
import { SigningMethod, SigningMethodType, SigningMethodDetail } from './entities/signing-method.entity';
import { Alert, AlertType } from './entities/alert.entity';
import { Task } from './entities/task.entity';
import { TaskHistory } from './entities/task-history.entity';
import { ScanLog } from './entities/scan-log.entity';
import { WorkSession } from './entities/work-session.entity';
import { SeasonPeriod } from './entities/season-period.entity';
import { SeasonalSchedule } from './entities/seasonal-schedule.entity';
import { ShiftInstance } from './entities/shift-instance.entity';
import { Worker } from '../workers/entities/worker.entity';
import { Client } from '../clients/entities/client.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { EmployerHoliday } from '../employers/entities/employer-holiday.entity';
import { AbsenceRequest } from '../absences/entities/absence-request.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Survey } from '../survey/entities/survey.entity';
import { SurveyResponse } from '../survey/entities/survey-response.entity';
import { JobTasksTabItemDto } from './dto/job-tasks-tab.dto';
import { User } from '../users/entities/user.entity';
import { RecordScanDto } from './dto/scan.dto';
import { v4 as uuidv4 } from 'uuid';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './enums/job-status.enum';

/** Art. 34.9 ET keeps the daily record for four years. */
export const ATTENDANCE_RETENTION_YEARS = 4;
import * as QRCode from 'qrcode';
import { AlertsService } from '../realtime/alerts.service';
import { QrValidationService } from '../qr-code/services/qr-validation.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { WebauthnService } from '../webauthn/webauthn.service';
import { QrMerger } from '../qr-code/helpers/qr-merger';
import { JobScheduleService } from './services/job-schedule.service';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(SigningMethod) private signingMethodRepo: Repository<SigningMethod>,
    @InjectRepository(Alert) private alertRepo: Repository<Alert>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(TaskHistory) private taskHistoryRepo: Repository<TaskHistory>,
    @InjectRepository(ScanLog) private scanLogRepo: Repository<ScanLog>,
    @InjectRepository(WorkSession) private workSessionRepo: Repository<WorkSession>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    // @InjectRepository(WorkCenter) private workCenterRepo: Repository<WorkCenter> // Commented: API WorkCenter logic
    @InjectRepository(Employer) private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerWorker) private employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(EmployerHoliday) private employerHolidayRepo: Repository<EmployerHoliday>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
  @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(ManualAttendanceRequest) private manualRequestRepo: Repository<ManualAttendanceRequest>,
    private dataSource: DataSource,
    private alertsService: AlertsService,
    private qrValidationService: QrValidationService,
    private jobScheduleService: JobScheduleService,
    private cloudinaryService: CloudinaryService,
    private webauthnService: WebauthnService,
  ) {}

  // The platform serves the Spanish market, so all wall-clock display/comparison
  // is anchored to Europe/Madrid regardless of where the server or viewer runs.
  private static readonly BUSINESS_TZ = 'Europe/Madrid';
  private madridTime(d?: Date | string | null): string {
    if (!d) return '';
    return DateTime.fromJSDate(new Date(d)).setZone(JobService.BUSINESS_TZ).toFormat('HH:mm');
  }
  private madridDate(d?: Date | string | null): string {
    if (!d) return '';
    return DateTime.fromJSDate(new Date(d)).setZone(JobService.BUSINESS_TZ).toFormat('dd/MM/yyyy');
  }
  private madridDateKey(d?: Date | string | null): string {
    if (!d) return '';
    return DateTime.fromJSDate(new Date(d)).setZone(JobService.BUSINESS_TZ).toFormat('yyyy-MM-dd');
  }
  private madridMinutes(d?: Date | string | null): number {
    if (!d) return 0;
    const m = DateTime.fromJSDate(new Date(d)).setZone(JobService.BUSINESS_TZ);
    return m.hour * 60 + m.minute;
  }

  async resolvePublicId(publicId: string): Promise<number> {
    const where: any = isUUID(publicId) ? { publicId } : { id: Number(publicId) };
    const job = await this.jobRepo.findOne({ where });
    if (!job) throw new NotFoundException('Job not found');
    return job.id;
  }

  async resolveWorkerPublicId(publicId: string): Promise<number> {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker.id;
  }

  async resolveTaskPublicId(publicId: string): Promise<number> {
    const where: any = isUUID(publicId) ? { publicId } : { id: Number(publicId) };
    const task = await this.taskRepo.findOne({ where });
    if (!task) throw new NotFoundException('Task not found');
    return task.id;
  }

  async resolveClientPublicId(idOrPublicId: string): Promise<number> {
    // Special sentinel: "employer-self" means the employer selected themselves
    if (idOrPublicId === 'employer-self') {
      return -1;
    }
    if (isUUID(idOrPublicId)) {
      // Try client table first
      const client = await this.clientRepo.findOne({ where: { publicId: idOrPublicId } });
      if (client) return client.id;
      // If not found in clients, check if it's an employer publicId (employer-as-client)
      const employer = await this.dataSource.getRepository(Employer).findOne({ where: { publicId: idOrPublicId } });
      if (employer) return -(employer.id); // negative sentinel for employer selection
      throw new NotFoundException(`Client ${idOrPublicId} not found`);
    }
    // Backwards compatibility: accept numeric string (including negative sentinel)
    const num = parseInt(idOrPublicId, 10);
    if (isNaN(num)) throw new NotFoundException(`Invalid clientId: ${idOrPublicId}`);
    return num;
  }

  async resolveWorkSessionPublicId(publicId: string): Promise<number> {
    const ws = await this.workSessionRepo.findOne({ where: { publicId } });
    if (!ws) throw new NotFoundException(`WorkSession ${publicId} not found`);
    return ws.id;
  }

  async resolveWorkCenterPublicId(idOrPublicId: string): Promise<number> {
    // Sentinel values -1 (In itinere - In) and -2 (In itinere - Out) bypass UUID resolution
    const num = Number(idOrPublicId);
    if (num === -1 || num === -2) return num;
    if (isUUID(idOrPublicId)) {
      const wc = await this.dataSource.getRepository(WorkCenter).findOne({ where: { publicId: idOrPublicId } });
      if (!wc) throw new NotFoundException(`WorkCenter ${idOrPublicId} not found`);
      return wc.id;
    }
    // Backwards compatibility: accept numeric string
    if (!isNaN(num)) return num;
    throw new NotFoundException(`Invalid workCenterId: ${idOrPublicId}`);
  }

  // create job api
  async createJob(createJobDto: CreateJobDto, employerUserId: number): Promise<Job> {
    let job: Job;
    await this.dataSource.transaction(async manager => {
      // Find EmployerUser link for the current user
      const employerUserLink = await manager.findOne(EmployerUser, {
        where: { user: { id: employerUserId } },
        relations: ['employer'],
      });
      if (!employerUserLink || !employerUserLink.employer) {
        throw new Error('Employer not found for this user');
      }
      const employer = employerUserLink.employer;

      let client: Client | null = null;
      // Support negative clientId as the employer sentinel (e.g. -<employerId>)
      let isEmployerSelection = false;
      if (createJobDto.clientId != null) {
        // Resolve UUID publicId or numeric string to internal numeric ID
        const cid = await this.resolveClientPublicId(String(createJobDto.clientId));

        if (cid > 0) {
          client = await manager.findOne(Client, { where: { id: cid } });
          if (!client) {
            throw new Error(`Client with id ${cid} not found`);
          }
        } else if (cid < 0) {
          // negative id indicates the employer itself was selected as the "client"
          const selectedEmployerId = Math.abs(cid);
          // ensure the employer matches the authenticated employer
          if (selectedEmployerId !== employer.id) {
            throw new Error('Invalid employer selection');
          }
          isEmployerSelection = true;
          // leave client as null (job belongs to employer)
        }
      }

      // Determine work centers to attach to the job. Support multiple workCenterIds from DTO.
      let workCentersToAttach: WorkCenter[] = [];

      if (createJobDto.workCenterIds && Array.isArray(createJobDto.workCenterIds) && createJobDto.workCenterIds.length) {
        // Resolve each workCenterId (UUID or numeric) to internal numeric ID
        const resolvedWcIds = await Promise.all(
          createJobDto.workCenterIds.map(id => this.resolveWorkCenterPublicId(String(id)))
        );
        const wcs = await manager.findBy(WorkCenter, { id: In(resolvedWcIds) });
        if (!wcs || wcs.length !== resolvedWcIds.length) {
          const foundIds = new Set((wcs || []).map((w) => w.id));
          const missing = resolvedWcIds.filter((id) => !foundIds.has(id));
          throw new Error(`WorkCenter(s) not found: ${missing.join(', ')}`);
        }
        workCentersToAttach = wcs;
      } else if (client) {
        // Try to find a default/mock work center by id
        let defaultWc = await manager.findOne(WorkCenter, { where: { id: MOCK_WORK_CENTER.id } });
        if (!defaultWc) {
          defaultWc = manager.create(WorkCenter, {
            name: MOCK_WORK_CENTER.name,
            address: 'Auto-created work center',
            contactName: null,
            contactPhone: null,
            contactEmail: null,
            clientId: client.id,
          });
          await manager.save(defaultWc);
        }
        workCentersToAttach = [defaultWc];
      } else if (isEmployerSelection) {
        // Try to find an existing work center for this employer
        let employerWc = await manager.findOne(WorkCenter, { where: { employer: { id: employer.id } } });
        if (!employerWc) {
          employerWc = manager.create(WorkCenter, {
            name: MOCK_WORK_CENTER.name,
            address: 'Auto-created employer work center',
            contactName: null,
            contactPhone: null,
            contactEmail: null,
            employer: employer,
            clientId: null,
          });
          await manager.save(employerWc);
        }
        workCentersToAttach = [employerWc];
      }

      // Load workers referenced in DTO (resolve UUID publicIds to numeric IDs)
      let workers: Worker[] = [];
      if (createJobDto.workerIds && createJobDto.workerIds.length) {
        const resolvedWorkerIds = await Promise.all(
          createJobDto.workerIds.map(id => this.resolveWorkerPublicId(String(id)))
        );
        workers = await manager.findBy(Worker, { id: In(resolvedWorkerIds) });
      }

      // Normalize scheduleType coming from frontend to the backend ScheduleType enum.
      // Frontend historically uses values like 'programming' and 'free' or 'flexible'.
      const rawScheduleType: any = createJobDto.scheduleType;
      let normalizedScheduleType: ScheduleType = ScheduleType.FREE;
      if (typeof rawScheduleType !== 'undefined' && rawScheduleType !== null) {
        const s = String(rawScheduleType).toLowerCase();
        if (s === 'programming' || s === 'fixed') normalizedScheduleType = ScheduleType.FIXED;
        else if (s === 'free' || s === 'flexible') normalizedScheduleType = ScheduleType.FREE;
        else if (s === 'seasonal') normalizedScheduleType = ScheduleType.SEASONAL;
        else {
          // fallback: if DTO already contains a valid enum value, use it; otherwise default to FREE
          if ((Object.values(ScheduleType) as string[]).includes(s)) {
            normalizedScheduleType = s as ScheduleType;
          } else {
            normalizedScheduleType = ScheduleType.FREE;
          }
        }
      }

      // Create job
      job = manager.create(Job, {
        jobName: createJobDto.jobName,
        startDate: createJobDto.startDate,
        endDate: createJobDto.endDate,
        employer,
        client: client || null,
        workCenters: workCentersToAttach,
        workers,
        note: createJobDto.note,
        status: createJobDto.status || JobStatus.SCHEDULED, // Default to SCHEDULED if not provided
        scheduleType: normalizedScheduleType,
      });
      await manager.save(job);

      // Backwards compatibility: if the legacy job."workCenterId" column exists in the DB
      // keep it populated with the first selected work center id so older queries/apps can still read it.
      try {
        if (workCentersToAttach && workCentersToAttach.length > 0) {
          const firstWcId = workCentersToAttach[0].id;
          await manager.query('UPDATE "job" SET "workCenterId" = $1 WHERE id = $2', [firstWcId, job.id]);
        }
      } catch (err) {
        // Log but don't fail the job creation; the join table is the canonical mapping.
        console.warn('Failed to update legacy job.workCenterId column:', err?.message || err);
      }

      // Persist season periods (if provided)
      if (createJobDto.seasonPeriods && Array.isArray(createJobDto.seasonPeriods)) {
        for (const periodDto of createJobDto.seasonPeriods) {
          try {
            // Ensure the DTO contains valid values; CreateSeasonPeriodDto enforces ISO strings.
            const sp = manager.create(SeasonPeriod, {
              job,
              season: periodDto.season,
              // TypeORM will accept a Date or a date string for a column typed as 'date'.
              startDate: periodDto.startDate,
              endDate: periodDto.endDate,
            });
            await manager.save(sp);
          } catch (err) {
            // If a single season period is invalid, log and continue with others;
            // the DTO validation should normally prevent invalid values from reaching here.
            console.warn('Failed to save season period for job', job?.id, err?.message || err);
          }
        }
      }
      // Persist seasonalSchedules (new weekly schedules) if provided
      if (createJobDto.seasonalSchedules && Array.isArray(createJobDto.seasonalSchedules)) {
        for (const ssDto of createJobDto.seasonalSchedules) {
          try {
            // Normalize DD/MM -> DD-MM and ensure format
            const normalizeDayMonth = (v: any): string | null => {
              if (!v) return null;
              let s = String(v).trim();
              if (/^\d{2}\/\d{2}$/.test(s)) s = s.replace('/', '-');
              if (!/^\d{2}-\d{2}$/.test(s)) return null;
              const [dd, mm] = s.split('-').map(n => Number(n));
              if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
              return `${String(dd).padStart(2,'0')}-${String(mm).padStart(2,'0')}`;
            };
            const startDayMonth = normalizeDayMonth(ssDto.startDate);
            const endDayMonth = normalizeDayMonth(ssDto.endDate);
            const ssEntity = manager.create(SeasonalSchedule, {
              job,
              season: ssDto.season,
              startDate: startDayMonth,
              endDate: endDayMonth,
            });
            await manager.save(ssEntity);

            // persist each weekly shift
            let totalWeekHours = 0;
            for (const w of ssDto.shifts || []) {
              const shiftEnt = manager.create(Shift, {
                seasonalSchedule: ssEntity,
                startWeekday: w.startWeekday,
                endWeekday: w.endWeekday,
                baseStartTime: w.baseStartTime,
                baseEndTime: w.baseEndTime,
                isContinuous: !!w.isContinuous,
                totalHours: typeof w.totalHours === 'number' ? w.totalHours : null,
              });
              await manager.save(shiftEnt);
              // Sum the shift's REAL length rather than its whole-hour
              // totalHours. Flooring each shift and then adding lost up to
              // 59 minutes per shift per week (5 x 8h30 reported as 40h,
              // not 42h30).
              totalWeekHours += this.jobScheduleService.getShiftSpanMinutes(
                w.startWeekday,
                w.baseStartTime,
                w.endWeekday,
                w.baseEndTime,
              ) / 60;
            }

            // persist computed total_week_hours on seasonal schedule
            ssEntity.totalWeekHours = totalWeekHours;
            await manager.save(ssEntity);
          } catch (err) {
            console.warn('Failed to save seasonal schedule for job', job?.id, err?.message || err);
          }
        }
      }
      // Shifts
      for (const shiftDto of createJobDto.shifts || []) {
        // Normalize and validate day against Weekday enum (shiftDto.day may be a string)
        let dayValue: Weekday | undefined = undefined;
        if (shiftDto.day) {
          const d = String(shiftDto.day).toLowerCase();
          if ((Object.values(Weekday) as string[]).includes(d)) {
            dayValue = d as Weekday;
          }
        }

        // Only set season if value is 'summer' or 'winter'.
        const shiftPayload: any = { ...shiftDto, job };
        if (dayValue) shiftPayload.day = dayValue;
        if (
          typeof shiftPayload.season !== 'undefined' &&
          (shiftPayload.season === null || shiftPayload.season === '' ||
            (shiftPayload.season !== 'summer' && shiftPayload.season !== 'winter'))
        ) {
          delete shiftPayload.season;
        }
        const shift = manager.create(Shift, shiftPayload);
        await manager.save(shift);
      }

      // Signing Methods - normalize incoming payload to match entity enums
      for (const signingDto of createJobDto.signingMethods || []) {
        try {
          const rawType = String(signingDto.methodType || '').toLowerCase();
          // normalize 'laptop' -> 'pc'
          const methodType = rawType === 'laptop' ? SigningMethodType.PC : (rawType === 'pc' ? SigningMethodType.PC : SigningMethodType.MOBILE);

          // normalize details: accept array, comma-separated string, or object of booleans
          let detailsArr: string[] = [];
          const md: any = signingDto.methodDetails;
          if (Array.isArray(md)) {
            detailsArr = md.map((d: any) => String(d).toLowerCase());
          } else if (typeof md === 'string') {
            detailsArr = md.split(',').map(s => String(s).trim().toLowerCase()).filter(Boolean);
          } else if (md && typeof md === 'object') {
            detailsArr = Object.entries(md).filter(([_, v]) => !!v).map(([k]) => String(k).toLowerCase());
          }

          // map common frontend keys to SigningMethodDetail values
          const mappedDetails = detailsArr.map(d => {
            if (d === 'wifi' || d === 'web') return SigningMethodDetail.WEB;
            if (d === 'ip') return SigningMethodDetail.IP;
            if (d === 'gps') return SigningMethodDetail.GPS;
            if (d === 'qrcode' || d === 'qr' || d === 'qr_code') return SigningMethodDetail.QRCODE;
            return d as SigningMethodDetail;
          }).filter(Boolean) as SigningMethodDetail[];

          const signingMethod = manager.create(SigningMethod, {
            job,
            methodType,
            methodDetails: mappedDetails,
            // verifyIdentity is only applicable for mobile devices per product rules
            verifyIdentity: methodType === SigningMethodType.MOBILE ? !!signingDto.verifyIdentity : false,
          });
          await manager.save(signingMethod);
        } catch (err) {
          // don't fail entire job creation for a single malformed signingMethod; log and continue
          console.warn('Failed to save signing method for job', job?.id, err?.message || err);
        }
      }

      // Alerts
      for (const alertDto of createJobDto.alerts || []) {
        const alert = manager.create(Alert, { ...alertDto, job });
        await manager.save(alert);
      }

      // Tasks (optional)
      if (createJobDto.tasks) {
        for (const taskDto of createJobDto.tasks) {
          // Normalize monthly weekday inputs so backend stores canonical 0..6 values
          const payload: any = { ...taskDto, job };

          // Resolve workCenterId from UUID to numeric (sentinel -1/-2 pass through)
          if (payload.workCenterId !== undefined && payload.workCenterId !== null) {
            payload.workCenterId = await this.resolveWorkCenterPublicId(String(payload.workCenterId));
          }

          // Convert expectedDuration from HH:MM format to minutes
          if (payload.expectedDuration !== undefined) {
            payload.expectedDuration = convertDurationToMinutes(payload.expectedDuration);
          }

          const normalizeWeekday = (v: any) => {
            if (v === null || typeof v === 'undefined' || v === '') return null;
            let n = Number(v);
            if (isNaN(n)) return null;
            // allow 1..7 (1=Mon..7=Sun) or 0..6 (0=Sun..6=Sat)
            // convert 7 -> 0 (Sunday), and any >6 -> mod 7
            if (n === 7) n = 0;
            if (n > 6) n = n % 7;
            if (n < 0) n = Math.abs(n) % 7;
            return n;
          }

          if (typeof payload.monthlyStartWeekday !== 'undefined') {
            payload.monthlyStartWeekday = normalizeWeekday(payload.monthlyStartWeekday);
          }
          if (typeof payload.monthlyEndWeekday !== 'undefined') {
            payload.monthlyEndWeekday = normalizeWeekday(payload.monthlyEndWeekday);
          }

          const task = manager.create(Task, payload);
          await manager.save(task);
        }
      }

      // Survey (optional)
      if (createJobDto.survey) {
        const sdto = createJobDto.survey as any;
        // Prefer normalized keys (questionText, rateDigit, greetingText, sendTime) but
        // fall back to legacy keys (title, monitoringValue, description, hour) for compatibility.
        const survey = manager.create(Survey, {
          job,
          employer,
          questionText: typeof sdto.questionText !== 'undefined' && sdto.questionText !== null ? sdto.questionText : (sdto.title || null),
          rateDigit: typeof sdto.rateDigit !== 'undefined' ? Number(sdto.rateDigit) : (typeof sdto.monitoringValue !== 'undefined' ? Number(sdto.monitoringValue) : null),
          textAlertTracking: typeof sdto.textAlertTracking !== 'undefined' ? sdto.textAlertTracking : (sdto.textAlertTracking || null),
          greetingText: typeof sdto.greetingText !== 'undefined' && sdto.greetingText !== null ? sdto.greetingText : (sdto.description || null),
          periodicity: sdto.periodicity || null,
          startDate: sdto.startDate || null,
          endDate: sdto.endDate || null,
          interval: typeof sdto.interval !== 'undefined' ? Number(sdto.interval) : null,
          monthlyDays: sdto.monthlyDays ? JSON.stringify(sdto.monthlyDays) : null,
          monthlyWeekdays: sdto.monthlyWeekdays ? JSON.stringify(sdto.monthlyWeekdays) : null,
          // accept either new "monthlyStartWeekday/monthlyEndWeekday" or legacy "monthlyFirstWeekday/monthlyLastWeekday"
          monthlyStartWeekday: (typeof sdto.monthlyStartWeekday !== 'undefined'
            ? sdto.monthlyStartWeekday
            : (typeof sdto.monthlyFirstWeekday !== 'undefined' ? sdto.monthlyFirstWeekday : null)),
          monthlyEndWeekday: (typeof sdto.monthlyEndWeekday !== 'undefined'
            ? sdto.monthlyEndWeekday
            : (typeof sdto.monthlyLastWeekday !== 'undefined' ? sdto.monthlyLastWeekday : null)),
          sendTime: typeof sdto.sendTime !== 'undefined' && sdto.sendTime !== null ? sdto.sendTime : (sdto.hour || null),
        });
  await manager.save(survey);
      }

      // Customer Survey (optional)
      if (createJobDto.customerSurvey) {
        const cs = createJobDto.customerSurvey as any;
        const customerSurvey = manager.create(Survey, {
          job,
          employer,
          client: client || null,
          questionText: typeof cs.questionText !== 'undefined' && cs.questionText !== null ? cs.questionText : (cs.title || null),
          rateDigit: typeof cs.rateDigit !== 'undefined' ? Number(cs.rateDigit) : (typeof cs.monitoringValue !== 'undefined' ? Number(cs.monitoringValue) : null),
          textAlertTracking: typeof cs.textAlertTracking !== 'undefined' ? cs.textAlertTracking : (cs.textAlertTracking || null),
          greetingText: typeof cs.greetingText !== 'undefined' && cs.greetingText !== null ? cs.greetingText : (cs.description || null),
          periodicity: cs.periodicity || null,
          startDate: cs.startDate || null,
          endDate: cs.endDate || null,
          interval: typeof cs.interval !== 'undefined' ? Number(cs.interval) : null,
          weeklyDays: cs.weeklyDays ? JSON.stringify(cs.weeklyDays) : null,
          monthlyDays: cs.monthlyDays ? JSON.stringify(cs.monthlyDays) : null,
          monthlyWeekdays: cs.monthlyWeekdays ? JSON.stringify(cs.monthlyWeekdays) : null,
          monthlyStartWeekday: (typeof cs.monthlyStartWeekday !== 'undefined'
            ? cs.monthlyStartWeekday
            : (typeof cs.monthlyFirstWeekday !== 'undefined' ? cs.monthlyFirstWeekday : null)),
          monthlyEndWeekday: (typeof cs.monthlyEndWeekday !== 'undefined'
            ? cs.monthlyEndWeekday
            : (typeof cs.monthlyLastWeekday !== 'undefined' ? cs.monthlyLastWeekday : null)),
          sendTime: typeof cs.sendTime !== 'undefined' && cs.sendTime !== null ? cs.sendTime : (cs.hour || null),
        });
  await manager.save(customerSurvey);
      }

      // Worker Survey (optional)
      if (createJobDto.workerSurvey) {
        const ws = createJobDto.workerSurvey as any;
        
        // Link to first worker to identify this as a worker survey
        // (The survey applies to all workers, but we need at least one worker relation for identification)
        const firstWorker = job.workers && job.workers.length > 0 ? job.workers[0] : null;
        
        const workerSurvey = manager.create(Survey, {
          job,
          employer,
          worker: firstWorker, // Add worker relation to identify as worker survey
          questionText: typeof ws.questionText !== 'undefined' && ws.questionText !== null ? ws.questionText : (ws.title || null),
          rateDigit: typeof ws.rateDigit !== 'undefined' ? Number(ws.rateDigit) : (typeof ws.monitoringValue !== 'undefined' ? Number(ws.monitoringValue) : null),
          textAlertTracking: typeof ws.textAlertTracking !== 'undefined' ? ws.textAlertTracking : (ws.textAlertTracking || null),
          greetingText: typeof ws.greetingText !== 'undefined' && ws.greetingText !== null ? ws.greetingText : (ws.description || null),
          periodicity: ws.periodicity || null,
          startDate: ws.startDate || null,
          endDate: ws.endDate || null,
          interval: typeof ws.interval !== 'undefined' ? Number(ws.interval) : null,
          weeklyDays: ws.weeklyDays ? JSON.stringify(ws.weeklyDays) : null,
          monthlyDays: ws.monthlyDays ? JSON.stringify(ws.monthlyDays) : null,
          monthlyWeekdays: ws.monthlyWeekdays ? JSON.stringify(ws.monthlyWeekdays) : null,
          monthlyStartWeekday: (typeof ws.monthlyStartWeekday !== 'undefined'
            ? ws.monthlyStartWeekday
            : (typeof ws.monthlyFirstWeekday !== 'undefined' ? ws.monthlyFirstWeekday : null)),
          monthlyEndWeekday: (typeof ws.monthlyEndWeekday !== 'undefined'
            ? ws.monthlyEndWeekday
            : (typeof ws.monthlyLastWeekday !== 'undefined' ? ws.monthlyLastWeekday : null)),
          sendTime: typeof ws.sendTime !== 'undefined' && ws.sendTime !== null ? ws.sendTime : (ws.hour || null),
        });
  await manager.save(workerSurvey);
      }
    });

    // Fetch with all relations (use seasonalSchedules instead of removed 'shifts' relation)
    return this.jobRepo.findOne({
      where: { id: job.id },
      relations: [
        'employer',
        'client',
        'workCenters',
        'workers',
        'seasonalSchedules',
        'seasonalSchedules.shifts',
        'signingMethods',
        'alerts',
        'tasks',
        'surveys',
      ],
    });
  }


  // get job 
  async getJobByIdForEdit(jobId: number, userId: number): Promise<any> {
    try {
      // Step 1: Determine user type and permissions
      let userType: 'employer' | 'client' | 'worker' | null = null;
      let relatedEntityId: number | null = null;

      // Check if user is an employer
      const employerUser = await this.employerUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['employer'],
      });

      if (employerUser?.employer) {
        userType = 'employer';
        relatedEntityId = employerUser.employer.id;
      }

      // Check if user is a client
      if (!userType) {
        const clientUser = await this.clientUserRepo.findOne({
          where: { user: { id: userId } },
          relations: ['client'],
        });
        if (clientUser?.client) {
          userType = 'client';
          relatedEntityId = clientUser.client.id;
        }
      }

      // Check if user is a worker
      if (!userType) {
        const workerUser = await this.workerUserRepo.findOne({
          where: { user: { id: userId } },
          relations: ['worker'],
        });
        if (workerUser?.worker) {
          userType = 'worker';
          relatedEntityId = workerUser.worker.id;
        }
      }

      if (!userType) {
        throw new Error('User not found or not associated with any role');
      }

      // Step 2: Load job with all relations
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: [
          'employer',
          'client',
          'workCenters',
          'workers',
          'workers.user',
          'signingMethods',
          'alerts',
          'tasks',
          'seasonalSchedules',
          'seasonalSchedules.shifts',
          'surveys',
          'surveys.client',
          'surveys.worker',
        ],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      const workerNames = await this.resolveWorkerNames((job.workers || []).map((w: any) => w.id));

      // Step 3: Validate permissions
      if (userType === 'employer') {
        if (job.employer.id !== relatedEntityId) {
          throw new Error('Permission denied: Job does not belong to your employer account');
        }
      } else if (userType === 'client') {
        if (!job.client || job.client.id !== relatedEntityId) {
          throw new Error('Permission denied: Job is not assigned to your client account');
        }
      } else if (userType === 'worker') {
        const isAssigned = job.workers.some(w => w.id === relatedEntityId);
        if (!isAssigned) {
          throw new Error('Permission denied: You are not assigned to this job');
        }
      }

      // Step 4: Transform job data to match CreateJobDto structure
      const formattedJob = {
        jobName: job.jobName,
        startDate: job.startDate,
        endDate: job.endDate,
        clientId: job.client?.publicId || job.client?.id || null,
        clientName: job.client?.name || null,
        workCenterIds: job.workCenters?.map(wc => wc.publicId || wc.id) || [],
        workerIds: job.workers?.map(w => w.publicId || w.id) || [],
        // Full read-view details (for the Job Detail page; edit form ignores these)
        workCentersDetail: job.workCenters?.map((wc: any) => ({
          id: wc.publicId || wc.id,
          name: wc.name,
          address: wc.address || wc.locality || null,
          isGpsActive: wc.isGpsActive ?? false,
          gpsRadius: wc.gpsRadius ?? null,
          isIpActive: wc.isIpActive ?? false,
          allowedIp: wc.allowedIp || null,
        })) || [],
        workersDetail: job.workers?.map((w: any) => ({
          id: w.publicId || w.id,
          name: workerNames.get(w.id) || w.user?.name || null,
          code: w.code,
          photoUrl: w.logoUrl || null,
        })) || [],
        note: job.note || '',
        status: job.status,
        scheduleType: job.scheduleType,

        // Transform seasonal schedules with nested shifts
        seasonalSchedules: job.seasonalSchedules?.map(ss => ({
          season: ss.season,
          startDate: ss.startDate || null,
          endDate: ss.endDate || null,
          totalWeekHours: ss.totalWeekHours || 0,
          shifts: ss.shifts?.map(shift => ({
            startWeekday: shift.startWeekday,
            endWeekday: shift.endWeekday,
            baseStartTime: shift.baseStartTime,
            baseEndTime: shift.baseEndTime,
            isContinuous: shift.isContinuous || false,
            totalHours: shift.totalHours || null,
          })) || [],
        })) || [],

        // Transform signing methods
        signingMethods: job.signingMethods?.map(sm => ({
          methodType: sm.methodType,
          methodDetails: sm.methodDetails || [],
          verifyIdentity: sm.verifyIdentity || false,
        })) || [],

        // Transform alerts
        alerts: job.alerts?.map(alert => ({
          alertType: alert.alertType,
          triggerTime: alert.triggerTime || null,
          minDuration: alert.minDuration || null,
        })) || [],

        // Transform tasks
        tasks: job.tasks?.map(task => {
          // Resolve numeric workCenterId to publicId using already-loaded workCenters
          let taskWorkCenterId: string | number | null = null;
          if (task.workCenterId != null) {
            const matchedWc = job.workCenters?.find(wc => wc.id === task.workCenterId);
            taskWorkCenterId = matchedWc?.publicId || task.workCenterId;
          }
          return {
          id: task.publicId || task.id,
          name: task.name,
          note: task.note || '',
          expectedDuration: convertMinutesToDuration(task.expectedDuration),
          shift: task.shift || null,
          timing: task.timing,
          periodicity: task.periodicity,
          workCenterId: taskWorkCenterId,
          startDate: task.startDate || null,
          endDate: task.endDate || null,
          interval: task.interval || 1,
          onceDate: task.onceDate || null,
          weeklyDays: task.weeklyDays || null,
          monthlyDays: task.monthlyDays || null,
          monthlyWeekdays: task.monthlyWeekdays || null,
          monthlyStartWeekday: task.monthlyStartWeekday || null,
          monthlyEndWeekday: task.monthlyEndWeekday || null,
          yearlyMonths: task.yearlyMonths || null,
          yearlyDays: task.yearlyDays || null,
          alertTask: task.alertTask || false,
          pendingTask: task.pendingTask || false,
        };
        }) || [],

        // Separate surveys by type
        survey: null,
        customerSurvey: null,
        workerSurvey: null,
      };

      // Parse surveys - identify by client/worker relations
      if (job.surveys && job.surveys.length > 0) {
        for (const survey of job.surveys) {
          const surveyData = {
            questionText: survey.questionText || '',
            rateDigit: survey.rateDigit || null,
            textAlertTracking: survey.textAlertTracking || null,
            greetingText: survey.greetingText || '',
            periodicity: survey.periodicity || null,
            startDate: survey.startDate || null,
            endDate: survey.endDate || null,
            interval: survey.interval || null,
            weeklyDays: survey.weeklyDays || null,
            monthlyDays: survey.monthlyDays || null,
            monthlyWeekdays: survey.monthlyWeekdays || null,
            monthlyStartWeekday: survey.monthlyStartWeekday || null,
            monthlyEndWeekday: survey.monthlyEndWeekday || null,
            sendTime: survey.sendTime || null,
          };

          if (survey.client) {
            // This is a customer survey
            formattedJob.customerSurvey = surveyData;
          } else if (survey.worker) {
            // This is a worker survey
            formattedJob.workerSurvey = surveyData;
          } else {
            // Generic survey (backward compatibility)
            formattedJob.survey = surveyData;
          }
        }
      }

      return formattedJob;
    } catch (error) {
      console.error('Error fetching job for edit:', error);
      throw error;
    }
  }

  async getJobByPublicIdForEdit(publicId: string, userId: number): Promise<any> {
    const job = await this.jobRepo.findOne({ where: { publicId } });
    if (!job) throw new NotFoundException('Job not found');
    return this.getJobByIdForEdit(job.id, userId);
  }


    /**
   * Update an existing job with all related entities
   */
  async updateJob(jobId: number, updateJobDto: UpdateJobDto, employerUserId: number): Promise<Job> {
    let job: Job;
    
    await this.dataSource.transaction(async manager => {
      // Verify user has access to this job
      const employerUserLink = await manager.findOne(EmployerUser, {
        where: { user: { id: employerUserId } },
        relations: ['employer'],
      });
      if (!employerUserLink || !employerUserLink.employer) {
        throw new Error('Employer not found for this user');
      }
      const employer = employerUserLink.employer;

      // Load existing job with all relations
      job = await manager.findOne(Job, {
        where: { id: jobId },
        relations: [
          'employer',
          'client',
          'workCenters',
          'workers',
          'seasonalSchedules',
          'seasonalSchedules.shifts',
          'signingMethods',
          'alerts',
          'tasks',
          'surveys',
        ],
      });

      if (!job) {
        throw new Error(`Job with id ${jobId} not found`);
      }

      // Verify job belongs to the employer
      if (job.employer.id !== employer.id) {
        throw new Error('Unauthorized to update this job');
      }

      // Update basic job fields
      if (updateJobDto.jobName !== undefined) job.jobName = updateJobDto.jobName;
      if (updateJobDto.startDate !== undefined) job.startDate = new Date(updateJobDto.startDate);
      if (updateJobDto.endDate !== undefined) job.endDate = new Date(updateJobDto.endDate);
      if (updateJobDto.note !== undefined) job.note = updateJobDto.note;
      if (updateJobDto.status !== undefined) job.status = updateJobDto.status;

      // Handle scheduleType normalization
      if (updateJobDto.scheduleType !== undefined) {
        const rawScheduleType: any = updateJobDto.scheduleType;
        let normalizedScheduleType: ScheduleType = ScheduleType.FREE;
        if (typeof rawScheduleType !== 'undefined' && rawScheduleType !== null) {
          const s = String(rawScheduleType).toLowerCase();
          if (s === 'programming' || s === 'fixed') normalizedScheduleType = ScheduleType.FIXED;
          else if (s === 'free' || s === 'flexible') normalizedScheduleType = ScheduleType.FREE;
          else if (s === 'seasonal') normalizedScheduleType = ScheduleType.SEASONAL;
          else if ((Object.values(ScheduleType) as string[]).includes(s)) {
            normalizedScheduleType = s as ScheduleType;
          }
        }
        job.scheduleType = normalizedScheduleType;
      }

      // Update client
      if (updateJobDto.clientId !== undefined) {
        if (updateJobDto.clientId === null) {
          job.client = null;
        } else {
          const cid = await this.resolveClientPublicId(String(updateJobDto.clientId));
          if (cid > 0) {
            const client = await manager.findOne(Client, { where: { id: cid } });
            if (!client) throw new Error(`Client with id ${cid} not found`);
            job.client = client;
          } else if (cid < 0) {
            // Employer selection
            const selectedEmployerId = Math.abs(cid);
            if (selectedEmployerId !== employer.id) {
              throw new Error('Invalid employer selection');
            }
            job.client = null;
          }
        }
      }

      // Update work centers
      if (updateJobDto.workCenterIds !== undefined && Array.isArray(updateJobDto.workCenterIds)) {
        if (updateJobDto.workCenterIds.length > 0) {
          const resolvedWcIds = await Promise.all(
            updateJobDto.workCenterIds.map(id => this.resolveWorkCenterPublicId(String(id)))
          );
          const wcs = await manager.findBy(WorkCenter, { id: In(resolvedWcIds) });
          if (wcs.length !== resolvedWcIds.length) {
            const foundIds = new Set(wcs.map(w => w.id));
            const missing = resolvedWcIds.filter(id => !foundIds.has(id));
            throw new Error(`WorkCenter(s) not found: ${missing.join(', ')}`);
          }
          job.workCenters = wcs;
        } else {
          job.workCenters = [];
        }
      }

      // Update workers
      if (updateJobDto.workerIds !== undefined && Array.isArray(updateJobDto.workerIds)) {
        if (updateJobDto.workerIds.length > 0) {
          const resolvedWorkerIds = await Promise.all(
            updateJobDto.workerIds.map(id => this.resolveWorkerPublicId(String(id)))
          );
          const workers = await manager.findBy(Worker, { id: In(resolvedWorkerIds) });
          job.workers = workers;
        } else {
          job.workers = [];
        }
      }

      await manager.save(job);

      // Delete old related entities
      if (job.seasonalSchedules && job.seasonalSchedules.length > 0) {
        for (const ss of job.seasonalSchedules) {
          if (ss.shifts && ss.shifts.length > 0) {
            await manager.remove(ss.shifts);
          }
          await manager.remove(ss);
        }
      }
      
      if (job.signingMethods && job.signingMethods.length > 0) {
        await manager.remove(job.signingMethods);
      }
      
      if (job.alerts && job.alerts.length > 0) {
        await manager.remove(job.alerts);
      }
      
      if (job.tasks && job.tasks.length > 0) {
        // Delete task histories first to avoid foreign key constraint violation
        await manager.delete(TaskHistory, { task: { id: In(job.tasks.map(t => t.id)) } });
        await manager.remove(job.tasks);
      }
      
      if (job.surveys && job.surveys.length > 0) {
        await manager.remove(job.surveys);
      }

      // Create new seasonalSchedules
      if (updateJobDto.seasonalSchedules && Array.isArray(updateJobDto.seasonalSchedules)) {
        for (const ssDto of updateJobDto.seasonalSchedules) {
          try {
            const normalizeDayMonth = (v: any): string | null => {
              if (!v) return null;
              let s = String(v).trim();
              if (/^\d{2}\/\d{2}$/.test(s)) s = s.replace('/', '-');
              if (!/^\d{2}-\d{2}$/.test(s)) return null;
              const [dd, mm] = s.split('-').map(n => Number(n));
              if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
              return `${String(dd).padStart(2,'0')}-${String(mm).padStart(2,'0')}`;
            };
            const startDayMonth = normalizeDayMonth(ssDto.startDate);
            const endDayMonth = normalizeDayMonth(ssDto.endDate);
            const ssEntity = manager.create(SeasonalSchedule, {
              job,
              season: ssDto.season,
              startDate: startDayMonth,
              endDate: endDayMonth,
            });
            await manager.save(ssEntity);

            let totalWeekHours = 0;
            for (const w of ssDto.shifts || []) {
              const shiftEnt = manager.create(Shift, {
                seasonalSchedule: ssEntity,
                startWeekday: w.startWeekday,
                endWeekday: w.endWeekday,
                baseStartTime: w.baseStartTime,
                baseEndTime: w.baseEndTime,
                isContinuous: !!w.isContinuous,
                totalHours: typeof w.totalHours === 'number' ? w.totalHours : null,
              });
              await manager.save(shiftEnt);
              // Same as create: sum real shift length, not the whole-hour field.
              totalWeekHours += this.jobScheduleService.getShiftSpanMinutes(
                w.startWeekday,
                w.baseStartTime,
                w.endWeekday,
                w.baseEndTime,
              ) / 60;
            }

            ssEntity.totalWeekHours = totalWeekHours;
            await manager.save(ssEntity);
          } catch (err) {
            console.warn('Failed to save seasonal schedule for job', job?.id, err?.message || err);
          }
        }
      }

      // Create new shifts (legacy support)
      if (updateJobDto.shifts && Array.isArray(updateJobDto.shifts)) {
        for (const shiftDto of updateJobDto.shifts) {
          let dayValue: Weekday | undefined = undefined;
          if (shiftDto.day) {
            const d = String(shiftDto.day).toLowerCase();
            if ((Object.values(Weekday) as string[]).includes(d)) {
              dayValue = d as Weekday;
            }
          }

          const shiftPayload: any = { ...shiftDto, job };
          if (dayValue) shiftPayload.day = dayValue;
          if (
            typeof shiftPayload.season !== 'undefined' &&
            (shiftPayload.season === null || shiftPayload.season === '' ||
              (shiftPayload.season !== 'summer' && shiftPayload.season !== 'winter'))
          ) {
            delete shiftPayload.season;
          }
          const shift = manager.create(Shift, shiftPayload);
          await manager.save(shift);
        }
      }

      // Create new signing methods
      if (updateJobDto.signingMethods && Array.isArray(updateJobDto.signingMethods)) {
        for (const signingDto of updateJobDto.signingMethods) {
          try {
            const rawType = String(signingDto.methodType || '').toLowerCase();
            const methodType = rawType === 'laptop' ? SigningMethodType.PC : (rawType === 'pc' ? SigningMethodType.PC : SigningMethodType.MOBILE);

            let detailsArr: string[] = [];
            const md: any = signingDto.methodDetails;
            if (Array.isArray(md)) {
              detailsArr = md.map((d: any) => String(d).toLowerCase());
            } else if (typeof md === 'string') {
              detailsArr = md.split(',').map(s => String(s).trim().toLowerCase()).filter(Boolean);
            } else if (md && typeof md === 'object') {
              detailsArr = Object.entries(md).filter(([_, v]) => !!v).map(([k]) => String(k).toLowerCase());
            }

            const mappedDetails = detailsArr.map(d => {
              if (d === 'wifi' || d === 'web') return SigningMethodDetail.WEB;
              if (d === 'ip') return SigningMethodDetail.IP;
              if (d === 'gps') return SigningMethodDetail.GPS;
              if (d === 'qrcode' || d === 'qr' || d === 'qr_code') return SigningMethodDetail.QRCODE;
              return d as SigningMethodDetail;
            }).filter(Boolean) as SigningMethodDetail[];

            const signingMethod = manager.create(SigningMethod, {
              job,
              methodType,
              methodDetails: mappedDetails,
              verifyIdentity: methodType === SigningMethodType.MOBILE ? !!signingDto.verifyIdentity : false,
            });
            await manager.save(signingMethod);
          } catch (err) {
            console.warn('Failed to save signing method for job', job?.id, err?.message || err);
          }
        }
      }

      // Create new alerts
      if (updateJobDto.alerts && Array.isArray(updateJobDto.alerts)) {
        for (const alertDto of updateJobDto.alerts) {
          const alert = manager.create(Alert, { ...alertDto, job });
          await manager.save(alert);
        }
      }

      // Create new tasks
      if (updateJobDto.tasks && Array.isArray(updateJobDto.tasks)) {
        for (const taskDto of updateJobDto.tasks) {
          const payload: any = { ...taskDto, job };

          // Resolve workCenterId from UUID to numeric (sentinel -1/-2 pass through)
          if (payload.workCenterId !== undefined && payload.workCenterId !== null) {
            payload.workCenterId = await this.resolveWorkCenterPublicId(String(payload.workCenterId));
          }

          // Convert expectedDuration from HH:MM format to minutes
          if (payload.expectedDuration !== undefined) {
            payload.expectedDuration = convertDurationToMinutes(payload.expectedDuration);
          }

          const normalizeWeekday = (v: any) => {
            if (v === null || typeof v === 'undefined' || v === '') return null;
            let n = Number(v);
            if (isNaN(n)) return null;
            if (n === 7) n = 0;
            if (n > 6) n = n % 7;
            if (n < 0) n = Math.abs(n) % 7;
            return n;
          }

          if (typeof payload.monthlyStartWeekday !== 'undefined') {
            payload.monthlyStartWeekday = normalizeWeekday(payload.monthlyStartWeekday);
          }
          if (typeof payload.monthlyEndWeekday !== 'undefined') {
            payload.monthlyEndWeekday = normalizeWeekday(payload.monthlyEndWeekday);
          }

          const task = manager.create(Task, payload);
          await manager.save(task);
        }
      }

      // Create new customer survey
      if (updateJobDto.customerSurvey) {
        const cs = updateJobDto.customerSurvey as any;
        const customerSurvey = manager.create(Survey, {
          job,
          employer,
          client: job.client || null,
          questionText: typeof cs.questionText !== 'undefined' && cs.questionText !== null ? cs.questionText : (cs.title || null),
          rateDigit: typeof cs.rateDigit !== 'undefined' ? Number(cs.rateDigit) : (typeof cs.monitoringValue !== 'undefined' ? Number(cs.monitoringValue) : null),
          textAlertTracking: typeof cs.textAlertTracking !== 'undefined' ? cs.textAlertTracking : (cs.textAlertTracking || null),
          greetingText: typeof cs.greetingText !== 'undefined' && cs.greetingText !== null ? cs.greetingText : (cs.description || null),
          periodicity: cs.periodicity || null,
          startDate: cs.startDate || null,
          endDate: cs.endDate || null,
          interval: typeof cs.interval !== 'undefined' ? Number(cs.interval) : null,
          weeklyDays: cs.weeklyDays ? JSON.stringify(cs.weeklyDays) : null,
          monthlyDays: cs.monthlyDays ? JSON.stringify(cs.monthlyDays) : null,
          monthlyWeekdays: cs.monthlyWeekdays ? JSON.stringify(cs.monthlyWeekdays) : null,
          monthlyStartWeekday: (typeof cs.monthlyStartWeekday !== 'undefined'
            ? cs.monthlyStartWeekday
            : (typeof cs.monthlyFirstWeekday !== 'undefined' ? cs.monthlyFirstWeekday : null)),
          monthlyEndWeekday: (typeof cs.monthlyEndWeekday !== 'undefined'
            ? cs.monthlyEndWeekday
            : (typeof cs.monthlyLastWeekday !== 'undefined' ? cs.monthlyLastWeekday : null)),
          sendTime: typeof cs.sendTime !== 'undefined' && cs.sendTime !== null ? cs.sendTime : (cs.hour || null),
        });
        await manager.save(customerSurvey);
      }

      // Create new worker survey
      if (updateJobDto.workerSurvey) {
        const ws = updateJobDto.workerSurvey as any;
        const firstWorker = job.workers && job.workers.length > 0 ? job.workers[0] : null;
        
        const workerSurvey = manager.create(Survey, {
          job,
          employer,
          worker: firstWorker,
          questionText: typeof ws.questionText !== 'undefined' && ws.questionText !== null ? ws.questionText : (ws.title || null),
          rateDigit: typeof ws.rateDigit !== 'undefined' ? Number(ws.rateDigit) : (typeof ws.monitoringValue !== 'undefined' ? Number(ws.monitoringValue) : null),
          textAlertTracking: typeof ws.textAlertTracking !== 'undefined' ? ws.textAlertTracking : (ws.textAlertTracking || null),
          greetingText: typeof ws.greetingText !== 'undefined' && ws.greetingText !== null ? ws.greetingText : (ws.description || null),
          periodicity: ws.periodicity || null,
          startDate: ws.startDate || null,
          endDate: ws.endDate || null,
          interval: typeof ws.interval !== 'undefined' ? Number(ws.interval) : null,
          weeklyDays: ws.weeklyDays ? JSON.stringify(ws.weeklyDays) : null,
          monthlyDays: ws.monthlyDays ? JSON.stringify(ws.monthlyDays) : null,
          monthlyWeekdays: ws.monthlyWeekdays ? JSON.stringify(ws.monthlyWeekdays) : null,
          monthlyStartWeekday: (typeof ws.monthlyStartWeekday !== 'undefined'
            ? ws.monthlyStartWeekday
            : (typeof ws.monthlyFirstWeekday !== 'undefined' ? ws.monthlyFirstWeekday : null)),
          monthlyEndWeekday: (typeof ws.monthlyEndWeekday !== 'undefined'
            ? ws.monthlyEndWeekday
            : (typeof ws.monthlyLastWeekday !== 'undefined' ? ws.monthlyLastWeekday : null)),
          sendTime: typeof ws.sendTime !== 'undefined' && ws.sendTime !== null ? ws.sendTime : (ws.hour || null),
        });
        await manager.save(workerSurvey);
      }
    });

    // Return updated job with all relations
    return this.jobRepo.findOne({
      where: { id: job.id },
      relations: [
        'employer',
        'client',
        'workCenters',
        'workers',
        'seasonalSchedules',
        'seasonalSchedules.shifts',
        'signingMethods',
        'alerts',
        'tasks',
        'surveys',
      ],
    });
  }

//**********DELETE JOB ********

async deleteJob(jobId: number, employerUserId: number): Promise<void> {
  await this.dataSource.transaction(async manager => {
    // Verify the user has permission to delete this job
    const employerUserLink = await manager.findOne(EmployerUser, {
      where: { user: { id: employerUserId } },
      relations: ['employer'],
    });
    
    if (!employerUserLink || !employerUserLink.employer) {
      throw new Error('Employer not found for this user');
    }

    // Verify the job belongs to this employer
    const job = await manager.findOne(Job, {
      where: { id: jobId, employer: { id: employerUserLink.employer.id } },
      relations: ['employer'],
    });

    if (!job) {
      throw new Error('Job not found or you dont have permission to delete it');
    }

    // Art. 34.9 ET: the daily record has to survive four years. Deleting the
    // job used to take its scan logs and work sessions with it, which is the
    // one thing that must not happen. A job nobody clocked into is still
    // deletable; one with records inside the window is archived instead.
    const [{ count }] = await manager.query(
      `SELECT COUNT(*)::int AS count FROM work_sessions
        WHERE job_id = $1
          AND check_in_time >= (NOW() - INTERVAL '${ATTENDANCE_RETENTION_YEARS} years')`,
      [jobId],
    );
    if (count > 0) {
      throw new BadRequestException(
        `This job has ${count} attendance record${count === 1 ? '' : 's'} from the last ` +
          `${ATTENDANCE_RETENTION_YEARS} years, which must be kept (art. 34.9 ET). ` +
          `Set the job to finished instead of deleting it.`,
      );
    }

    // Delete dependent entities first (in reverse order of creation)
    
    // 1. Delete survey responses (worker/client survey submissions)
    await manager.delete(SurveyResponse, { job: { id: jobId } });

    // 2. Delete survey questions and surveys
    const surveys = await manager.find(Survey, { where: { job: { id: jobId } } });
    for (const survey of surveys) {
      // questions are embedded in the survey row now, so just delete the survey
      await manager.delete(Survey, { id: survey.id });
    }

    // 3. Delete task history (completed task records)
    await manager.delete(TaskHistory, { job: { id: jobId } });

    // 4. Delete tasks
    await manager.delete(Task, { job: { id: jobId } });

    // 5. Delete alerts
    await manager.delete(Alert, { job: { id: jobId } });

    // 6. Delete signing methods
    await manager.delete(SigningMethod, { job: { id: jobId } });

    // 7. Delete shift instances (actual shift occurrences/records)
    await manager.delete(ShiftInstance, { job: { id: jobId } });

    // 8. Delete seasonal schedules and their shifts (schedule definitions)
    const seasonalSchedules = await manager.find(SeasonalSchedule, { where: { job: { id: jobId } }, relations: ['shifts'] });
    for (const ss of seasonalSchedules) {
      if (ss.shifts && ss.shifts.length > 0) {
        const shiftIds = ss.shifts.map(s => s.id).filter(Boolean) as number[];
        if (shiftIds.length) {
          await manager.delete(Shift, shiftIds);
        }
      }
      await manager.delete(SeasonalSchedule, { id: ss.id });
    }

    // 9. Delete season periods associated with this job
    await manager.delete(SeasonPeriod, { job: { id: jobId } });

    // 10. Delete scan logs and work sessions
    await manager.delete(ScanLog, { job: { id: jobId } });
    await manager.delete(WorkSession, { job: { id: jobId } });

    // Finally, delete the job itself
    await manager.delete(Job, { id: jobId });
  });
}


  /**
   * Get all shift recurrences for a job (for weekly schedule display)
   */
  async getJobShiftRecurrences(jobId: number): Promise<any[]> {
    // Get job with seasonal schedules and their shifts
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: [
        'seasonalSchedules',
        'seasonalSchedules.shifts',
      ],
    });
    if (!job) throw new Error('Job not found');

    // Monday-first, matching WEEKDAY_ORDER in JobScheduleService so every
    // weekday index in the codebase means the same thing. The expansion below
    // counts forward from the shift's own start weekday, so the result is the
    // same either way — this is for consistency, not correctness.
    const weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Group shifts by season and include startDate/endDate
    const output: any = {};
    if (job.seasonalSchedules && job.seasonalSchedules.length) {
      for (const ss of job.seasonalSchedules) {
        if (ss.shifts && ss.shifts.length) {
          const shifts = ss.shifts.map(shift => {
            const startIdx = weekdayOrder.indexOf(String(shift.startWeekday).toLowerCase());
            const endIdx = weekdayOrder.indexOf(String(shift.endWeekday).toLowerCase());
            if (startIdx === -1 || endIdx === -1) return null;

            // Days the shift spans, counted forward from its start weekday so a
            // wrapping range (Friday -> Monday) expands correctly. The old
            // `for (i = startIdx + 1; i < endIdx; i++)` never ran when the
            // range wrapped, silently dropping every day in between.
            const dayGap = (endIdx - startIdx + 7) % 7;
            let days = [];
            if (dayGap === 0) {
              days.push({
                day: weekdayOrder[startIdx],
                startTime: shift.baseStartTime,
                endTime: shift.baseEndTime,
              });
            } else {
              days.push({
                day: weekdayOrder[startIdx],
                startTime: shift.baseStartTime,
                endTime: '24:00',
              });
              for (let k = 1; k < dayGap; k++) {
                days.push({
                  day: weekdayOrder[(startIdx + k) % 7],
                  startTime: '00:00',
                  endTime: '24:00',
                });
              }
              days.push({
                day: weekdayOrder[endIdx],
                startTime: '00:00',
                endTime: shift.baseEndTime,
              });
            }
            return {
              shiftId: shift.id,
              startWeekday: shift.startWeekday,
              endWeekday: shift.endWeekday,
              baseStartTime: shift.baseStartTime,
              baseEndTime: shift.baseEndTime,
              recurrence: days,
            };
          }).filter(Boolean);
          if (ss.season === 'normal') {
            output.normalSeason = {
              seasonId: ss.id,
              season: ss.season,
              startDate: ss.startDate ?? null,
              endDate: ss.endDate ?? null,
              shifts,
            };
          } else if (ss.season === 'summer') {
            output.summerSeason = {
              seasonId: ss.id,
              season: ss.season,
              startDate: ss.startDate ?? null,
              endDate: ss.endDate ?? null,
              shifts,
            };
          }
        }
      }
    }
    return output;
  }


  async getAllJobsRaw(): Promise<any[]> {
    return this.jobRepo.find();
  }

  private async loadHolidays(employerId: number, start: string, end: string): Promise<Map<string, string>> {
    const rows = await this.employerHolidayRepo.find({ where: { employerId, date: Between(start, end) } });
    const map = new Map<string, string>();
    rows.forEach((h) => map.set(h.date, h.name || ''));
    return map;
  }


async getControlForDate(userId: number, dateStr?: string) {
  const employerUser = await this.employerUserRepo.findOne({
    where: { user: { id: userId } },
    relations: ['employer'],
  });
  if (!employerUser?.employer) throw new Error('Employer not found for this user');

  const BUSINESS_TZ = 'Europe/Madrid';
  const madridNow = DateTime.now().setZone(BUSINESS_TZ);
  const selDateStr = dateStr || madridNow.toFormat('yyyy-MM-dd');
  // Local noon of the selected date keeps weekday/season calc correct regardless of server tz.
  const day = new Date(`${selDateStr}T12:00:00`);
  const startOfDay = DateTime.fromISO(selDateStr, { zone: BUSINESS_TZ }).startOf('day').toJSDate();
  const endOfDay = DateTime.fromISO(selDateStr, { zone: BUSINESS_TZ }).endOf('day').toJSDate();
  const madridTodayStr = madridNow.toFormat('yyyy-MM-dd');
  const madridNowMinutes = madridNow.hour * 60 + madridNow.minute;

  const holidays = await this.loadHolidays(employerUser.employer.id, selDateStr, selDateStr);
  const isHoliday = holidays.has(selDateStr);
  const holidayName = holidays.get(selDateStr) || null;

  // Date range lives in SQL: this used to load every job the employer had
  // ever created and discard the out-of-range ones in JS, which grew without
  // bound as the account aged. startDate/endDate are NOT NULL `date` columns,
  // so comparing them to the civil date string is exact — and free of the
  // timezone hazard isDateInJobRange has to work around.
  // Status is deliberately NOT filtered: isJobScheduledForDate ignores it, so
  // excluding cancelled/finished jobs here would change what the screen shows.
  const jobs = await this.jobRepo.find({
    where: {
      employer: { id: employerUser.employer.id },
      startDate: LessThanOrEqual(selDateStr as any),
      endDate: MoreThanOrEqual(selDateStr as any),
    },
    relations: [
      'employer', 'client', 'workCenters', 'workers', 'alerts',
      'seasonalSchedules', 'seasonalSchedules.shifts',
    ],
  });

  // Still needed for the seasonal/fixed schedule check; the date-range half of
  // this predicate is now redundant but harmless.
  const scheduled = jobs.filter((j) => this.jobScheduleService.isJobScheduledForDate(j, day));

  const workerIds = [...new Set(scheduled.flatMap((j) => j.workers.map((w) => w.id)))];
  const workerUsers = workerIds.length
    ? await this.workerUserRepo.find({ where: workerIds.map((id) => ({ workerId: id })), relations: ['user'] })
    : [];
  const workerName = new Map<number, string>();
  workerUsers.forEach((wu) => { if (wu.user?.name) workerName.set(wu.workerId, wu.user.name); });

  const jobIds = scheduled.map((j) => j.id);
  const sessions = jobIds.length
    ? await this.workSessionRepo.find({
        where: { job: { id: In(jobIds) }, checkInTime: Between(startOfDay, endOfDay) },
        // workCenter so we can surface WHERE each worker actually checked in,
        // rather than the job's full list of centres.
        relations: ['job', 'worker', 'workCenter'],
      })
    : [];
  // Aggregate a worker's sessions for the day. checkIn = earliest of the day; checkOut must be
  // the checkout of the MOST RECENT check-in — so if the latest session is still open (worker
  // re-checked-in after an earlier checkout today), checkOut stays null and the live view is correct.
  // workCenterName follows the most recent check-in (where the worker currently is).
  const checkInMap = new Map<string, { checkIn: Date; checkOut: Date | null; workCenterName: string | null }>();
  const latestCheckIn = new Map<string, Date>();
  for (const s of sessions) {
    if (s.job?.id && s.worker?.id && s.checkInTime) {
      const key = `${s.job.id}:${s.worker.id}`;
      const ci = new Date(s.checkInTime);
      const co = s.checkOutTime ? new Date(s.checkOutTime) : null;
      const wcName = s.workCenter?.name || null;
      const existing = checkInMap.get(key);
      if (!existing) {
        checkInMap.set(key, { checkIn: ci, checkOut: co, workCenterName: wcName });
        latestCheckIn.set(key, ci);
      } else {
        if (ci < existing.checkIn) existing.checkIn = ci;
        if (ci >= (latestCheckIn.get(key) as Date)) {
          existing.checkOut = co;
          existing.workCenterName = wcName;
          latestCheckIn.set(key, ci);
        }
      }
    }
  }

  const rows = scheduled.map((job) => {
    const shifts = this.jobScheduleService.getShiftsForDate(job, day);
    const { startTime, endTime } = this.jobScheduleService.getDayWindow(
      job,
      day,
    );

    const workers = job.workers.map((w) => {
      const sess = checkInMap.get(`${job.id}:${w.id}`);
      const durationMinutes =
        sess?.checkOut ? Math.max(0, Math.round((sess.checkOut.getTime() - sess.checkIn.getTime()) / 60000)) : null;
      return {
        id: w.id,
        publicId: w.publicId,
        code: w.code,
        name: workerName.get(w.id) || null,
        checkedIn: !!sess,
        checkInTime: sess ? sess.checkIn.toISOString() : null,
        checkOutTime: sess?.checkOut ? sess.checkOut.toISOString() : null,
        durationMinutes,
        // The specific centre this worker checked in at (null if not checked in).
        checkInWorkCenter: sess?.workCenterName || null,
      };
    });
    const firstCheckIn = workers.map((w) => w.checkInTime).filter(Boolean).sort()[0] || null;

    let overdue = false;
    if (startTime && !isHoliday) {
      const anyMissing = workers.length === 0 || workers.some((w) => !w.checkedIn);
      if (anyMissing) {
        if (selDateStr < madridTodayStr) {
          overdue = true;
        } else if (selDateStr === madridTodayStr) {
          const [hh, mm] = startTime.split(':').map(Number);
          overdue = (hh || 0) * 60 + (mm || 0) < madridNowMinutes;
        }
      }
    }

    return {
      jobId: job.id,
      publicId: job.publicId,
      jobName: job.jobName,
      startTime,
      endTime,
      titular: job.client?.name || job.employer?.name || null,
      workCenters: (job.workCenters || []).map((wc: any) => ({ id: wc.id, name: wc.name, locality: wc.locality || null })),
      workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
      workCenterLocality: (job.workCenters || []).map((wc: any) => wc.locality).filter(Boolean).join(', '),
      workers,
      workerNames: workers.map((w) => w.name).filter(Boolean).join(', '),
      firstCheckIn,
      alerts: (job.alerts || []).map((a: any) => a.alertType).filter(Boolean),
      overdue,
      isHoliday,
      holidayName,
      scheduleType: job.scheduleType,
    };
  });

  rows.sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });

  return rows;
}

async getIncidentsForDate(userId: number, dateStr?: string) {
  const rows: any[] = await this.getControlForDate(userId, dateStr);
  return rows
    .map((r) => {
      const incidents: string[] = [];
      if (r.overdue) incidents.push('no_checkin');
      if (r.startTime) {
        const start = r.startTime.slice(0, 5);
        const late = (r.workers || []).some((w: any) => w.checkInTime && this.madridTime(w.checkInTime) > start);
        if (late) incidents.push('late_checkin');
      }
      const missingCheckout = (r.workers || []).some((w: any) => w.checkedIn && !w.checkOutTime);
      if (missingCheckout && r.endTime && dateStr && dateStr < this.madridDateKey(new Date())) {
        incidents.push('no_checkout');
      }
      return { ...r, incidents };
    })
    .filter((r) => r.incidents.length > 0);
}

async getTasksTabDataForUser(userId: number) {
  // Step 1: Try to find EmployerUser
  const employerUser = await this.employerUserRepo.findOne({
    where: { user: { id: userId } },
    relations: ['employer'],
  });

  let jobs = [];

  if (employerUser?.employer) {
    // Step 2a: EmployerUser → fetch jobs by employer
    jobs = await this.jobRepo.find({
      where: { employer: { id: employerUser.employer.id } },
      // include employer relation so we can surface a fallback name when client is null
  relations: ['employer', 'client', 'workCenters', 'workers', 'tasks', 'tasks.workCenter'],
      select: {
        id: true,
        jobName: true,
        employer: { id: true, name: true },
        client: { id: true, name: true },
        workCenters: { id: true, name: true },
        workers: { id: true, code: true },
  tasks: { id: true, name: true, note: true, expectedDuration: true, workCenterId: true },
      },
    });
  } else {
    // Step 2b: Try to find ClientUser
    const clientUser = await this.clientUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['client'],
    });

    if (clientUser?.client) {
      // ClientUser → fetch jobs by client
      jobs = await this.jobRepo.find({
        where: { client: { id: clientUser.client.id } },
  relations: ['client', 'workCenters', 'workers', 'tasks', 'tasks.workCenter'],
        select: {
          id: true,
          jobName: true,
          client: { id: true, name: true },
          workCenters: { id: true, name: true },
          workers: { id: true, code: true },
          tasks: { id: true, name: true, note: true, expectedDuration: true, workCenterId: true },
        },
      });
    } else {
      // Step 2c: Try to find WorkerUser
      const workerUser = await this.workerUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['worker'],
      });

      if (workerUser?.worker) {
        // WorkerUser → fetch only jobs where this worker is assigned
        jobs = await this.jobRepo
          .createQueryBuilder('job')
          .leftJoinAndSelect('job.client', 'client')
          .leftJoinAndSelect('job.workCenters', 'workCenters')
          .leftJoinAndSelect('job.workers', 'worker')
          .leftJoinAndSelect('job.tasks', 'tasks')
          .leftJoinAndSelect('tasks.workCenter', 'taskWorkCenter')
          .where('worker.id = :workerId', { workerId: workerUser.worker.id })
          .select([
            'job.id', 'job.jobName',
            'client.id', 'client.name',
            'workCenters.id', 'workCenters.name',
            'worker.id', 'worker.code',
            'tasks.id', 'tasks.name', 'tasks.note', 'tasks.expectedDuration', 'taskWorkCenter.id', 'taskWorkCenter.name'
          ])
          .getMany();
      } else {
        throw new Error('User not found as employer, client, or worker');
      }
    }
  }

  // Step 3: Resolve names of all involved workers
  const allWorkerIds = jobs.flatMap(job => job.workers.map(w => w.id));
  const uniqueWorkerIds = [...new Set(allWorkerIds)];

  const workerUsers = await this.workerUserRepo.find({
    where: uniqueWorkerIds.length
      ? uniqueWorkerIds.map(id => ({ workerId: id }))
      : undefined,
    relations: ['user'],
  });

  const workerIdToName = new Map<number, string>();
  workerUsers.forEach(wu => {
    if (wu.user?.name) {
      workerIdToName.set(wu.workerId, wu.user.name);
    }
  });

  // Step 4: Attach names to workers
  const jobsWithWorkerNames = jobs.map(job => ({
    ...job,
    workers: job.workers.map(worker => ({
      id: worker.id,
      code: worker.code,
      name: workerIdToName.get(worker.id) || null,
      occupation: worker.occupation || null,
    })),
  }));

  // Step 5: Normalize employer-owned jobs so frontend can display a client name
  const normalized = jobsWithWorkerNames.map(j => {
    const isEmployerOwned = !j.client && !!j.employer;
    // clientName fallback: client.name || employer.name
    const clientName = j.client?.name || (j.employer ? j.employer.name : null);
    // keep original shape but add normalized fields to help frontend when client is null
    return {
      ...j,
      isEmployerOwned,
      clientName,
    };
  });

  // DEBUG: log normalized payload to help debug missing client/employer name
  try {
    // truncate large arrays for logs in case of big payload
    if (normalized.length > 0) {
      const sample = normalized.slice(0, 5).map(x => ({ id: x.id, client: x.client?.name || null, employer: x.employer?.name || null, clientName: x.clientName || null }));
    }
  } catch (e) {
    // ignore logging errors
  }

  return normalized;
}






//job card employer
async getAllJobsByEmployerFromToken(userId: number) {
  try {
    const employerUser = await this.employerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });

    if (!employerUser?.employer?.id) {
      throw new Error('Employer not found for this user');
    }

    const employerId = employerUser.employer.id;

    const jobs = await this.jobRepo.find({
      where: { employer: { id: employerId } },
      // include signingMethods so we can return them
  relations: ['client', 'workCenters', 'tasks', 'tasks.workCenter', 'workers', 'seasonalSchedules', 'seasonalSchedules.shifts', 'signingMethods'],
      // seasonalSchedules order must be deterministic: the card logic takes
      // normalSchedules[0], and join-produced order varies per query.
      order: { id: 'ASC', seasonalSchedules: { id: 'ASC' } },
    });

    const workerIds = jobs.flatMap(job => job.workers.map(w => w.id));
    const uniqueWorkerIds = [...new Set(workerIds)];

    const workerUsers = await this.workerUserRepo.find({
      where: uniqueWorkerIds.length
        ? uniqueWorkerIds.map(id => ({ worker: { id } }))
        : undefined,
      relations: ['user'],
    });

    const workerIdToName = new Map<number, string>();
    for (const wu of workerUsers) {
      // wu.workerId is the scalar FK (always loaded); wu.worker is the relation,
      // which is NOT loaded here (relations: ['user'] only) — reading wu.worker.id
      // left this map empty, so every worker fell back to its code.
      if (wu.workerId && wu.user?.name) {
        workerIdToName.set(wu.workerId, wu.user.name);
      }
    }

    // Fetch surveys for the returned jobs in a single query to determine client/worker survey flags
    const jobIds = jobs.map(j => j.id);
    // load surveys with client/worker relations so we can detect client vs worker surveys correctly
    const surveys = jobIds.length ? await this.surveyRepo.find({ where: { job: In(jobIds) }, relations: ['client', 'worker', 'job'] }) : [];

    const formatted = jobs.map(job => {
      // determine if there's a client survey (survey row with client relation set)
      const hasClientSurvey = surveys.some(s => s.job?.id === job.id && !!s.client);
      // determine if there's a worker survey: surveys for this job without a client relation
      const hasWorkerSurvey = surveys.some(s => s.job?.id === job.id && !s.client);

      // =========================================
      // Enhanced scheduleType logic for employer card
      // If job.scheduleType === SEASONAL we distinguish between:
      //   - "summer" seasonal schedule: seasonalSchedules row WITH startDate & endDate and today within range
      //   - "normal" seasonal schedule: seasonalSchedules row WITHOUT startDate & endDate OR when summer not active
      // Else keep existing mappings for free / fixed.
      // We also expose activeScheduleWeekHours for the currently applied schedule.
      // =========================================
      let scheduleType: string = 'free';
      let activeScheduleWeekHours: number | null = null;
      try {
        const summary = this.jobScheduleService.getScheduleSummary(job, madridCivilToday());
        scheduleType = summary.scheduleType;
        activeScheduleWeekHours = summary.weekHours;
      } catch (e) {
        scheduleType = 'free';
        activeScheduleWeekHours = null;
      }

      return {
        jobId: job.id,
        publicId: job.publicId,
        jobName: job.jobName,
        jobStatus: job.status || JobStatus.SCHEDULED,
        startDate: job.startDate,
        endDate: job.endDate,
        clientName: job.client?.name || '',
        workCenters: job.workCenters?.map(w => ({ id: w.id, publicId: w.publicId, name: w.name, locality: (w as any).locality || null })) || [],
        totalShifts: job.seasonalSchedules?.reduce((acc, ss) => acc + (ss.shifts?.length || 0), 0) || 0,
        // expectedDuration unchanged for fixed/free; for seasonal we report active schedule week hours separately
        expectedDuration: ((): number => {
          try {
            if (job.scheduleType === ScheduleType.FREE) return 0;
            if (job.scheduleType === ScheduleType.SEASONAL) {
              // Sum all seasonal shifts for legacy consumers; frontend can use activeScheduleWeekHours
              return (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
                const shifts = ss.shifts || [];
                const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
                return outerAcc + ssTotal;
              }, 0);
            }
            // fixed: sum task expectedDuration
            return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
          } catch (e) {
            return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
          }
        })(),
        activeScheduleWeekHours,
        clientId: job.client?.publicId || job.client?.id || null,
        tasks: job.tasks?.map(task => ({ id: task.id, publicId: task.publicId, name: task.name, expectedDuration: convertMinutesToDuration(task.expectedDuration) })) || [],
        signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
        hasClientSurvey,
        hasWorkerSurvey,
        workers: job.workers.map(worker => ({
          id: worker.id,
          publicId: worker.publicId,
          code: worker.code,
          name: workerIdToName.get(worker.id) || null,
          occupation: worker.occupation || null,
        })),
      };
    });

    return {
      message: 'Success',
      data: formatted,
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  } catch (error) {
    return {
      message: 'Error fetching jobs',
      data: [],
      isSuccess: false,
      statusCode: 500,
      developerError: error.message,
    };
  }
}

// worker job card
async getAllJobsByWorkerFromToken(userId: number) {
  try {
    const workerUser = await this.workerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['worker'],
    });

    if (!workerUser?.worker?.id) {
      throw new Error('Worker not found for this user');
    }

    const workerId = workerUser.worker.id;

    // Keep relations consistent with employer endpoint and include signingMethods
    const jobs = await this.jobRepo.find({
      where: { workers: { id: workerId } },
      relations: ['client', 'workCenters', 'tasks', 'tasks.workCenter', 'workers', 'seasonalSchedules', 'seasonalSchedules.shifts', 'signingMethods'],
      order: { id: 'ASC', seasonalSchedules: { id: 'ASC' } },
    });

    // Fetch active work sessions for this worker across all jobs
    const jobIds = jobs.map(j => j.id);
    const workSessions = jobIds.length ? await this.workSessionRepo.find({
      where: {
        job: { id: In(jobIds) },
        worker: { id: workerId },
        isActive: true,
      },
      relations: ['job'],
      order: { checkInTime: 'DESC' },
    }) : [];


    // Create a map of jobId -> workSession for quick lookup
    const jobIdToSession = new Map<number, any>();
    workSessions.forEach(session => {
      if (session.job?.id) {
        jobIdToSession.set(session.job.id, session);
      } else {
        console.warn('⚠️ Work session found but no job relation:', session);
      }
    });

    const workerIds = jobs.flatMap(job => job.workers.map(w => w.id));
    const uniqueWorkerIds = [...new Set(workerIds)];

    const workerUsers = await this.workerUserRepo.find({
      where: uniqueWorkerIds.length
        ? uniqueWorkerIds.map(id => ({ worker: { id } }))
        : undefined,
      relations: ['user'],
    });

    const workerIdToName = new Map<number, string>();
    for (const wu of workerUsers) {
      // wu.workerId is the scalar FK (always loaded); wu.worker is the relation,
      // which is NOT loaded here (relations: ['user'] only) — reading wu.worker.id
      // left this map empty, so every worker fell back to its code.
      if (wu.workerId && wu.user?.name) {
        workerIdToName.set(wu.workerId, wu.user.name);
      }
    }

    // Fetch surveys for the returned jobs in a single query to determine client/worker survey flags
    const surveys = jobIds.length ? await this.surveyRepo.find({ where: { job: In(jobIds) }, relations: ['client', 'worker', 'job'] }) : [];

    const formatted = jobs.map(job => {
      const hasClientSurvey = surveys.some(s => s.job?.id === job.id && !!s.client);
      const hasWorkerSurvey = surveys.some(s => s.job?.id === job.id && !s.client);

      // scheduleType logic (same as employer)
      let scheduleType: string = 'free';
      let activeScheduleWeekHours: number | null = null;
      try {
        const summary = this.jobScheduleService.getScheduleSummary(job, madridCivilToday());
        scheduleType = summary.scheduleType;
        activeScheduleWeekHours = summary.weekHours;
      } catch (e) {
        scheduleType = 'free';
        activeScheduleWeekHours = null;
      }

      return {
        jobId: job.id,
        publicId: job.publicId,
        jobName: job.jobName,
        jobStatus: job.status || JobStatus.SCHEDULED,
        startDate: job.startDate,
        endDate: job.endDate,
        clientName: job.client?.name || '',
        workCenters: job.workCenters?.map(w => ({ id: w.id, publicId: w.publicId, name: w.name, locality: (w as any).locality || null })) || [],
        workCenterNames: job.workCenters?.map(w => w.name).join(', ') || '',
        scheduleType,
        totalShifts: job.seasonalSchedules?.reduce((acc, ss) => acc + (ss.shifts?.length || 0), 0) || 0,
        expectedDuration: ((): number => {
          try {
            if (job.scheduleType === ScheduleType.FREE) return 0;
            if (job.scheduleType === ScheduleType.SEASONAL) {
              return (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
                const shifts = ss.shifts || [];
                const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
                return outerAcc + ssTotal;
              }, 0);
            }
            return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
          } catch (e) {
            return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
          }
        })(),
        activeScheduleWeekHours,
        tasks: job.tasks?.map(task => ({ id: task.id, publicId: task.publicId, name: task.name, expectedDuration: convertMinutesToDuration(task.expectedDuration) })) || [],
        signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
        hasClientSurvey,
        hasWorkerSurvey,
        workers: job.workers.map(worker => ({ id: worker.id, publicId: worker.publicId, code: worker.code, name: workerIdToName.get(worker.id) || null, occupation: worker.occupation || null })),
        // Include active work session if exists
        workSession: jobIdToSession.has(job.id) ? (() => {
          const session = jobIdToSession.get(job.id);
          return {
            checkInTime: session.checkInTime,
            checkOutTime: session.checkOutTime,
            isActive: session.isActive,
            isOnBreak: session.isOnBreak,
            currentBreakStart: session.currentBreakStart,
            totalWorkMinutes: session.totalWorkMinutes,
            totalBreakMinutes: session.totalBreakMinutes,
          };
        })() : null,
      };
    });

    return {
      message: 'Success',
      data: formatted,
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  } catch (error) {
    return {
      message: 'Error fetching jobs',
      data: [],
      isSuccess: false,
      statusCode: 500,
      developerError: error.message,
    };
  }
}




  //client dashboard job card
  async getAllJobsByClientFromToken(userId: number) {
    try {
      const clientUser = await this.clientUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['client'],
      });

      if (!clientUser?.client?.id) {
        throw new Error('Client not found for this user');
      }

      return this.getAllJobsByClientId(clientUser.client.id);
    } catch (error) {
      return {
        message: 'Error fetching client jobs',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

  /**
   * List every job belonging to a client, formatted for the client-jobs tab
   * on the Clients detail page. Accepts the client's UUID public id rather
   * than an authenticated user, so admins/employers can view a specific
   * client's jobs instead of being scoped to their own via the token.
   */
  // Shared core so the employer's Client > Calendario tab and the client's own
  // Schedule page always return identical data for the same client — only how
  // the clientId is resolved differs. It deliberately does NOT load the
  // `workers` relation: loading that to-many alongside the nested
  // seasonalSchedules.shifts to-many caused a TypeORM join explosion that left
  // `shifts` under-hydrated, so FIXED-schedule jobs looked "not scheduled" and
  // silently dropped off the employer view while the client (which loads
  // workCenters instead) saw them.
  private async buildClientCalendar(clientId: number, start: string, end: string) {
    const jobs = await this.jobRepo.find({
      where: { client: { id: clientId } },
      relations: ['employer', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
    });
    const employerId = jobs[0]?.employer?.id;
    const holidays = employerId ? await this.loadHolidays(employerId, start, end) : new Map<string, string>();

    const jobIds = jobs.map((j) => j.id);
    const startInstant = DateTime.fromISO(start, { zone: 'Europe/Madrid' }).startOf('day').toJSDate();
    const endInstant = DateTime.fromISO(end, { zone: 'Europe/Madrid' }).endOf('day').toJSDate();
    const sessions = jobIds.length
      ? await this.workSessionRepo.find({ where: { job: { id: In(jobIds) }, checkInTime: Between(startInstant, endInstant) }, relations: ['job'] })
      : [];
    const workedByDate = new Map<string, Set<number>>();
    for (const s of sessions) {
      if (!s.job?.id) continue;
      const k = this.madridDateKey(s.checkInTime);
      if (!workedByDate.has(k)) workedByDate.set(k, new Set());
      workedByDate.get(k)!.add(s.job.id);
    }

    const p = (n: number) => String(n).padStart(2, '0');
    const cursor = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    const days: any[] = [];
    let guard = 0;
    while (cursor <= last && guard < 400) {
      guard++;
      const dateStr = `${cursor.getFullYear()}-${p(cursor.getMonth() + 1)}-${p(cursor.getDate())}`;
      const holiday = holidays.has(dateStr);
      const workedIds = workedByDate.get(dateStr);
      const dayJobs: any[] = [];
      for (const job of jobs) {
        const scheduled = !holiday && this.jobScheduleService.isJobScheduledForDate(job, cursor);
        const worked = !!workedIds?.has(job.id);
        if (!scheduled && !worked) continue;
        const shifts = scheduled ? this.jobScheduleService.getShiftsForDate(job, cursor) : [];
        const { startTime: dayStart, endTime: dayEnd } = scheduled ? this.jobScheduleService.getDayWindow(job, cursor) : { startTime: null, endTime: null };
        dayJobs.push({
          jobId: job.publicId,
          jobName: job.jobName,
          workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
          startTime: dayStart,
          endTime: dayEnd,
          worked,
        });
      }
      const working = !holiday && dayJobs.length > 0;
      days.push({ date: dateStr, holiday, holidayName: holidays.get(dateStr) || null, absence: null, working, jobs: dayJobs });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  async getClientCalendar(publicId: string, start: string, end: string) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) {
      return { message: 'Client not found', data: [], isSuccess: false, statusCode: 404 };
    }
    if (!start || !end) {
      return { message: 'start and end are required', data: [], isSuccess: false, statusCode: 400 };
    }
    const days = await this.buildClientCalendar(client.id, start, end);
    return { message: 'OK', data: days, isSuccess: true, statusCode: 200 };
  }

  async getEmployerOccupation(userId: number, start: string, end: string, workerIdsCsv?: string) {
    const employerUser = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!employerUser?.employer) throw new Error('Employer not found for this user');
    if (!start || !end) throw new Error('start and end are required');

    const selected = (workerIdsCsv || '').split(',').map((s) => s.trim()).filter(Boolean);
    const selectedSet = new Set(selected);

    const holidays = await this.loadHolidays(employerUser.employer.id, start, end);

    const jobs = await this.jobRepo.find({
      where: { employer: { id: employerUser.employer.id } },
      relations: ['workers', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
    });

    const allWorkerIds = [...new Set(jobs.flatMap((j) => j.workers.map((w) => w.id)))];
    const workerUsers = allWorkerIds.length
      ? await this.workerUserRepo.find({ where: allWorkerIds.map((id) => ({ workerId: id })), relations: ['user'] })
      : [];
    const nameById = new Map<number, string>();
    workerUsers.forEach((wu) => { if (wu.user?.name) nameById.set(wu.workerId, wu.user.name); });

    const p = (n: number) => String(n).padStart(2, '0');
    const days: string[] = [];
    const cursor = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    let guard = 0;
    while (cursor <= last && guard < 400) {
      guard++;
      days.push(`${cursor.getFullYear()}-${p(cursor.getMonth() + 1)}-${p(cursor.getDate())}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    const workersInScope = new Map<string, { id: string; name: string }>();
    const cells: any[] = [];
    const cellKeys = new Set<string>();
    for (const dateStr of days) {
      if (holidays.has(dateStr)) continue;
      const day = new Date(`${dateStr}T12:00:00`);
      for (const job of jobs) {
        if (!this.jobScheduleService.isJobScheduledForDate(job, day)) continue;
        const shifts = this.jobScheduleService.getShiftsForDate(job, day);
        const { startTime: dayStart, endTime: dayEnd } = this.jobScheduleService.getDayWindow(job, day);
        const wcName = (job.workCenters || []).map((wc) => wc.name).join(', ');
        for (const w of job.workers) {
          if (selectedSet.size && !selectedSet.has(w.publicId)) continue;
          workersInScope.set(w.publicId, { id: w.publicId, name: nameById.get(w.id) || w.code });
          cellKeys.add(`${dateStr}:${w.publicId}:${job.publicId}`);
          cells.push({
            workerId: w.publicId,
            date: dateStr,
            jobName: job.jobName,
            workCenterName: wcName,
            startTime: dayStart,
            endTime: dayEnd,
            worked: false,
          });
        }
      }
    }

    const jobIds = jobs.map((j) => j.id);
    const idToJob = new Map(jobs.map((j) => [j.id, j]));
    const workerMeta = new Map<number, { publicId: string; name: string }>();
    jobs.forEach((j) => j.workers.forEach((w) => workerMeta.set(w.id, { publicId: w.publicId, name: nameById.get(w.id) || w.code })));
    const startInstant = DateTime.fromISO(start, { zone: 'Europe/Madrid' }).startOf('day').toJSDate();
    const endInstant = DateTime.fromISO(end, { zone: 'Europe/Madrid' }).endOf('day').toJSDate();
    const sessions = jobIds.length
      ? await this.workSessionRepo.find({
          where: { job: { id: In(jobIds) }, checkInTime: Between(startInstant, endInstant) },
          relations: ['job', 'worker'],
        })
      : [];
    for (const s of sessions) {
      const job = s.job?.id ? idToJob.get(s.job.id) : null;
      const wm = s.worker?.id ? workerMeta.get(s.worker.id) : null;
      if (!job || !wm || !s.checkInTime) continue;
      if (selectedSet.size && !selectedSet.has(wm.publicId)) continue;
      const dateStr = this.madridDateKey(s.checkInTime);
      const key = `${dateStr}:${wm.publicId}:${job.publicId}`;
      if (cellKeys.has(key)) continue;
      cellKeys.add(key);
      workersInScope.set(wm.publicId, { id: wm.publicId, name: wm.name });
      cells.push({
        workerId: wm.publicId,
        date: dateStr,
        jobName: job.jobName,
        workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
        startTime: null,
        endTime: null,
        worked: true,
      });
    }

    return {
      message: 'OK',
      data: {
        workers: [...workersInScope.values()].sort((a, b) => a.name.localeCompare(b.name)),
        days,
        cells,
        holidays: Object.fromEntries(holidays),
      },
      isSuccess: true,
      statusCode: 200,
    };
  }

  // A worker's own calendar — resolves the worker from the session user.
  async getWorkerCalendar(userId: number, start: string, end: string) {
    const link = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    const workerId = link?.worker?.id;
    if (!workerId) throw new NotFoundException('Worker not found for this user');
    return this.buildWorkerCalendar(workerId, start, end);
  }

  // The same calendar for an arbitrary worker (by publicId), used by the
  // employer's worker-detail Calendar tab. Restricted to the employer that
  // actually manages the worker.
  async getWorkerCalendarByPublicId(requesterUserId: number, publicId: string, start: string, end: string) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');

    const requesterEmployer = await this.employerUserRepo.findOne({
      where: { user: { id: requesterUserId } },
      relations: ['employer'],
    });
    const employerId = requesterEmployer?.employer?.id;
    if (!employerId) throw new ForbiddenException('Not an employer');

    const owns = await this.employerWorkerRepo.findOne({
      where: { worker: { id: worker.id }, employer: { id: employerId } },
    });
    if (!owns) throw new ForbiddenException('This worker is not in your account');

    return this.buildWorkerCalendar(worker.id, start, end);
  }

  private async buildWorkerCalendar(workerId: number, start: string, end: string) {
    if (!start || !end) throw new BadRequestException('start and end are required');

    const empLink = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer'] });
    const employerId = empLink?.employer?.id;
    const holidays = employerId ? await this.loadHolidays(employerId, start, end) : new Map<string, string>();

    const jobs = employerId
      ? (await this.jobRepo.find({
          where: { employer: { id: employerId } },
          relations: ['workers', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        })).filter((j) => j.workers.some((w) => w.id === workerId))
      : [];

    const startInstant = DateTime.fromISO(start, { zone: 'Europe/Madrid' }).startOf('day').toJSDate();
    const endInstant = DateTime.fromISO(end, { zone: 'Europe/Madrid' }).endOf('day').toJSDate();
    const sessions = await this.workSessionRepo.find({
      where: { worker: { id: workerId }, checkInTime: Between(startInstant, endInstant) },
      relations: ['job'],
    });
    const workedDays = new Set(sessions.map((s) => this.madridDateKey(s.checkInTime)));
    const workedByDate = new Map<string, Set<number>>();
    for (const s of sessions) {
      if (!s.job?.id) continue;
      const k = this.madridDateKey(s.checkInTime);
      if (!workedByDate.has(k)) workedByDate.set(k, new Set());
      workedByDate.get(k)!.add(s.job.id);
    }

    const absences = await this.dataSource.getRepository(AbsenceRequest).find({
      where: { workerId, status: 'approved' },
    });
    const absenceOn = (dateStr: string) =>
      absences.find((a) => a.startDate <= dateStr && dateStr <= a.endDate) || null;

    const p = (n: number) => String(n).padStart(2, '0');
    const cursor = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    const days: any[] = [];
    let guard = 0;
    while (cursor <= last && guard < 400) {
      guard++;
      const dateStr = `${cursor.getFullYear()}-${p(cursor.getMonth() + 1)}-${p(cursor.getDate())}`;
      const holiday = holidays.has(dateStr);
      const absence = absenceOn(dateStr);
      const workedIds = workedByDate.get(dateStr);
      const dayJobs: any[] = [];
      for (const job of jobs) {
        const scheduled = !holiday && !absence && this.jobScheduleService.isJobScheduledForDate(job, cursor);
        const worked = !!workedIds?.has(job.id);
        if (!scheduled && !worked) continue;
        const shifts = scheduled ? this.jobScheduleService.getShiftsForDate(job, cursor) : [];
        const { startTime: dayStart, endTime: dayEnd } = scheduled ? this.jobScheduleService.getDayWindow(job, cursor) : { startTime: null, endTime: null };
        dayJobs.push({
          jobName: job.jobName,
          workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
          startTime: dayStart,
          endTime: dayEnd,
          worked,
        });
      }
      const working = !holiday && !absence && dayJobs.length > 0;
      days.push({
        date: dateStr,
        holiday,
        holidayName: holidays.get(dateStr) || null,
        absence: absence ? { type: absence.type } : null,
        working,
        jobs: dayJobs,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return { message: 'OK', data: days, isSuccess: true, statusCode: 200 };
  }

  /**
   * The worker's jobs for a single Madrid civil day, with per-job check-in
   * status — powers the worker "Jobs" screen (day selector + cards + the
   * "solicitar fichaje manual" flow for days not yet clocked in).
   */
  /**
   * The worker's currently open session, whenever it started.
   *
   * Deliberately NOT day-scoped: getWorkerJobsForDate only returns sessions
   * whose checkInTime falls inside the requested Madrid day, so a night shift
   * disappears after midnight while still being open. UI that asks "am I
   * clocked in right now?" must not depend on the calendar day.
   */
  async getWorkerActiveSession(userId: number) {
    const link = await this.workerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['worker'],
    });
    const workerId = link?.worker?.id;
    if (!workerId) throw new NotFoundException('Worker not found for this user');

    const session = await this.workSessionRepo.findOne({
      where: { workerId, checkOutTime: IsNull() },
      relations: ['job'],
      order: { checkInTime: 'DESC' },
    });

    if (!session) {
      return { hasActiveSession: false, data: null };
    }

    // totalBreakMinutes covers completed breaks only; the running break is
    // reported separately so the caller can freeze its clock instead of
    // guessing at minute precision.
    return {
      hasActiveSession: true,
      data: {
        sessionId: session.publicId || String(session.id),
        jobId: session.job?.publicId || String(session.jobId),
        jobName: session.job?.jobName || '',
        checkInTime: session.checkInTime,
        onBreak: !!session.isOnBreak,
        breakStartTime: session.currentBreakStart || null,
        totalBreakMinutes: session.totalBreakMinutes || 0,
      },
    };
  }

  async getWorkerJobsForDate(userId: number, dateStr?: string) {
    const link = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    const workerId = link?.worker?.id;
    if (!workerId) throw new Error('Worker not found for this user');
    const date = dateStr || madridTodayKey();

    const empLink = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer'] });
    const employerId = empLink?.employer?.id;
    const holidays = employerId ? await this.loadHolidays(employerId, date, date) : new Map<string, string>();
    const isHoliday = holidays.has(date);

    const jobs = employerId
      ? (await this.jobRepo.find({
          where: { employer: { id: employerId } },
          relations: ['workers', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        })).filter((j) => j.workers.some((w) => w.id === workerId))
      : [];

    const startInstant = DateTime.fromISO(date, { zone: 'Europe/Madrid' }).startOf('day').toJSDate();
    const endInstant = DateTime.fromISO(date, { zone: 'Europe/Madrid' }).endOf('day').toJSDate();
    const sessions = await this.workSessionRepo.find({
      where: { worker: { id: workerId }, checkInTime: Between(startInstant, endInstant) },
      relations: ['job'],
    });
    const sessionByJob = new Map<number, any>();
    for (const s of sessions) if (s.job?.id) sessionByJob.set(s.job.id, s);

    const absences = await this.dataSource.getRepository(AbsenceRequest).find({ where: { workerId, status: 'approved' } });
    const absence = absences.find((a) => a.startDate <= date && date <= a.endDate) || null;

    const dayDate = new Date(`${date}T12:00:00`);
    const items: any[] = [];
    for (const job of jobs) {
      const scheduled = !isHoliday && !absence && this.jobScheduleService.isJobScheduledForDate(job, dayDate);
      const session = sessionByJob.get(job.id) || null;
      if (!scheduled && !session) continue;
      const shifts = scheduled ? this.jobScheduleService.getShiftsForDate(job, dayDate) : [];
      const { startTime: dayStart, endTime: dayEnd } = scheduled ? this.jobScheduleService.getDayWindow(job, dayDate) : { startTime: null, endTime: null };
      items.push({
        id: job.id,
        publicId: job.publicId,
        jobName: job.jobName,
        title: job.jobName,
        workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
        workCenters: (job.workCenters || []).map((wc) => ({ id: wc.id, publicId: wc.publicId, name: wc.name })),
        workers: (job.workers || []).map((w) => ({ id: w.id, publicId: w.publicId })),
        startTime: dayStart,
        endTime: dayEnd,
        scheduled,
        session: session
          ? { id: session.id, checkInTime: session.checkInTime, checkOutTime: session.checkOutTime, isActive: session.isActive }
          : null,
      });
    }

    return {
      message: 'OK',
      data: {
        date,
        isHoliday,
        holidayName: holidays.get(date) || null,
        absence: absence ? { type: absence.type } : null,
        jobs: items,
      },
      isSuccess: true,
      statusCode: 200,
    };
  }

  /**
   * Days in the recent past where the worker was scheduled but has no check-in
   * ("Pendientes" tab) — each entry can be turned into a manual-attendance
   * request. Holidays and approved absences are excluded; future days too.
   */
  async getWorkerPendingCheckins(userId: number, days = 30) {
    const link = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    const workerId = link?.worker?.id;
    if (!workerId) throw new Error('Worker not found for this user');

    const end = DateTime.fromISO(madridTodayKey(), { zone: 'Europe/Madrid' });
    const start = end.minus({ days: Math.max(1, days) - 1 });
    const startKey = start.toFormat('yyyy-MM-dd');
    const todayKey = end.toFormat('yyyy-MM-dd');

    const empLink = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer'] });
    const employerId = empLink?.employer?.id;
    const holidays = employerId ? await this.loadHolidays(employerId, startKey, todayKey) : new Map<string, string>();

    const jobs = employerId
      ? (await this.jobRepo.find({
          where: { employer: { id: employerId } },
          relations: ['workers', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        })).filter((j) => j.workers.some((w) => w.id === workerId))
      : [];

    const sessions = await this.workSessionRepo.find({
      where: { worker: { id: workerId }, checkInTime: Between(start.startOf('day').toJSDate(), end.endOf('day').toJSDate()) },
      relations: ['job'],
    });
    const fichado = new Set(sessions.filter((s) => s.job?.id).map((s) => `${s.job.id}|${this.madridDateKey(s.checkInTime)}`));

    const absences = await this.dataSource.getRepository(AbsenceRequest).find({ where: { workerId, status: 'approved' } });
    const absenceOn = (d: string) => absences.some((a) => a.startDate <= d && d <= a.endDate);

    const pending: any[] = [];
    let cursor = start;
    while (cursor <= end) {
      const dateKey = cursor.toFormat('yyyy-MM-dd');
      if (!holidays.has(dateKey) && !absenceOn(dateKey)) {
        const dayDate = new Date(`${dateKey}T12:00:00`);
        for (const job of jobs) {
          if (!this.jobScheduleService.isJobScheduledForDate(job, dayDate)) continue;
          if (fichado.has(`${job.id}|${dateKey}`)) continue;
          const starts = this.jobScheduleService.getShiftsForDate(job, dayDate).map((s) => s.baseStartTime).filter(Boolean).sort();
          pending.push({
            date: dateKey,
            id: job.id,
            publicId: job.publicId,
            jobName: job.jobName,
            title: job.jobName,
            workCenterName: (job.workCenters || []).map((wc) => wc.name).join(', '),
            workCenters: (job.workCenters || []).map((wc) => ({ id: wc.id, publicId: wc.publicId, name: wc.name })),
            workers: (job.workers || []).map((w) => ({ id: w.id, publicId: w.publicId })),
            shiftStart: starts[0] ? starts[0].slice(0, 5) : null,
          });
        }
      }
      cursor = cursor.plus({ days: 1 });
    }
    pending.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    return { message: 'OK', data: pending, isSuccess: true, statusCode: 200 };
  }

  /**
   * Client "Control" data for a day: the client's jobs scheduled/worked that
   * day, each with per-worker check-in status. `running` flags whether a job
   * is currently in execution (an active session today).
   */
  async getClientJobsForDate(userId: number, dateStr?: string) {
    const clientUser = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
    const clientId = clientUser?.client?.id;
    if (!clientId) throw new Error('Client not found for this user');
    const date = dateStr || madridTodayKey();

    const jobs = await this.jobRepo.find({
      where: { client: { id: clientId } },
      relations: ['employer', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
    });
    const employerId = jobs[0]?.employer?.id;
    const holidays = employerId ? await this.loadHolidays(employerId, date, date) : new Map<string, string>();
    const isHoliday = holidays.has(date);

    const jobIds = jobs.map((j) => j.id);
    const startInstant = DateTime.fromISO(date, { zone: 'Europe/Madrid' }).startOf('day').toJSDate();
    const endInstant = DateTime.fromISO(date, { zone: 'Europe/Madrid' }).endOf('day').toJSDate();
    const sessions = jobIds.length
      ? await this.workSessionRepo.find({
          where: { job: { id: In(jobIds) }, checkInTime: Between(startInstant, endInstant) },
          relations: ['job', 'worker', 'worker.user'],
        })
      : [];
    const byJob = new Map<number, any[]>();
    for (const s of sessions) {
      if (!s.job?.id) continue;
      if (!byJob.has(s.job.id)) byJob.set(s.job.id, []);
      byJob.get(s.job.id)!.push(s);
    }

    const nameByWorkerId = await this.resolveWorkerNames(sessions.map((s) => s.worker?.id));

    const dayDate = new Date(`${date}T12:00:00`);
    const items: any[] = [];
    for (const job of jobs) {
      const scheduled = !isHoliday && this.jobScheduleService.isJobScheduledForDate(job, dayDate);
      const js = byJob.get(job.id) || [];
      if (!scheduled && js.length === 0) continue;
      const workers = js.map((s) => ({
        name: nameByWorkerId.get(s.worker?.id) || s.worker?.user?.name || (s.worker?.code ? `#${s.worker.code}` : 'Trabajador'),
        checkInTime: s.checkInTime,
        checkOutTime: s.checkOutTime,
        active: !!(s.checkInTime && !s.checkOutTime && s.isActive),
      }));
      const active = workers.some((w) => w.active);
      const allOut = workers.length > 0 && workers.every((w) => w.checkOutTime);
      const status = active ? 'in_progress' : allOut ? 'completed' : 'scheduled';
      items.push({ publicId: job.publicId, scheduled, status, workers });
    }
    const running = items.some((i) => i.status === 'in_progress');

    return {
      message: 'OK',
      data: { date, isHoliday, holidayName: holidays.get(date) || null, running, jobs: items },
      isSuccess: true,
      statusCode: 200,
    };
  }

  /** Attendance records (Presencia > Historial) for the client's jobs. */
  async getClientWorkSessionRecords(userId: number, startDate?: string, endDate?: string, jobId?: string) {
    const clientUser = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
    const clientId = clientUser?.client?.id;
    if (!clientId) return { message: 'Client not found', data: [], isSuccess: false, statusCode: 404 };

    const allJobs = await this.jobRepo.find({ where: { client: { id: clientId } }, relations: ['seasonalSchedules', 'seasonalSchedules.shifts'] });
    const jobs = jobId ? allJobs.filter((j) => j.publicId === jobId || String(j.id) === jobId) : allJobs;
    const jobIds = jobs.map((j) => j.id);
    if (!jobIds.length) return { message: 'Success', data: [], isSuccess: true, statusCode: 200 };
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    const query = this.workSessionRepo.createQueryBuilder('workSession')
      .leftJoinAndSelect('workSession.job', 'job')
      .leftJoinAndSelect('workSession.worker', 'worker')
      .leftJoinAndSelect('worker.user', 'workerUser')
      .leftJoinAndSelect('workSession.workCenter', 'workCenter')
      .where('job.id IN (:...jobIds)', { jobIds });
    if (startDate) query.andWhere('workSession.checkInTime >= :startDate', { startDate });
    if (endDate) {
      const e = new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));
      query.andWhere('workSession.checkInTime < :endDate', { endDate: e });
    }
    query.orderBy('workSession.checkInTime', 'DESC');
    const sessions = await query.getMany();

    const _wids = Array.from(new Set(sessions.map((s: any) => s.worker?.id).filter(Boolean)));
    const _wus = _wids.length ? await this.workerUserRepo.find({ where: _wids.map((id: any) => ({ workerId: id })), relations: ['user'] }) : [];
    const _nameBy = new Map<number, string>();
    _wus.forEach((wu: any) => { if (wu.user?.name) _nameBy.set(wu.workerId, wu.user.name); });

    const records = sessions.map((session) => {
      const checkIn = new Date(session.checkInTime);
      const checkOut = session.checkOutTime ? new Date(session.checkOutTime) : null;
      const totalH = Math.floor(session.totalWorkMinutes / 60);
      const totalM = session.totalWorkMinutes % 60;

      let punctuality: 'early' | 'onTime' | 'late' | null = null;
      let lateMinutes: number | null = null;
      const job = jobById.get(session.job?.id);
      if (job) {
        const dayDate = new Date(`${this.madridDateKey(session.checkInTime)}T12:00:00`);
        const starts = this.jobScheduleService.getShiftsForDate(job, dayDate).map((s) => s.baseStartTime).filter(Boolean).sort();
        const shiftStart = starts[0] ? starts[0].slice(0, 5) : null;
        if (shiftStart) {
          const [sh, sm] = shiftStart.split(':').map(Number);
          const diff = this.madridMinutes(session.checkInTime) - (sh * 60 + sm);
          if (diff > 5) { punctuality = 'late'; lateMinutes = diff; }
          else if (diff <= -15) { punctuality = 'early'; }
          else { punctuality = 'onTime'; }
        }
      }

      const _schedMin = job ? (this.jobScheduleService.getScheduledMinutesForDate(job, new Date(`${this.madridDateKey(session.checkInTime)}T12:00:00`)) || 0) : 0;
      const extra = this.overtimeLabel(session, _schedMin);
      const puntualidad = punctuality === 'late' ? `+${lateMinutes}m tarde` : punctuality === 'early' ? 'Adelantado' : punctuality === 'onTime' ? 'A tiempo' : '—';
      return {
        id: session.publicId || String(session.id),
        recordId: session.publicId || session.id,
        fecha: checkOut ? `${this.madridDate(checkIn)} - ${this.madridDate(checkOut)}` : `${this.madridDate(checkIn)} - En progreso`,
        job: session.job?.jobName || 'N/A',
        centro: (session as any).workCenter?.name || '—',
        worker: _nameBy.get(session.worker?.id) || session.worker?.user?.name || (session.worker?.code ? `#${session.worker.code}` : 'Trabajador'),
        entrada: this.madridTime(checkIn),
        salida: checkOut ? this.madridTime(checkOut) : (session.isActive ? 'En progreso' : '-'),
        total: `${totalH}h ${totalM}m`,
        extra,
        metodo: session.checkInMethod || '—',
        puntualidad,
        punctuality,
        lateMinutes,
        checkInTime: session.checkInTime,
        checkOutTime: session.checkOutTime,
        isActive: session.isActive,
      };
    });
    return { message: 'Success', data: records, isSuccess: true, statusCode: 200 };
  }

  /**
   * Overtime for a list row. The stored figure wins; deriving it here from the
   * current schedule is what let a schedule edit rewrite last month, and it
   * reports zero on a rest day, where the whole session counts.
   */
  private overtimeLabel(session: any, scheduledMinutes: number): string {
    const stored = session?.overtimeMinutes;
    if (stored != null) {
      const m = Number(stored);
      return m > 0 ? `${Math.floor(m / 60)}h ${m % 60}m` : '0h';
    }
    if (scheduledMinutes <= 0) return '—';
    const m = Math.max(0, (session?.totalWorkMinutes || 0) - scheduledMinutes);
    return m > 0 ? `${Math.floor(m / 60)}h ${m % 60}m` : '0h';
  }

  private calcPunctuality(shiftTime: string | null, actualMinutes: number, isCheckout = false) {
    if (!shiftTime) return null;
    const [h, m] = shiftTime.split(':').map(Number);
    const diff = actualMinutes - (h * 60 + m);
    if (!isCheckout) {
      if (diff > 5) return { status: 'late', minutes: diff };
      if (diff <= -15) return { status: 'early', minutes: Math.abs(diff) };
      return { status: 'onTime', minutes: 0 };
    }
    if (diff < -5) return { status: 'early', minutes: Math.abs(diff) };
    if (diff > 5) return { status: 'late', minutes: diff };
    return { status: 'onTime', minutes: 0 };
  }

  /** Full detail of a single work session (record) for the tabbed detail page — role-agnostic, by publicId. */
  async getRecordDetail(recordId: string) {
    const session = await this.workSessionRepo.findOne({
      where: { publicId: recordId },
      relations: ['worker', 'worker.user', 'job', 'job.tasks', 'job.client', 'workCenter'],
    });
    if (!session) return { message: 'Record not found', data: null, isSuccess: false, statusCode: 404 };

    let workerName = session.worker?.user?.name || null;
    if (!workerName && session.worker?.id) {
      const _wu = await this.workerUserRepo.findOne({ where: { workerId: session.worker.id }, relations: ['user'] });
      workerName = _wu?.user?.name || null;
    }

    const job = session.job;
    const checkOut = session.checkOutTime ? new Date(session.checkOutTime) : null;
    const dayKey = this.madridDateKey(session.checkInTime);
    const dayDate = new Date(`${dayKey}T12:00:00`);

    // Prefer the exact session→scan link: a scan belongs to one session, so
    // back-to-back sessions that share a boundary no longer bleed into each
    // other's detail. Fall back to the time window only for legacy scans that
    // predate the link (and weren't backfilled).
    let scanLogs = await this.scanLogRepo.find({
      where: { workSessionId: session.id },
      relations: ['workCenter'],
      order: { scanTime: 'ASC' },
    });
    if (scanLogs.length === 0) {
      // Buffer the window: the check-in scan is written a few hundred ms BEFORE
      // the session's checkInTime, and the checkout scan slightly before checkOutTime.
      const scanStart = new Date(new Date(session.checkInTime).getTime() - 60000);
      const scanEnd = new Date((checkOut ? checkOut.getTime() : Date.now()) + 60000);
      scanLogs = await this.scanLogRepo.createQueryBuilder('s')
        .leftJoinAndSelect('s.workCenter', 'wc')
        .where('s.job = :jobId', { jobId: job.id })
        .andWhere('s.worker = :workerId', { workerId: session.worker.id })
        .andWhere('s.workSessionId IS NULL')
        .andWhere('s.scanTime >= :start', { start: scanStart })
        .andWhere('s.scanTime <= :end', { end: scanEnd })
        .orderBy('s.scanTime', 'ASC')
        .getMany();
    }

    const scans = scanLogs.map((s) => ({
      scanType: s.scanType,
      time: this.madridTime(s.scanTime),
      scanTime: s.scanTime,
      method: s.signingMethod || null,
      location: s.location || null,
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      ipAddress: s.ipAddress || null,
      workCenter: s.workCenter?.name || null,
      notes: s.notes || null,
      selfieUrl: s.selfieUrl || null,
      webauthnVerified: !!s.webauthnVerified,
      locationUnavailable: !!s.locationUnavailable,
    }));

    const breaks: any[] = [];
    let bs: any = null;
    for (const s of scanLogs) {
      if (s.scanType === 'break-start') bs = s;
      else if (s.scanType === 'break-end' && bs) {
        breaks.push({
          start: this.madridTime(bs.scanTime),
          end: this.madridTime(s.scanTime),
          durationMinutes: Math.floor((new Date(s.scanTime).getTime() - new Date(bs.scanTime).getTime()) / 60000),
          notes: bs.notes || null,
        });
        bs = null;
      }
    }

    const taskHistories = await this.taskHistoryRepo.createQueryBuilder('th')
      .leftJoinAndSelect('th.task', 'task')
      .leftJoinAndSelect('th.completedBy', 'w')
      .leftJoinAndSelect('w.user', 'wu')
      .where('th.jobId = :jobId', { jobId: job.id })
      .andWhere('th.date = :date', { date: dayKey })
      .getMany();
    const thByTask = new Map<number, any>();
    // A day can hold duplicate history rows per task (one pending, one completed) — keep the completed one.
    taskHistories.forEach((th: any) => {
      if (!th.task) return;
      const prev = thByTask.get(th.task.id);
      if (!prev || (th.isCompleted && !prev.isCompleted)) thByTask.set(th.task.id, th);
    });
    const tasks = (job.tasks || []).map((t: any) => {
      const th: any = thByTask.get(t.id);
      const completedByName = th?.completedBy?.user?.name
        || (th?.completedByWorkerId === session.worker?.id ? workerName : null);
      return {
        name: t.name,
        completed: th ? !!th.isCompleted : false,
        completedAt: th && th.isCompleted ? this.madridTime(th.completedAt || session.checkInTime) : null,
        completedBy: th && th.isCompleted ? completedByName : null,
      };
    });

    const shifts = this.jobScheduleService.getShiftsForDate(job, dayDate);
    const starts = shifts.map((s: any) => s.baseStartTime).filter(Boolean).sort();
    const ends = shifts.map((s: any) => s.baseEndTime).filter(Boolean).sort();
    const shiftStart = starts[0] ? starts[0].slice(0, 5) : null;
    const shiftEnd = ends.length ? ends[ends.length - 1].slice(0, 5) : null;

    const scheduledMinutes = this.jobScheduleService.getScheduledMinutesForDate(job, dayDate) || 0;
    const workedMinutes = session.totalWorkMinutes || 0;

    // Compliance — tamper-evident integrity seal over the immutable fields of the record.
    // Any later change to times/minutes/worker/job yields a different hash.
    const integrityHash = createHash('sha256')
      .update([
        session.publicId,
        session.worker?.id,
        job.id,
        session.checkInTime ? new Date(session.checkInTime).toISOString() : '',
        session.checkOutTime ? new Date(session.checkOutTime).toISOString() : '',
        workedMinutes,
        session.totalBreakMinutes || 0,
        session.source || 'SCAN',
      ].join('|'))
      .digest('hex');

    // Compliance — correction audit trail: approved manual edits that touched this session.
    const corrections = await this.manualRequestRepo.find({
      where: [
        { existingWorkSessionId: session.id, requestType: ManualAttendanceRequestType.EDIT_EXISTING },
        { resultWorkSessionId: session.id },
      ],
      relations: ['reviewedByUser', 'requestedByUser'],
      order: { createdAt: 'DESC' },
    });
    const correctionHistory = corrections.map((r) => ({
      status: r.status,
      requestedByRole: r.requestedByRole,
      reason: r.reason || null,
      reviewerNotes: r.reviewerNotes || null,
      reviewedAt: r.reviewedAt || null,
      reviewedByRole: r.reviewedByRole || null,
      originalCheckIn: r.originalCheckIn ? this.madridTime(r.originalCheckIn) : null,
      originalCheckOut: r.originalCheckOut ? this.madridTime(r.originalCheckOut) : null,
      requestedCheckIn: r.requestedCheckIn ? this.madridTime(r.requestedCheckIn) : null,
      requestedCheckOut: r.requestedCheckOut ? this.madridTime(r.requestedCheckOut) : null,
      createdAt: r.createdAt,
    }));

    return {
      message: 'Success', isSuccess: true, statusCode: 200,
      data: {
        recordId: session.publicId,
        integrityHash,
        correctionHistory,
        worker: { name: workerName, code: session.worker.code, photoUrl: session.worker.logoUrl || null },
        job: { name: job.jobName, publicId: job.publicId },
        client: job.client?.name || null,
        workCenter: session.workCenter?.name || null,
        // The site's own registered address. Distinct from any coordinates
        // captured at the scan — this is where the work center IS, not where the
        // worker's phone was.
        workCenterAddress: ((): string | null => {
          const addr = (session.workCenter?.address || '').trim();
          const loc = (session.workCenter?.locality || '').trim();
          if (!addr) return loc || null;
          // Full addresses usually already contain the town; appending it again
          // produced "…, Madrid, Spain, Getafe".
          if (loc && !addr.toLowerCase().includes(loc.toLowerCase())) {
            return `${addr}, ${loc}`;
          }
          return addr;
        })(),
        date: dayKey,
        checkIn: this.madridTime(session.checkInTime),
        checkOut: checkOut ? this.madridTime(session.checkOutTime) : null,
        checkInMethod: session.checkInMethod || null,
        checkOutMethod: session.checkOutMethod || null,
        isActive: session.isActive,
        source: session.source,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        shift: { start: shiftStart, end: shiftEnd },
        hours: {
          // Overtime only applies to jobs with a real schedule. Free jobs have no fixed hours,
          // so all worked time is just "worked" — never overtime.
          hasSchedule: scheduledMinutes > 0 || session.overtimeMinutes != null,
          scheduledMinutes,
          workedMinutes,
          breakMinutes: session.totalBreakMinutes || 0,
          // The frozen figure wins. Deriving it here again would disagree with
          // the overtime queue on a day the job has no shift, where the whole
          // session counts but scheduled minutes are zero.
          overtimeMinutes:
            session.overtimeMinutes != null
              ? session.overtimeMinutes
              : scheduledMinutes > 0
                ? Math.max(0, workedMinutes - scheduledMinutes)
                : 0,
          overtimeStatus: session.overtimeStatus || null,
          overtimeCompensation: session.overtimeCompensation || null,
        },
        punctuality: {
          in: this.calcPunctuality(shiftStart, this.madridMinutes(session.checkInTime)),
          out: checkOut ? this.calcPunctuality(shiftEnd, this.madridMinutes(session.checkOutTime), true) : null,
        },
        selfieUrl: scanLogs.find((s) => s.scanType === 'check-in')?.selfieUrl || null,
        webauthnVerified: !!scanLogs.find((s) => s.scanType === 'check-in')?.webauthnVerified,
        locationUnavailable: !!scanLogs.find((s) => s.scanType === 'check-in')?.locationUnavailable,
        scans,
        breaks,
        tasks,
      },
    };
  }

  /** Client schedule/programación calendar for the client's own jobs. */
  async getClientMyCalendar(userId: number, start: string, end: string) {
    if (!start || !end) throw new Error('start and end are required');
    const clientUser = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
    const clientId = clientUser?.client?.id;
    if (!clientId) throw new Error('Client not found for this user');
    const days = await this.buildClientCalendar(clientId, start, end);
    return { message: 'OK', data: days, isSuccess: true, statusCode: 200 };
  }

  // Worker names live on the workers_users junction, NOT worker.user_id (that
  // direct FK is unpopulated), so worker.user?.name is always null and callers
  // fall back to the bare code (e.g. "3434"). Resolve real names via the junction.
  private async resolveWorkerNames(workerIds: (number | null | undefined)[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    const ids = Array.from(new Set(workerIds.filter((id): id is number => id != null)));
    if (!ids.length) return names;
    const links = await this.workerUserRepo.find({
      where: ids.map((id) => ({ workerId: id })),
      relations: ['user'],
    });
    for (const l of links as any[]) {
      if (l.workerId && l.user?.name) names.set(l.workerId, l.user.name);
    }
    return names;
  }

  async getNearbyAvailableWorkers(userId: number, lat: number, lng: number, radiusMeters: number, dateStr?: string) {
    const employerUser = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!employerUser?.employer) throw new Error('Employer not found for this user');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('lat and lng are required');
    const radius = Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 10000;

    const links = await this.employerWorkerRepo.find({
      where: { employer: { id: employerUser.employer.id } },
      relations: ['worker', 'worker.user'],
    });

    const occupied = new Set<number>();
    if (dateStr) {
      const day = new Date(`${dateStr}T12:00:00`);
      const jobs = await this.jobRepo.find({
        where: { employer: { id: employerUser.employer.id } },
        relations: ['workers', 'seasonalSchedules', 'seasonalSchedules.shifts'],
      });
      for (const job of jobs) {
        if (this.jobScheduleService.isJobScheduledForDate(job, day)) {
          job.workers.forEach((w) => occupied.add(w.id));
        }
      }
    }

    // Worker names live on the workers_users junction, not worker.user_id (that
    // FK is unpopulated), so w.user?.name was always null and every card showed
    // the bare code (e.g. "3434"). Resolve real names via the junction.
    const workerIds = links.map((l) => l.worker?.id).filter((id): id is number => id != null);
    const nameByWorkerId = new Map<number, string>();
    if (workerIds.length) {
      const wus = await this.workerUserRepo.find({
        where: [...new Set(workerIds)].map((id) => ({ workerId: id })),
        relations: ['user'],
      });
      for (const wu of wus) {
        if (wu.workerId && wu.user?.name) nameByWorkerId.set(wu.workerId, wu.user.name);
      }
    }

    const result = links
      .map((l) => l.worker)
      .filter((w: any) => w && w.latitude != null && w.longitude != null)
      .map((w: any) => ({
        id: w.publicId,
        name: nameByWorkerId.get(w.id) || w.user?.name || w.code,
        occupation: w.occupation || null,
        latitude: Number(w.latitude),
        longitude: Number(w.longitude),
        distanceMeters: Math.round(this.calculateDistance(lat, lng, Number(w.latitude), Number(w.longitude))),
        available: !occupied.has(w.id),
      }))
      .filter((w) => w.distanceMeters <= radius)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return { message: 'OK', data: result, isSuccess: true, statusCode: 200 };
  }

  async getAllJobsByClientPublicId(publicId: string) {
    try {
      const client = await this.clientRepo.findOne({ where: { publicId } });
      if (!client) {
        return {
          message: 'Client not found',
          data: [],
          isSuccess: false,
          statusCode: 404,
          developerError: `Client with publicId ${publicId} not found`,
        };
      }
      return this.getAllJobsByClientId(client.id);
    } catch (error) {
      return {
        message: 'Error fetching client jobs',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

  /**
   * Shared worker for both the token-based (client dashboard) and
   * publicId-based (Clients detail page) endpoints. Keeps the formatted
   * response identical across both call sites so the frontend can reuse
   * the same row shape.
   */
  private async getAllJobsByClientId(clientId: number) {
    try {
      // Keep relations consistent with employer endpoint and include signingMethods
      const jobs = await this.jobRepo.find({
        where: { client: { id: clientId } },
        relations: ['client', 'workCenters', 'tasks', 'tasks.workCenter', 'workers', 'seasonalSchedules', 'seasonalSchedules.shifts', 'signingMethods'],
        order: { id: 'ASC', seasonalSchedules: { id: 'ASC' } },
      });

      const workerIds = jobs.flatMap(job => job.workers.map(w => w.id));
      const uniqueWorkerIds = [...new Set(workerIds)];

      const workerUsers = await this.workerUserRepo.find({
        where: uniqueWorkerIds.length
          ? uniqueWorkerIds.map(id => ({ worker: { id } }))
          : undefined,
        relations: ['user'],
      });

      const workerIdToName = new Map<number, string>();
      for (const wu of workerUsers) {
        // Use the scalar workerId — the query loads only the `user` relation,
        // so `wu.worker` is undefined and `wu.worker?.id` was always null,
        // leaving every name unresolved (frontend then showed the bare code).
        if (wu.workerId && wu.user?.name) {
          workerIdToName.set(wu.workerId, wu.user.name);
        }
      }

      // NOTE: Unlike the employer version we DO NOT fetch or expose survey flags here
      const formatted = jobs.map(job => {
        // Schedule type computation mirrors employer version
        let scheduleType: string = 'free';
        let activeScheduleWeekHours: number | null = null;
        try {
          const summary = this.jobScheduleService.getScheduleSummary(job, madridCivilToday());
          scheduleType = summary.scheduleType;
          activeScheduleWeekHours = summary.weekHours;
        } catch (e) {
          scheduleType = 'free';
          activeScheduleWeekHours = null;
        }

        return {
          jobId: job.id,
          publicId: job.publicId,
          jobName: job.jobName,
          jobStatus: job.status || JobStatus.SCHEDULED,
          clientName: job.client?.name || '',
          workCenters: job.workCenters?.map(w => ({ id: w.id, publicId: w.publicId, name: w.name, locality: (w as any).locality || null })) || [],
          workCenterNames: job.workCenters?.map(w => w.name).join(', ') || '',
          startDate: job.startDate,
          endDate: job.endDate,
          scheduleType,
          totalShifts: job.seasonalSchedules?.reduce((acc, ss) => acc + (ss.shifts?.length || 0), 0) || 0,
          expectedDuration: ((): number => {
            try {
              if (job.scheduleType === ScheduleType.FREE) return 0;
              if (job.scheduleType === ScheduleType.SEASONAL) {
                return (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
                  const shifts = ss.shifts || [];
                  const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
                  return outerAcc + ssTotal;
                }, 0);
              }
              return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
            } catch (e) {
              return (job.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.expectedDuration) || 0), 0);
            }
          })(),
          activeScheduleWeekHours,
          tasks: job.tasks?.map(task => ({ id: task.id, publicId: task.publicId, name: task.name, expectedDuration: convertMinutesToDuration(task.expectedDuration) })) || [],
          signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
          workers: job.workers.map(worker => ({ id: worker.id, publicId: worker.publicId, code: worker.code, name: workerIdToName.get(worker.id) || null, occupation: worker.occupation || null })),
        };
      });

      return {
        message: 'Success',
        data: formatted,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching client jobs',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }






  // ========== Client Dashboard Enhanced Methods ========== //

  /**
   * Get job history with detailed information for client dashboard
   */
  // async getJobHistoryForClient(userId: number, jobId?: number) {
  //   try {
  //     const clientUser = await this.clientUserRepo.findOne({
  //       where: { user: { id: userId } },
  //       relations: ['client'],
  //     });

  //     if (!clientUser?.client?.id) {
  //       throw new Error('Client not found for this user');
  //     }

  //     const clientId = clientUser.client.id;

  //     // Base query for jobs
  //     let whereClause: any = { client: { id: clientId } };
  //     if (jobId) {
  //       whereClause.id = jobId;
  //     }

  //     const jobs = await this.jobRepo.find({
  //       where: whereClause,
  //       relations: [
  //         'client', 
  //         'workCenters', 
  //         'tasks', 
  //         'workers', 
  //         'seasonalSchedules',
  //         'seasonalSchedules.shifts',
  //         'signingMethods',
  //         'scanLogs',
  //         'workSessions',
  //         'workSessions.worker'
  //       ],
  //       order: { id: 'DESC' },
  //     });

  //     // Get worker names
  //     const workerIds = jobs.flatMap(job => job.workers.map(w => w.id));
  //     const uniqueWorkerIds = [...new Set(workerIds)];

  //     const workerUsers = await this.workerUserRepo.find({
  //       where: uniqueWorkerIds.length
  //         ? uniqueWorkerIds.map(id => ({ worker: { id } }))
  //         : undefined,
  //       relations: ['user', 'worker'],
  //     });

  //     const workerIdToName = new Map<number, string>();
  //     for (const wu of workerUsers) {
  //       if (wu.worker?.id && wu.user?.name) {
  //         workerIdToName.set(wu.worker.id, wu.user.name);
  //       }
  //     }

  //     const enhancedJobs = jobs.map(job => {
  //       // Calculate time summary
  //       const workSessions = job.workSessions || [];
  //       const totalWorkMinutes = workSessions.reduce((sum, session) => sum + (session.totalWorkMinutes || 0), 0);
  //       const totalBreakMinutes = workSessions.reduce((sum, session) => sum + (session.totalBreakMinutes || 0), 0);
        
  //       // Get scan logs for this job
  //       const scanLogs = (job.scanLogs || []).map(scan => ({
  //         id: scan.id,
  //         scanType: scan.scanType,
  //         scanTime: scan.scanTime,
  //         location: scan.location,
  //         notes: scan.notes,
  //         workerId: scan.workerId,
  //         workerName: workerIdToName.get(scan.workerId) || 'Unknown',
  //       }));

  //       // Calculate check-in methods used
  //       const checkInScans = scanLogs.filter(scan => scan.scanType === 'check-in');
  //       const usedVerificationMethods = job.signingMethods?.map(sm => sm.methodType) || [];

  //       // Task checklist with completion status
  //       const taskChecklist = (job.tasks || []).map(task => ({
  //         id: task.id,
  //         name: task.name,
  //         note: task.note,
  //         expectedDuration: task.expectedDuration,
  //         isCompleted: task.isCompleted || false,
  //         completedAt: task.completedAt,
  //         completedByWorkerId: task.completedByWorkerId,
  //         completedByWorkerName: task.completedByWorkerId ? workerIdToName.get(task.completedByWorkerId) || 'Unknown' : null,
  //       }));

  //       return {
  //         jobId: job.id,
  //         jobNo: `JOB-${String(job.id).padStart(4, '0')}`,
  //         jobName: job.jobName,
  //         clientName: job.client?.name || '',
  //         workCenterNames: job.workCenters?.map(w => w.name).join(', ') || '',
  //         status: job.status || 'SCHEDULED',
  //         startDate: job.startDate,
  //         endDate: job.endDate,
  //         workers: job.workers.map(worker => ({
  //           id: worker.id,
  //           code: worker.code,
  //           name: workerIdToName.get(worker.id) || null,
  //         })),
  //         shifts: (job.seasonalSchedules || []).flatMap(ss => (ss.shifts || []).map(shift => ({
  //           startWeekday: shift.startWeekday,
  //           endWeekday: shift.endWeekday,
  //           baseStartTime: shift.baseStartTime,
  //           baseEndTime: shift.baseEndTime,
  //           isContinuous: shift.isContinuous,
  //           totalHours: shift.totalHours,
  //         }))) || [],
  //         // Security verification methods
  //         securityMethods: {
  //           available: job.signingMethods?.map(sm => ({
  //             methodType: sm.methodType,
  //             methodDetails: sm.methodDetails,
  //             verifyIdentity: sm.verifyIdentity,
  //           })) || [],
  //           used: usedVerificationMethods,
  //           checkInCount: checkInScans.length,
  //         },
  //         // Task checklist
  //         taskChecklist,
  //         taskProgress: {
  //           total: taskChecklist.length,
  //           completed: taskChecklist.filter(t => t.isCompleted).length,
  //           percentage: taskChecklist.length > 0 ? Math.round((taskChecklist.filter(t => t.isCompleted).length / taskChecklist.length) * 100) : 0,
  //         },
  //         // Time summary
  //         timeSummary: {
  //           totalWorkHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
  //           totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
  //           sessionsCount: workSessions.length,
  //           averageSessionHours: workSessions.length > 0 ? Math.round(((totalWorkMinutes / workSessions.length) / 60) * 100) / 100 : 0,
  //           workSessions: workSessions.map(session => ({
  //             id: session.id,
  //             workerName: workerIdToName.get(session.worker?.id) || 'Unknown',
  //             checkInTime: session.checkInTime,
  //             checkOutTime: session.checkOutTime,
  //             totalWorkMinutes: session.totalWorkMinutes,
  //             totalBreakMinutes: session.totalBreakMinutes,
  //             isOnBreak: session.isOnBreak,
  //           })),
  //         },
  //         // Activity history
  //         activityHistory: scanLogs,
  //         // Summary stats
  //         stats: {
  //           plannedHours: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0) || 0,
  //           actualHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
  //           efficiency: job.tasks?.length > 0 && totalWorkMinutes > 0 
  //             ? Math.round(((job.tasks.reduce((sum, t) => sum + (t.expectedDuration || 0), 0) * 60) / totalWorkMinutes) * 100) 
  //             : 0,
  //         },
  //       };
  //     });

  //     return {
  //       message: 'Success',
  //       data: enhancedJobs,
  //       isSuccess: true,
  //       statusCode: 200,
  //       developerError: '',
  //     };
  //   } catch (error) {
  //     return {
  //       message: 'Error fetching job history',
  //       data: [],
  //       isSuccess: false,
  //       statusCode: 500,
  //       developerError: error.message,
  //     };
  //   }
  // }

  

  // ========== QR Code Generation and Scanning Methods ========== //

  /**
   * Generate QR Code for a job
   */
  /**
   * Generate QR Code for an owner (client/employer) using qr_codes table (STATIC or DYNAMIC)
   * Returns QR image (base64) and token metadata
   */
  /**
   * Record a scan event and manage work sessions
   * Uses database transaction to ensure atomic operations
   */
  /**
   * Calculate the Haversine distance between two geographic points.
   * Returns distance in meters.
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6_371_000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Returns whether the current time falls within the allowed check-in window
   * for any of today's shifts: [baseStartTime - 30 min, baseEndTime + 2h].
   * FREE schedule type has no time restriction.
   * If no shifts are configured, check-in is allowed (shifts not mandatory).
   * For GPS signing method: only checks that a shift EXISTS for today (no time window).
   */
  private isWithinShiftWindow(job: Job, now: Date, signingMethod?: string): { allowed: boolean; reason?: string } {
    return this.jobScheduleService.isWithinCheckInWindow(job, now, { signingMethod });
  }

  /** Match an observed IP against a work-center allow value: exact IP, CIDR (e.g. 88.14.32.0/24), or comma-separated list of either. IPv4. */
  private ipMatches(allowed: string | null | undefined, actual: string | null | undefined): boolean {
    if (!allowed || !actual) return false;
    const a = actual.replace(/^::ffff:/, '').trim();
    for (const raw of allowed.split(',').map((s) => s.trim()).filter(Boolean)) {
      const e = raw.replace(/^::ffff:/, '');
      if (e.includes('/')) {
        if (this.ipInCidr(a, e)) return true;
      } else if (e === a) {
        return true;
      }
    }
    return false;
  }
  private ipInCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);
    if (isNaN(bits) || bits < 0 || bits > 32) return false;
    const toInt = (s: string) => {
      const parts = s.split('.');
      if (parts.length !== 4) return NaN;
      return (parts.reduce((acc, o) => (acc << 8) + (parseInt(o, 10) & 255), 0) >>> 0);
    };
    const ipInt = toInt(ip);
    const rangeInt = toInt(range);
    if (isNaN(ipInt) || isNaN(rangeInt)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  }

  async recordScan(recordScanDto: RecordScanDto, userId: number, serverIp?: string | null): Promise<{ status: string; scanData: ScanLog; workSession?: any }> {
    // IP check-in uses the server-observed IP only — client-supplied ipAddress is untrusted/spoofable.
    if (serverIp) {
      recordScanDto.ipAddress = serverIp.replace(/^::ffff:/, '');
    }
    // Resolve publicId → numeric ID at entry point
    const resolvedJobId = await this.resolvePublicId(recordScanDto.jobId);
    let resolvedWorkCenterId: number | undefined;
    if (recordScanDto.workCenterId) {
      resolvedWorkCenterId = await this.resolveWorkCenterPublicId(recordScanDto.workCenterId);
    }

    // Identity selfie: upload to Cloudinary BEFORE the DB transaction. Never blocks check-in.
    let selfieUrl: string | null = null;
    if (recordScanDto.selfie && recordScanDto.scanType === 'check-in') {
      try {
        const m = recordScanDto.selfie.match(/^data:image\/\w+;base64,(.+)$/);
        const buf = Buffer.from(m ? m[1] : recordScanDto.selfie, 'base64');
        if (buf.length > 0 && buf.length < 6 * 1024 * 1024) {
          const up = await this.cloudinaryService.uploadImage(buf, 'controljobs/checkin-selfies');
          selfieUrl = up.secureUrl;
        }
      } catch (e) {
        console.error('Selfie upload failed (check-in continues):', (e as any)?.message);
      }
    }

    // Device biometric (WebAuthn): true only if this user server-verified a passkey
    // moments ago. Read here, but ENFORCED later — see the identity block inside
    // the transaction, after the QR/location checks have passed.
    const webauthnVerified =
      recordScanDto.scanType === 'check-in' ? this.webauthnService.consumeRecentVerification(userId) : false;

    return await this.dataSource.transaction(async (txManager) => {
      try {

        // Find worker ID
        let workerId: number | null = null;
        const workerUser = await txManager.findOne(WorkerUser, {
          where: { user: { id: userId } },
          relations: ['worker'],
        });

        if (workerUser?.worker?.id) {
          workerId = workerUser.worker.id;
        } else {
          throw new ForbiddenException('Only assigned workers can check in');
        }

        if (!workerId) throw new NotFoundException('Worker not found');

        // Verify job and worker assignment
        const job = await txManager.findOne(Job, {
          where: { id: resolvedJobId },
          relations: ['workers', 'employer', 'client', 'workCenters', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        });

        if (!job) throw new NotFoundException('Job not found');
        
        const isWorkerAssigned = job.workers.some(w => w.id === workerId);
        if (!isWorkerAssigned) throw new ForbiddenException('Worker is not assigned to this job');

        // The client-reported timezone is kept only as metadata on the scan log.
        // Business schedule/shift-window checks are anchored to Europe/Madrid,
        // NOT the worker's device tz or the server clock.
        const userTimezone = recordScanDto.userTimezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          'UTC';

        if (recordScanDto.scanType === 'check-in') {
          // Build a Date whose local fields represent the Madrid wall-clock, so
          // the existing schedule readers evaluate the check against the business
          // timezone (DST-correct via Luxon) consistently with how job start/end
          // dates are compared.
          const m = madridNow();
          const madridLocal = new Date(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);

          const isScheduledToday = this.jobScheduleService.isJobScheduledForDate(job, madridLocal);
          if (!isScheduledToday) {
            throw new BadRequestException('This job is not scheduled for today. Check-in rejected.');
          }
          const timeCheck = this.isWithinShiftWindow(job, madridLocal, recordScanDto.signingMethod);
          if (!timeCheck.allowed) {
            throw new BadRequestException(timeCheck.reason || 'Check-in time is outside the allowed shift window.');
          }
        }
        
        // Determine validated work center ID
        let validatedWorkCenterId: number | undefined;

        if (recordScanDto.signingMethod === 'qrcode') {
          // The token is validated even when the worker already picked a work
          // center: accepting workCenterId on its own would let any assigned
          // worker check in from anywhere with a forged or expired QR.
          if (!recordScanDto.qrToken) {
            throw new BadRequestException('A QR code is required for QR check-in.');
          }

          // ── Merged QR: REQUIRE explicit workCenterId ──────────────────
          // Merged tokens contain multiple work centers. The frontend must
          // use GPS or manual selector to pick ONE before calling recordScan.
          // We NEVER auto-pick from a merged token — that bypasses GPS.
          if (QrMerger.isMergedToken(recordScanDto.qrToken) && !resolvedWorkCenterId) {
            throw new BadRequestException(
              'Merged QR code detected but no work center selected. ' +
              'Please select a work center before checking in.'
            );
          }

          const validationResult = await this.qrValidationService.validateQrToken(
            recordScanDto.qrToken,
            resolvedJobId,
            false,
            resolvedWorkCenterId,
          );
          if (!validationResult.valid) {
            throw new BadRequestException(validationResult.message || 'Invalid or expired QR code');
          }
          validatedWorkCenterId = resolvedWorkCenterId ?? validationResult.workCenterId;
        } else if (resolvedWorkCenterId) {
          // Manual selection provided by the worker (non-QR flows)
          validatedWorkCenterId = resolvedWorkCenterId;
        } else if (recordScanDto.signingMethod === 'gps' && !resolvedWorkCenterId && !recordScanDto.qrToken) {
          // ── Standalone GPS: auto-select nearest GPS-active WC ──────────
          if (recordScanDto.latitude == null || recordScanDto.longitude == null) {
            throw new BadRequestException('GPS coordinates are required for GPS check-in');
          }

          // Filter only WCs where GPS is explicitly activated
          const gpsActiveWcs = (job.workCenters || []).filter(
            wc => wc.isGpsActive === true && wc.latitude != null && wc.longitude != null
          );

          if (gpsActiveWcs.length === 0) {
            throw new BadRequestException('GPS check-in is not available — no work center has GPS activated');
          }

          // Calculate distance to each GPS-active WC and filter by radius
          const validWcs = gpsActiveWcs
            .map(wc => ({
              id: wc.id,
              name: wc.name,
              distance: this.calculateDistance(
                recordScanDto.latitude!,
                recordScanDto.longitude!,
                Number(wc.latitude),
                Number(wc.longitude),
              ),
              allowedRadius: wc.gpsRadius ?? 100,
            }))
            .filter(wc => wc.distance <= wc.allowedRadius)
            .sort((a, b) => a.distance - b.distance);

          if (validWcs.length === 0) {
            throw new BadRequestException('You are not in range of any work center');
          }

          // Select nearest GPS-active WC within range
          validatedWorkCenterId = validWcs[0].id;
        } else if (recordScanDto.signingMethod === 'ip' && !resolvedWorkCenterId && !recordScanDto.qrToken) {
          // ── Standalone IP: auto-select matching IP-active WC ──────────
          if (!recordScanDto.ipAddress) {
            throw new BadRequestException('IP address is required for IP check-in');
          }

          const ipActiveWcs = (job.workCenters || []).filter(
            wc => wc.isIpActive === true && wc.allowedIp != null
          );

          if (ipActiveWcs.length === 0) {
            throw new BadRequestException('IP check-in is not available — no work center has IP check-in activated');
          }

          const matchingWc = ipActiveWcs.find(wc => this.ipMatches(wc.allowedIp, recordScanDto.ipAddress));

          if (!matchingWc) {
            throw new BadRequestException(`Your IP address (${recordScanDto.ipAddress}) does not match any work center's allowed IP`);
          }

          validatedWorkCenterId = matchingWc.id;
        }

        // WorkCenter membership check
        if (validatedWorkCenterId && job.workCenters?.length) {
          const jobWcIds = job.workCenters.map(wc => wc.id);
          if (!jobWcIds.includes(validatedWorkCenterId)) {
            throw new BadRequestException('Selected work center does not belong to this job.');
          }
        }

        // ── QR activation ──────────────────────────────────────────
        // The work center switch is the authority for every method. Token
        // validity alone is not enough: deactivating QR in the Methods tab
        // also deactivates the qr_code rows, so this used to be blocked only
        // as a side effect. If the flag and the rows ever drift, QR would read
        // "off" in the UI while still letting workers in.
        //
        // Applies to check-out too: it was check-in only, so a deactivated
        // method still closed the day — the end of a shift is as much a part
        // of the record as its start.
        if (
          recordScanDto.signingMethod === 'qrcode' &&
          validatedWorkCenterId
        ) {
          const resolvedWc = job.workCenters?.find(wc => wc.id === validatedWorkCenterId);
          if (resolvedWc && !resolvedWc.isQrcodeActive) {
            throw new BadRequestException('QR check-in is not activated for this work center');
          }
        }

        // ── IP validation ──────────────────────────────────────────
        // Activation is checked on the way out as well; matching the address
        // stays check-in only, since where somebody finishes is a separate
        // product question from whether the method is switched on.
        if (recordScanDto.signingMethod === 'ip' && validatedWorkCenterId) {
          const resolvedWc = job.workCenters?.find(wc => wc.id === validatedWorkCenterId);
          if (resolvedWc) {
            if (!resolvedWc.isIpActive) {
              throw new BadRequestException('IP check-in is not activated for this work center');
            }
            if (
              recordScanDto.scanType === 'check-in' &&
              resolvedWc.allowedIp &&
              !this.ipMatches(resolvedWc.allowedIp, recordScanDto.ipAddress)
            ) {
              throw new BadRequestException(`Your IP address does not match the allowed IP for "${resolvedWc.name}"`);
            }
          }
        }

        // ── GPS activation ─────────────────────────────────────────
        // Checked before, and independently of, the coordinates: it used to
        // sit inside the proximity block, so a check-out — or any scan with
        // no coordinates — skipped the switch altogether.
        if (recordScanDto.signingMethod === 'gps' && validatedWorkCenterId) {
          const gpsWc = job.workCenters?.find(wc => wc.id === validatedWorkCenterId);
          if (gpsWc && !gpsWc.isGpsActive) {
            throw new BadRequestException('GPS check-in is not activated for this work center');
          }
        }

        // ── GPS proximity enforcement (check-in only) ──────────────────────────
        // If the resolved work center has GPS coordinates AND the worker sent their
        // coordinates, enforce that the worker is within the allowed radius.
        // Note: For standalone GPS flow, proximity was already validated during auto-selection above.
        if (
          recordScanDto.scanType === 'check-in' &&
          validatedWorkCenterId &&
          recordScanDto.latitude != null &&
          recordScanDto.longitude != null
        ) {
          const resolvedWc = job.workCenters?.find(wc => wc.id === validatedWorkCenterId);

          if (resolvedWc && resolvedWc.latitude != null && resolvedWc.longitude != null) {
            const distanceMeters = this.calculateDistance(
              recordScanDto.latitude,
              recordScanDto.longitude,
              Number(resolvedWc.latitude),
              Number(resolvedWc.longitude),
            );
            const allowedRadius = resolvedWc.gpsRadius ?? 100;
            if (distanceMeters > allowedRadius) {
              throw new BadRequestException(
                `You are ${Math.round(distanceMeters)}m away from "${resolvedWc.name}". ` +
                `Check-in is only allowed within ${allowedRadius}m of the work center.`
              );
            }
          }
        }

        // Identity enforcement — deliberately LAST of the checks. Asking a worker
        // to present a fingerprint only to then reject the scan for an expired QR
        // or a closed shift window wastes the one step that costs them effort.
        // On verifyIdentity jobs the selfie is OPTIONAL, but device biometric is
        // REQUIRED once the worker has enrolled a device.
        // Disable entirely with IDENTITY_ENFORCE=false.
        if (recordScanDto.scanType === 'check-in' && process.env.IDENTITY_ENFORCE !== 'false') {
          const idJob = await txManager.findOne(Job, {
            where: { id: resolvedJobId },
            relations: ['signingMethods'],
          });
          const requiresIdentity = (idJob?.signingMethods || []).some(
            (sm: any) => sm.verifyIdentity === true,
          );
          if (requiresIdentity && !webauthnVerified && (await this.webauthnService.hasCredential(userId))) {
            throw new ForbiddenException(
              'Se requiere verificación biométrica del dispositivo para fichar.',
            );
          }
        }

        // Create scan log
        const scanLog = txManager.create(ScanLog, {
          jobId: resolvedJobId,
          workerId: workerId,
          workCenterId: validatedWorkCenterId,
          scanType: recordScanDto.scanType,
          location: recordScanDto.location,
          notes: recordScanDto.notes,
          userTimezone: userTimezone,
          signingMethod: recordScanDto.signingMethod,
          ipAddress: recordScanDto.ipAddress,
          latitude: recordScanDto.latitude,
          longitude: recordScanDto.longitude,
          qrToken: recordScanDto.qrToken,
          selfieUrl: selfieUrl,
          webauthnVerified: webauthnVerified,
          locationUnavailable: !!recordScanDto.locationUnavailable,
        });

        const savedScanLog = await txManager.save(ScanLog, scanLog);

        // Handle work session
        let workSession = null;
        
        switch (recordScanDto.scanType) {
          case 'check-in':
            workSession = await this.handleCheckInTx(txManager, resolvedJobId, workerId, recordScanDto.signingMethod, validatedWorkCenterId);
            // Emit alert after transaction
            if (job?.employer?.id && job?.client?.id) {
              const employerUser = await txManager.findOne(EmployerUser, { where: { employer: { id: job.employer.id } }, relations: ['user'] });
              const clientUser = await txManager.findOne(ClientUser, { where: { client: { id: job.client.id } }, relations: ['user'] });
              if (employerUser?.user?.id && clientUser?.user?.id) {
                const checkinWorker = job.workers?.find(w => w.id === workerId);
                setImmediate(() => {
                  this.alertsService.createAndEmitAlert({
                    type: 'CHECK_IN',
                    jobId: job.id,
                    jobPublicId: job.publicId,
                    workerId,
                    workerPublicId: checkinWorker?.publicId,
                    employerUserId: employerUser.user.id,
                    clientUserId: clientUser.user.id,
                    message: `Worker checked in to ${job.jobName}`,
                    meta: { jobName: job.jobName },
                  });
                });
              }
            }
            break;
          case 'break-start':
            workSession = await this.handleBreakStartTx(txManager, resolvedJobId, workerId);
            break;
          case 'break-end':
            workSession = await this.handleBreakEndTx(txManager, resolvedJobId, workerId);
            break;
          case 'check-out':
            workSession = await this.handleCheckOutTx(txManager, resolvedJobId, workerId, recordScanDto.signingMethod, validatedWorkCenterId);
            if (job?.employer?.id && job?.client?.id) {
              const employerUser = await txManager.findOne(EmployerUser, { where: { employer: { id: job.employer.id } }, relations: ['user'] });
              const clientUser = await txManager.findOne(ClientUser, { where: { client: { id: job.client.id } }, relations: ['user'] });
              if (employerUser?.user?.id && clientUser?.user?.id) {
                const checkoutWorker = job.workers?.find(w => w.id === workerId);
                setImmediate(() => {
                  this.alertsService.createAndEmitAlert({
                    type: 'CHECK_OUT',
                    jobId: job.id,
                    jobPublicId: job.publicId,
                    workerId,
                    workerPublicId: checkoutWorker?.publicId,
                    employerUserId: employerUser.user.id,
                    clientUserId: clientUser.user.id,
                    message: `Worker checked out from ${job.jobName}`,
                    meta: { jobName: job.jobName },
                  });
                });
              }
            }
            break;
        }

        // Bind the scan to the session it just acted on — the check-in scan to
        // the new session, the check-out scan to the session it closed, break
        // scans to the active one. This is what lets the record detail show
        // exactly this session's scans instead of guessing by time window.
        if ((workSession as any)?.id) {
          savedScanLog.workSessionId = (workSession as any).id;
          await txManager.save(ScanLog, savedScanLog);
        }

        return {
          status: 'Scan recorded successfully',
          scanData: savedScanLog,
          workSession,
        };
      } catch (error) {
        console.error('❌ Transaction failed:', error.message);
        // Rejections we raised deliberately (outside shift window, wrong work
        // center, too far away…) are meant for the worker. Re-wrapping them in a
        // plain Error made the exception filter answer 500 'unexpectedError',
        // which hid every real check-in failure behind the same message.
        if (error instanceof HttpException) throw error;
        throw new InternalServerErrorException(`Failed to record scan: ${error.message}`);
      }
    });
  }

  /**
   * Handle check-in logic
   */
  private async handleCheckIn(jobId: number, workerId: number, signingMethod?: string, workCenterId?: number) {
    // Check if there's already an active work session
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (activeSession) {
      throw new ConflictException('Worker already has an active session for this job');
    }

    // Get user timezone from the most recent scan log
    const recentScanLog = await this.scanLogRepo.findOne({
      where: {
        jobId: jobId,
        workerId: workerId,
      },
      order: { id: 'DESC' }
    });
    
    const userTimezone = recentScanLog?.userTimezone || 'UTC';
    
    // Create new work session using Luxon to ensure UTC storage
    const utcNow = DateTime.utc().toJSDate();
    
    const workSession = this.workSessionRepo.create({
      jobId: jobId,
      workerId: workerId,
      checkInTime: utcNow,
      checkInMethod: signingMethod,
      workCenterId: workCenterId,
      isActive: true,
      isOnBreak: false,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
    });

    const savedWorkSession = await this.workSessionRepo.save(workSession);

    // Update job status to IN_PROGRESS when worker checks in
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
    });

    if (job && job.status !== JobStatus.IN_PROGRESS) {
      job.status = JobStatus.IN_PROGRESS;
      await this.jobRepo.save(job);
    }

    return savedWorkSession;
  }

  /**
   * Handle break start logic
   */
  private async handleBreakStart(jobId: number, workerId: number) {
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found for this worker and job');
    }

    if (activeSession.isOnBreak) {
      throw new BadRequestException('Worker is already on break');
    }

    // Update session to indicate break start
    activeSession.isOnBreak = true;
    activeSession.currentBreakStart = new Date();

    return await this.workSessionRepo.save(activeSession);
  }

  /**
   * Handle break end logic
   */
  private async handleBreakEnd(jobId: number, workerId: number) {
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found for this worker and job');
    }

    if (!activeSession.isOnBreak || !activeSession.currentBreakStart) {
      throw new BadRequestException('Worker is not currently on break');
    }

    // Calculate break duration and add to total using Luxon
    const utcNow = DateTime.utc();
    const breakStartUtc = DateTime.fromJSDate(activeSession.currentBreakStart, { zone: 'UTC' });
    const breakDurationMinutes = Math.floor(utcNow.diff(breakStartUtc, 'minutes').minutes);
    
    activeSession.totalBreakMinutes += breakDurationMinutes;
    activeSession.isOnBreak = false;
    activeSession.currentBreakStart = null;

    return await this.workSessionRepo.save(activeSession);
  }

  /**
   * Handle check-out logic
   */
  private async handleCheckOut(jobId: number, workerId: number, signingMethod?: string, workCenterId?: number) {
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found for this worker and job');
    }

    // If worker is on break, end the break first
    if (activeSession.isOnBreak && activeSession.currentBreakStart) {
      const utcNow = DateTime.utc();
      const breakStartUtc = DateTime.fromJSDate(activeSession.currentBreakStart, { zone: 'UTC' });
      const breakDurationMinutes = Math.floor(utcNow.diff(breakStartUtc, 'minutes').minutes);
      activeSession.totalBreakMinutes += breakDurationMinutes;
      activeSession.isOnBreak = false;
      activeSession.currentBreakStart = null;
    }

    // Calculate total work time using Luxon for UTC consistency
    const utcNow = DateTime.utc();
    const checkOutTime = utcNow.toJSDate();
    const checkInTime = DateTime.fromJSDate(activeSession.checkInTime, { zone: 'UTC' });
    
    const totalSessionMinutes = Math.floor(utcNow.diff(checkInTime, 'minutes').minutes);
    activeSession.totalWorkMinutes = totalSessionMinutes - activeSession.totalBreakMinutes;
    activeSession.checkOutMethod = signingMethod;
    activeSession.checkOutTime = checkOutTime;
    activeSession.isActive = false;

    const updatedSession = await this.workSessionRepo.save(activeSession);

    // Update job status based on check-out and task completion
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
  relations: ['tasks', 'tasks.workCenter', 'workSessions'],
    });

    if (job) {
      // Check if all tasks for this job are completed
      const allTasksCompleted = job.tasks?.length > 0 ? job.tasks.every(task => task.isCompleted) : true;
      
      // Check if all workers have checked out (no active sessions)
      const activeWorkSessions = await this.workSessionRepo.find({
        where: {
          job: { id: jobId },
          checkOutTime: IsNull(),
        },
      });
      
      const allWorkersCheckedOut = activeWorkSessions.length === 0;
      
      // If this is the last worker checking out and there are incomplete tasks,
      // we can optionally auto-complete them (business logic decision)
      if (allWorkersCheckedOut && job.tasks?.length > 0 && !allTasksCompleted) {
        // Note: We're not auto-completing tasks here to maintain data integrity
        // Tasks should be explicitly marked as complete by workers
      }
      
      // Update job status to COMPLETED if:
      // 1. All tasks are completed AND all workers have checked out, OR
      // 2. All workers have checked out (regardless of task completion - business decision)
      if (allWorkersCheckedOut) {
        job.status = JobStatus.COMPLETED;
        await this.jobRepo.save(job);
      }
    }

  // Save all task statuses for today when worker checks out
  await this.saveAllTaskStatusesOnCheckout(jobId, workerId);
  return updatedSession;
  }

  /**
   * Get current work session status for a worker and job
   */
  async getWorkerSessionStatus(jobId: number, workerId: number) {
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
      relations: ['job', 'worker'],
    });

    if (!activeSession) {
      return {
        hasActiveSession: false,
        sessionData: null,
      };
    }

    // Calculate current work time
    const now = new Date();
    let currentWorkMinutes = 0;
    let currentBreakMinutes = activeSession.totalBreakMinutes;

    if (activeSession.isOnBreak && activeSession.currentBreakStart) {
      // Currently on break - add current break time
      const currentBreakDuration = Math.floor((now.getTime() - activeSession.currentBreakStart.getTime()) / (1000 * 60));
      currentBreakMinutes += currentBreakDuration;
    }

    // Total session time minus total break time
    const totalSessionTime = Math.floor((now.getTime() - activeSession.checkInTime.getTime()) / (1000 * 60));
    currentWorkMinutes = totalSessionTime - currentBreakMinutes;

    return {
      hasActiveSession: true,
      sessionData: {
        id: activeSession.id,
        checkInTime: activeSession.checkInTime,
        onBreak: activeSession.isOnBreak,
        lastBreakStartTime: activeSession.currentBreakStart,
        totalWorkMinutes: currentWorkMinutes,
        totalBreakMinutes: currentBreakMinutes,
        totalSessionMinutes: totalSessionTime,
      },
    };
  }

  /**
   * Transaction-aware check-in handler
   */
  private async handleCheckInTx(txManager: any, jobId: number, workerId: number, signingMethod?: string, workCenterId?: number) {
    // Any open session blocks a new one, not just one on this job — the worker
    // must close the running one first. Name it so they know where to go.
    const activeSession = await txManager.findOne(WorkSession, {
      where: { workerId, checkOutTime: IsNull() },
      relations: ['job'],
    });

    if (activeSession) {
      // English, like every other message here — the frontend matches on these
      // substrings and renders a translated equivalent.
      const where = activeSession.job?.jobName ? ` on "${activeSession.job.jobName}"` : '';
      throw new ConflictException(
        activeSession.jobId === jobId
          ? 'Worker is already checked in to this job'
          : `Worker already has an open session${where}. Check out before starting another job.`,
      );
    }

    const utcNow = DateTime.utc().toJSDate();
    const workSession = txManager.create(WorkSession, {
      jobId, workerId,
      checkInTime: utcNow,
      checkInMethod: signingMethod,
      workCenterId: workCenterId,
      isActive: true,
      isOnBreak: false,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
    });

    let saved;
    try {
      saved = await txManager.save(WorkSession, workSession);
    } catch (err: any) {
      // 23505 = unique violation. Two indexes can fire here:
      // ux_worker_active_session (one active session per worker, any job) and
      // uq_work_sessions_open_per_job_worker (one open session per job+worker).
      // Either means a concurrent check-in won the race between the lookup above
      // and this insert — a conflict, not an unexpected server error.
      if (err?.code === '23505') {
        throw new ConflictException('Worker already has an active session');
      }
      throw err;
    }

    const job = await txManager.findOne(Job, { where: { id: jobId } });
    if (job && job.status !== JobStatus.IN_PROGRESS) {
      job.status = JobStatus.IN_PROGRESS;
      await txManager.save(Job, job);
    }

    return saved;
  }

  /**
   * Transaction-aware break start handler
   */
  private async handleBreakStartTx(txManager: any, jobId: number, workerId: number) {
    const activeSession = await txManager.findOne(WorkSession, {
      where: { jobId, workerId, checkOutTime: IsNull() },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found');
    }

    if (activeSession.isOnBreak) {
      throw new BadRequestException('Worker is already on break');
    }

    activeSession.isOnBreak = true;
    activeSession.currentBreakStart = new Date();
    return await txManager.save(WorkSession, activeSession);
  }

  /**
   * Transaction-aware break end handler
   */
  private async handleBreakEndTx(txManager: any, jobId: number, workerId: number) {
    const activeSession = await txManager.findOne(WorkSession, {
      where: { jobId, workerId, checkOutTime: IsNull() },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found');
    }

    if (!activeSession.isOnBreak || !activeSession.currentBreakStart) {
      throw new BadRequestException('Worker is not currently on break');
    }

    const utcNow = DateTime.utc();
    const breakStartUtc = DateTime.fromJSDate(activeSession.currentBreakStart, { zone: 'UTC' });
    const breakDurationMinutes = Math.floor(utcNow.diff(breakStartUtc, 'minutes').minutes);
    
    activeSession.totalBreakMinutes += breakDurationMinutes;
    activeSession.isOnBreak = false;
    activeSession.currentBreakStart = null;
    return await txManager.save(WorkSession, activeSession);
  }

  /**
   * Transaction-aware check-out handler
   */
  private async handleCheckOutTx(txManager: any, jobId: number, workerId: number, signingMethod?: string, workCenterId?: number) {
    const activeSession = await txManager.findOne(WorkSession, {
      where: { jobId, workerId, checkOutTime: IsNull() },
    });

    if (!activeSession) {
      throw new BadRequestException('No active session found for this worker and job');
    }

    if (activeSession.isOnBreak && activeSession.currentBreakStart) {
      const utcNow = DateTime.utc();
      const breakStartUtc = DateTime.fromJSDate(activeSession.currentBreakStart, { zone: 'UTC' });
      const breakDurationMinutes = Math.floor(utcNow.diff(breakStartUtc, 'minutes').minutes);
      activeSession.totalBreakMinutes += breakDurationMinutes;
      activeSession.isOnBreak = false;
      activeSession.currentBreakStart = null;
    }

    const utcNow = DateTime.utc();
    const checkOutTime = utcNow.toJSDate();
    const checkInTime = DateTime.fromJSDate(activeSession.checkInTime, { zone: 'UTC' });
    
    const totalSessionMinutes = Math.floor(utcNow.diff(checkInTime, 'minutes').minutes);
    activeSession.totalWorkMinutes = totalSessionMinutes - activeSession.totalBreakMinutes;
    activeSession.checkOutMethod = signingMethod;
    activeSession.checkOutTime = checkOutTime;
    activeSession.isActive = false;

    const updated = await txManager.save(WorkSession, activeSession);

    const job = await txManager.findOne(Job, {
      where: { id: jobId },
      relations: ['tasks'],
    });

    if (job) {
      const activeWorkSessions = await txManager.find(WorkSession, {
        where: { jobId, checkOutTime: IsNull() },
      });
      
      if (activeWorkSessions.length === 0) {
        job.status = JobStatus.COMPLETED;
        await txManager.save(Job, job);
      }
    }

    await this.saveTaskStatusesOnCheckoutTx(txManager, jobId, workerId);
    return updated;
  }

  /**
   * Transaction-aware task status save
   */
  private async saveTaskStatusesOnCheckoutTx(txManager: any, jobId: number, workerId: number) {
    // Madrid civil day (matches the non-tx twin saveAllTaskStatusesOnCheckout);
    // a raw server-local `new Date()` would bucket an overnight checkout done
    // just after Madrid midnight onto the previous day.
    const today = madridTodayKey();

    const job = await txManager.findOne(Job, {
      where: { id: jobId },
      relations: ['tasks'],
    });
    
    if (!job || !job.tasks || job.tasks.length === 0) {
      return;
    }
    
    for (const task of job.tasks) {
      const existingRecord = await txManager.findOne(TaskHistory, {
        where: { taskId: task.id, jobId, date: today },
      });
      
      if (!existingRecord) {
        const history = txManager.create(TaskHistory, {
          taskId: task.id,
          jobId,
          date: today,
          isCompleted: task.isCompleted,
          completedByWorkerId: task.isCompleted ? workerId : null,
        });
        await txManager.save(TaskHistory, history);
      }
    }
  }

  /**
   * Complete a task
   */
  // async completeTask(taskId: number, workerId: number) {
  //   const task = await this.taskRepo.findOne({
  //     where: { id: taskId },
  //     relations: ['job'],
  //   });

  //   if (!task) {
  //     throw new Error('Task not found');
  //   }

  //   // Check if worker is assigned to this job
  //   const job = await this.jobRepo.findOne({
  //     where: { id: task.job.id },
  //     relations: ['workers'],
  //   });

  //   if (!job) {
  //     throw new Error('Job not found');
  //   }

  //   const isWorkerAssigned = job.workers.some(w => w.id === workerId);
  //   if (!isWorkerAssigned) {
  //     throw new Error('Worker is not assigned to this job');
  //   }

  //   // Update task as completed
  //   task.isCompleted = true;
  //   task.completedAt = new Date();
  //   task.completedByWorkerId = workerId;

  //   const updatedTask = await this.taskRepo.save(task);

  //   // Check if all tasks for this job are completed
  //   const allTasks = await this.taskRepo.find({
  //     where: { job: { id: task.job.id } },
  //   });

  //   const allTasksCompleted = allTasks.every(t => t.isCompleted);
  //   if (allTasksCompleted) {
  //     job.status = JobStatus.COMPLETED;
  //     await this.jobRepo.save(job);
  //   }

  //   return {
  //     task: updatedTask,
  //     allTasksCompleted,
  //     jobStatus: job.status,
  //   };
  // }

  /**
   * Get task completion status for a job
   */
  async getJobTaskStatus(jobId: number) {
    const tasks = await this.taskRepo.find({
      where: { job: { id: jobId } },
      order: { id: 'ASC' },
    });

    const completedTasks = tasks.filter(t => t.isCompleted);
    const allTasksCompleted = tasks.length > 0 && completedTasks.length === tasks.length;

    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      allTasksCompleted,
      tasks: tasks.map(task => ({
        id: task.id,
        name: task.name,
        note: task.note,
        expectedDuration: task.expectedDuration,
        isCompleted: task.isCompleted,
        completedAt: task.completedAt,
        completedByWorkerId: task.completedByWorkerId,
      })),
    };
  }



  /**
   * Get worker ID from user ID
   */
  async getWorkerIdFromUserId(userId: number): Promise<number> {
    const workerUser = await this.workerUserRepo.findOne({
      where: { user: { id: userId } },
      relations: ['worker'],
    });

    if (!workerUser?.worker) {
      throw new Error('Worker not found for this user');
    }

    return workerUser.worker.id;
  }

/**
 * Get scan history for a job, grouped by date for daily history cards
 */
async getJobScanHistory(jobId: number, startDate?: string, endDate?: string): Promise<any> {
  try {
    // Query scan logs
    const scanQuery = this.scanLogRepo.createQueryBuilder('scanLog')
      .leftJoinAndSelect('scanLog.worker', 'worker')
      .leftJoinAndSelect('worker.user', 'user')
      .where('scanLog.jobId = :jobId', { jobId });

    if (startDate) {
      scanQuery.andWhere('scanLog.scanTime >= :startDate', { startDate });
    }
    if (endDate) {
      scanQuery.andWhere('scanLog.scanTime < :endDate', { endDate: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)) });
    }

    const scanLogs = await scanQuery.orderBy('scanLog.scanTime', 'ASC').getMany();

    // Query work sessions - FIND SESSIONS THAT OVERLAP THE DATE RANGE
    const sessionQuery = this.workSessionRepo.createQueryBuilder('workSession')
      .leftJoinAndSelect('workSession.worker', 'worker')
      .leftJoinAndSelect('worker.user', 'user')
      .where('workSession.jobId = :jobId', { jobId });

    if (startDate && endDate) {
      // Session overlaps if: checkInTime <= endDate AND (checkOutTime >= startDate OR checkOutTime IS NULL)
      const endDatePlusOne = new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));
      sessionQuery.andWhere(
        '(workSession.checkInTime < :endDate AND (workSession.checkOutTime >= :startDate OR workSession.checkOutTime IS NULL))',
        { startDate, endDate: endDatePlusOne }
      );
    } else if (startDate) {
      sessionQuery.andWhere(
        '(workSession.checkOutTime >= :startDate OR workSession.checkOutTime IS NULL)',
        { startDate }
      );
    } else if (endDate) {
      const endDatePlusOne = new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));
      sessionQuery.andWhere('workSession.checkInTime < :endDate', { endDate: endDatePlusOne });
    }

    const workSessions = await sessionQuery.getMany();

    const nameByWorkerId = await this.resolveWorkerNames([
      ...scanLogs.map((l: any) => l.worker?.id),
      ...workSessions.map((s: any) => s.worker?.id),
    ]);

    // Query task history for this job
    const taskHistoryQuery = this.taskHistoryRepo.createQueryBuilder('taskHistory')
      .leftJoinAndSelect('taskHistory.task', 'task')
      .leftJoinAndSelect('taskHistory.completedBy', 'worker')
      .where('taskHistory.jobId = :jobId', { jobId });
    
    if (startDate) {
      taskHistoryQuery.andWhere('taskHistory.date >= :startDate', { startDate });
    }
    if (endDate) {
      taskHistoryQuery.andWhere('taskHistory.date <= :endDate', { endDate });
    }
    
    const taskHistories = await taskHistoryQuery.getMany();

    // Group scan logs by date
    const groupedByDate = scanLogs.reduce((acc, log) => {
      const date = this.madridDateKey(log.scanTime);
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        id: log.id,
        scanType: log.scanType,
        scanTime: log.scanTime,
        location: log.location,
        notes: log.notes,
        worker: {
          id: log.worker.id,
          code: log.worker.code,
          name: nameByWorkerId.get(log.worker.id) || log.worker.user?.name || null,
        },
      });
      return acc;
    }, {});

    // Pair break-start and break-end events for each day
    const breaksByDate = {};
    for (const date in groupedByDate) {
      breaksByDate[date] = [];
      let currentBreakStart = null;
      for (const log of groupedByDate[date]) {
        if (log.scanType === 'break-start') {
          currentBreakStart = log;
        } else if (log.scanType === 'break-end' && currentBreakStart) {
          const durationMinutes = Math.floor((new Date(log.scanTime).getTime() - new Date(currentBreakStart.scanTime).getTime()) / (1000 * 60));
          breaksByDate[date].push({
            breakStart: {
              id: currentBreakStart.id,
              scanTime: currentBreakStart.scanTime,
              notes: currentBreakStart.notes,
            },
            breakEnd: {
              id: log.id,
              scanTime: log.scanTime,
              notes: log.notes,
            },
            durationMinutes,
            worker: log.worker,
          });
          currentBreakStart = null;
        }
      }
    }

    // Group work sessions by date - SHOW ON ALL DATES THE SESSION SPANS
    const sessionsByDate = workSessions.reduce((acc, session) => {
      // Bucket by Madrid calendar date so spanning days are correct from any server/viewer tz
      const checkInDateStr = this.madridDateKey(session.checkInTime);
      const checkOutDateStr = this.madridDateKey(session.checkOutTime || new Date());
      
      // Session data to be replicated across all dates
      const sessionData = {
        id: session.id,
        worker: {
          id: session.worker.id,
          code: session.worker.code,
          name: nameByWorkerId.get(session.worker.id) || session.worker.user?.name || null,
        },
        checkInTime: session.checkInTime,
        checkOutTime: session.checkOutTime,
        totalWorkMinutes: session.totalWorkMinutes,
        totalBreakMinutes: session.totalBreakMinutes,
        isOnBreak: session.isOnBreak,
        isActive: session.isActive,
      };
      
      // Add session to EVERY date it spans using date string iteration
      const startDate = new Date(checkInDateStr + 'T00:00:00');
      const endDate = new Date(checkOutDateStr + 'T00:00:00');
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        
        // Add flags to indicate check-in/check-out days
        const sessionForDate = {
          ...sessionData,
          isCheckInDay: dateStr === checkInDateStr,
          isCheckOutDay: session.checkOutTime && dateStr === checkOutDateStr,
        };
        
        acc[dateStr].push(sessionForDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return acc;
    }, {});
    
    // Group task histories by date
    const tasksByDate = taskHistories.reduce((acc, task) => {
      // Convert to YYYY-MM-DD format
      const dateObj = new Date(task.date);
      const date = dateObj.toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = [];
      }
      
      acc[date].push({
        id: task.taskId,
        name: task.task?.name || '',
        completed: task.isCompleted,
        completedByWorkerId: task.completedByWorkerId,
      });
      
      return acc;
    }, {});

    // Get all unique dates from scans, sessions, and tasks
    const allDates = new Set([
      ...Object.keys(groupedByDate),
      ...Object.keys(sessionsByDate),
      ...Object.keys(tasksByDate)
    ]);

    // Combine into daily history cards
    const result: any[] = Array.from(allDates).map(date => ({
      date,
      scans: groupedByDate[date] || [],
      breaks: breaksByDate[date] || [],
      sessions: sessionsByDate[date] || [],
      tasks: tasksByDate[date] || [], // Include tasks for each date
    }));

    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['seasonalSchedules', 'seasonalSchedules.shifts', 'tasks', 'alerts'],
    });
    const jobTaskCount = job?.tasks?.length || 0;
    const alertRules: Alert[] = job?.alerts || [];
    const todayStr = this.madridDateKey(new Date());

    const parseTriggerMinutes = (s: string): number | null => {
      if (!s) return null;
      const [h, m] = s.split(':').map(Number);
      if (Number.isNaN(h)) return null;
      return h * 60 + (m || 0);
    };

    const computeAlertCount = (day: any): number => {
      if (!alertRules.length) return 0;
      const checkIns = (day.scans || [])
        .filter((s: any) => s.scanType === 'check-in')
        .sort((a: any, b: any) => new Date(a.scanTime).getTime() - new Date(b.scanTime).getTime());
      if (checkIns.length === 0) return 0;
      const hasCheckOut = (day.scans || []).some((s: any) => s.scanType === 'check-out');
      const checkInMinutes = this.madridMinutes(checkIns[0].scanTime);
      const workedMinutes = (day.sessions || []).reduce((sum: number, s: any) => sum + (s.totalWorkMinutes || 0), 0);

      let count = 0;
      for (const rule of alertRules) {
        if (rule.alertType === AlertType.DELAY) {
          const trig = parseTriggerMinutes(rule.triggerTime);
          if (trig != null && checkInMinutes > trig) count++;
        } else if (rule.alertType === AlertType.DURATION) {
          if (rule.minDuration != null && workedMinutes < rule.minDuration) count++;
        } else if (rule.alertType === AlertType.SIGN_OUT) {
          if (!hasCheckOut && day.date !== todayStr) count++;
        }
      }
      return count;
    };

    const parseDateOnly = (s: string): Date => {
      const [y, m, d] = s.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    if (job) {
      for (const day of result) {
        day.scheduledMinutes = this.jobScheduleService.getScheduledMinutesForDate(job, parseDateOnly(day.date));
        day.scheduledTaskCount = jobTaskCount;
        day.alertCount = computeAlertCount(day);
      }

      if (startDate && endDate) {
        const existingDates = new Set(result.map(r => r.date));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const jobStart = new Date(job.startDate);
        jobStart.setHours(0, 0, 0, 0);
        let cur = parseDateOnly(startDate);
        if (cur < jobStart) cur = new Date(jobStart);
        const end = parseDateOnly(endDate);

        while (cur <= end && cur <= today) {
          const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
          const sm = this.jobScheduleService.getScheduledMinutesForDate(job, cur);
          if (!existingDates.has(ds) && sm > 0) {
            result.push({
              date: ds,
              scans: [],
              breaks: [],
              sessions: [],
              tasks: [],
              scheduledMinutes: sm,
              scheduledTaskCount: jobTaskCount,
              alertCount: 0,
            });
            existingDates.add(ds);
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    return {
      message: 'Success',
      data: result,
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  } catch (error) {
    return {
      message: 'Failed to fetch scan history',
      data: [],
      isSuccess: false,
      statusCode: 500,
      developerError: error.message,
    };
  }
}


  /**
   * Get scan history for a worker
   */
  // async getWorkerScanHistory(workerId: number): Promise<any[]> {
  //   try {
  //     const scanLogs = await this.scanLogRepo.find({
  //       where: { workerId },
  //       relations: ['job', 'job.client'],
  //       order: { scanTime: 'DESC' },
  //     });

  //     return scanLogs.map(log => ({
  //       id: log.id,
  //       scanType: log.scanType,
  //       scanTime: log.scanTime,
  //       location: log.location,
  //       notes: log.notes,
  //       job: {
  //         id: log.job.id,
  //         jobName: log.job.jobName,
  //         clientName: log.job.client?.name || '',
  //       },
  //     }));
  //   } catch (error) {
  //     throw new Error(`Failed to fetch worker scan history: ${error.message}`);
  //   }
  // }

  /**
   * Get today's attendance summary for a job
   */
  // async getTodayAttendanceSummary(jobId: number): Promise<any> {
  //   try {
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     const tomorrow = new Date(today);
  //     tomorrow.setDate(tomorrow.getDate() + 1);

  //     const todayScans = await this.scanLogRepo
  //       .createQueryBuilder('scan')
  //       .leftJoinAndSelect('scan.worker', 'worker')
  //       .leftJoinAndSelect('worker.user', 'user')
  //       .where('scan.jobId = :jobId', { jobId })
  //       .andWhere('scan.scanTime >= :today', { today })
  //       .andWhere('scan.scanTime < :tomorrow', { tomorrow })
  //       .orderBy('scan.scanTime', 'ASC')
  //       .getMany();

  //     // Group scans by worker
  //     const workerScans = new Map();
      
  //     todayScans.forEach(scan => {
  //       const workerId = scan.workerId;
  //       if (!workerScans.has(workerId)) {
  //         workerScans.set(workerId, {
  //           worker: {
  //             id: scan.worker.id,
  //             code: scan.worker.code,
  //             name: scan.worker.user?.name || null,
  //           },
  //           scans: [],
  //         });
  //       }
  //       workerScans.get(workerId).scans.push({
  //         scanType: scan.scanType,
  //         scanTime: scan.scanTime,
  //         location: scan.location,
  //       });
  //     });

  //     return {
  //       date: today.toISOString().split('T')[0],
  //       totalWorkers: workerScans.size,
  //       attendanceData: Array.from(workerScans.values()),
  //     };
  //   } catch (error) {
  //     throw new Error(`Failed to fetch attendance summary: ${error.message}`);
  //   }
  // }

  // ========== Job Status Management Methods ========== //

  /**
   * Update job status
   */
  async updateJobStatus(jobId: number, updateJobStatusDto: UpdateJobStatusDto, userId: number): Promise<{ message: string; job: Job }> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['employer', 'client', 'workCenters'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Update status
      job.status = updateJobStatusDto.status;
      await this.jobRepo.save(job);

      return {
        message: `Job status updated to ${updateJobStatusDto.status}`,
        job,
      };
    } catch (error) {
      throw new Error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: JobStatus, userId: number): Promise<Job[]> {
    try {
      return await this.jobRepo.find({
          where: { status },
          relations: ['client', 'workCenters', 'workers', 'tasks', 'tasks.workCenter', 'seasonalSchedules', 'seasonalSchedules.shifts'],
        });
    } catch (error) {
      throw new Error(`Failed to fetch jobs by status: ${error.message}`);
    }
  }

  /**
   * Automatically update job status based on current date and scan activities
   */
  async autoUpdateJobStatus(jobId: number): Promise<void> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['scanLogs', 'tasks', 'tasks.workCenter'],
      });

      if (!job) {
        return;
      }

      const currentDate = new Date();
      const startDate = new Date(job.startDate);
      const endDate = new Date(job.endDate);

      // Auto-update logic
      if (currentDate < startDate && job.status === JobStatus.SCHEDULED) {
        // Job is still scheduled, do nothing
        return;
      }

      if (currentDate >= startDate && currentDate <= endDate) {
        // Check if workers have checked in
        const hasCheckIns = job.scanLogs?.some(scan => scan.scanType === 'check-in');
        if (hasCheckIns && job.status !== JobStatus.IN_PROGRESS) {
          job.status = JobStatus.IN_PROGRESS;
          await this.jobRepo.save(job);
        } else if (!hasCheckIns && job.status === JobStatus.SCHEDULED) {
          job.status = JobStatus.PENDING;
          await this.jobRepo.save(job);
        }
      }

      if (currentDate > endDate) {
        // Check if all tasks are completed or workers have checked out
        const hasCheckOuts = job.scanLogs?.some(scan => scan.scanType === 'check-out');
        if (hasCheckOuts && job.status === JobStatus.IN_PROGRESS) {
          job.status = JobStatus.COMPLETED;
          await this.jobRepo.save(job);
        }
      }
    } catch (error) {
      console.error(`Failed to auto-update job status: ${error.message}`);
    }
  }

// mark the task complete or leave for incomplete

async toggleTaskCompletion(taskId: number, workerId: number, jobId: number) {
  try {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Verify task exists and belongs to this job
    const task = await this.taskRepo.findOne({
      where: { id: taskId, job: { id: jobId } },
      relations: ['job', 'job.workers', 'taskHistories'],
    });

    if (!task) {
      throw new Error('Task not found in this job');
    }

    // Verify worker is assigned to this job
    const isWorkerAssigned = task.job.workers.some(w => w.id === workerId);
    if (!isWorkerAssigned) {
      throw new Error('Worker not assigned to this job');
    }

    // Find or create TaskHistory for today
    let todayHistory = task.taskHistories?.find(history => {
      const historyDate = new Date(history.date).toISOString().split('T')[0];
      return historyDate === todayString && history.completedByWorkerId === workerId;
    });

    if (todayHistory) {
      // If already completed, don't allow unmarking
      if (todayHistory.isCompleted) {
        return {
          message: 'Task already marked as completed',
          isCompleted: true,
          taskHistory: {
            id: todayHistory.id,
            taskId: todayHistory.taskId,
            jobId: todayHistory.jobId,
            date: todayHistory.date,
            isCompleted: todayHistory.isCompleted,
            completedAt: todayHistory.completedAt,
            completedByWorkerId: todayHistory.completedByWorkerId,
          },
          isSuccess: true,
          statusCode: 200,
          developerError: '',
        };
      }
      
      // Mark as completed (first time)
      todayHistory.isCompleted = true;
      todayHistory.completedAt = new Date();
      todayHistory.completedByWorkerId = workerId;
      
      const updatedHistory = await this.taskHistoryRepo.save(todayHistory);
      
      return {
        message: 'Task marked as completed successfully',
        isCompleted: updatedHistory.isCompleted,
        taskHistory: {
          id: updatedHistory.id,
          taskId: updatedHistory.taskId,
          jobId: updatedHistory.jobId,
          date: updatedHistory.date,
          isCompleted: updatedHistory.isCompleted,
          completedAt: updatedHistory.completedAt,
          completedByWorkerId: updatedHistory.completedByWorkerId,
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } else {
      // Create new TaskHistory for today (marking as completed)
      const newHistory = this.taskHistoryRepo.create({
        taskId,
        jobId,
        date: new Date(todayString), // Store as date
        isCompleted: true, // First toggle always marks as complete
        completedAt: new Date(),
        completedByWorkerId: workerId,
      });

      const savedHistory = await this.taskHistoryRepo.save(newHistory);

      return {
        message: 'Task marked as completed successfully',
        isCompleted: true,
        taskHistory: {
          id: savedHistory.id,
          taskId: savedHistory.taskId,
          jobId: savedHistory.jobId,
          date: savedHistory.date,
          isCompleted: savedHistory.isCompleted,
          completedAt: savedHistory.completedAt,
          completedByWorkerId: savedHistory.completedByWorkerId,
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    }
  } catch (error) {
    return {
      message: 'Failed to toggle task completion',
      isCompleted: null,
      isSuccess: false,
      statusCode: 500,
      developerError: error.message,
    };
  }
}

/**
   * Save all tasks' statuses for the job for today when a worker checks out
   */
  private async saveAllTaskStatusesOnCheckout(jobId: number, workerId: number) {
    const todayString = madridTodayKey();
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
  relations: ['tasks', 'tasks.workCenter', 'tasks.taskHistories', 'workers'],
    });
    if (!job) return;
    // Only save histories for tasks that are scheduled for today according to recurrence rules.
    const isWorkerAssigned = job.workers.some(w => w.id === workerId);
    if (!isWorkerAssigned) return;

    // Fetch recurrence results in parallel to avoid N+1 latency
    const recurrenceResults = await Promise.all((job.tasks || []).map(t => this.generateRecurrenceForTask(t.id, false).catch(() => null)));

    for (let i = 0; i < (job.tasks || []).length; i++) {
      const task = job.tasks[i];
      const recur = recurrenceResults[i];

      // If recurrence generator failed or doesn't list occurrences, skip this task
      let occursToday = false;
      if (recur && recur.data && Array.isArray(recur.data.occurrences)) {
        const occKeys = recur.data.occurrences.map((d: any) => {
          const dd = new Date(d);
          return dd.toISOString().split('T')[0];
        });
        occursToday = occKeys.includes(todayString);
      }

      if (!occursToday) {
        // don't persist histories for tasks that are not scheduled today
        continue;
      }

      let todayHistory = task.taskHistories?.find(history => {
        const historyDate = new Date(history.date).toISOString().split('T')[0];
        return historyDate === todayString && history.completedByWorkerId === workerId;
      });

      // If a completed history already exists for this task/worker/date, do NOT overwrite it
      if (todayHistory && todayHistory.isCompleted) {
        continue;
      }

      if (todayHistory) {
        todayHistory.isCompleted = !!task.isCompleted;
        todayHistory.completedAt = task.isCompleted ? new Date() : null;
        todayHistory.completedByWorkerId = workerId; // Always set to current worker
        await this.taskHistoryRepo.save(todayHistory);
      } else {
        const newHistory = this.taskHistoryRepo.create({
          taskId: task.id,
          jobId,
          date: new Date(todayString),
          isCompleted: !!task.isCompleted,
          completedAt: task.isCompleted ? new Date() : null,
          completedByWorkerId: workerId, // Always set to current worker
        });
        await this.taskHistoryRepo.save(newHistory);
      }
    }
  }


    /**
   * Fetch task history for a job, worker, and date
   */
async getTaskHistoryForJobWorkerDate(jobId: number, workerId: number, date?: string): Promise<any> {
  try {
    const query = this.taskHistoryRepo.createQueryBuilder('taskHistory')
      .leftJoinAndSelect('taskHistory.task', 'task')
      .where('taskHistory.jobId = :jobId', { jobId })
      .andWhere('taskHistory.completedByWorkerId = :workerId', { workerId });
    if (date) {
      query.andWhere('taskHistory.date = :date', { date });
    }
    const histories = await query.getMany();
    const grouped: { [date: string]: any[] } = {};
    histories.forEach(h => {
      const dateObj = new Date(h.date); // Ensure date is a Date object
      const d = dateObj.toISOString().split('T')[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({
        id: h.taskId,
        name: h.task?.name || '',
        completed: h.isCompleted,
        completedByWorkerId: h.completedByWorkerId,
      });
    });
    return {
      data: Object.entries(grouped).map(([date, tasks]) => ({ date, tasks })),
      isSuccess: true,
      message: 'Success',
    };
  } catch (error) {
    return {
      data: [],
      isSuccess: false,
      message: 'Failed to fetch task history',
      statusCode: 500,
      developerError: error.message,
    };
  }
}

  /**
   * Get all tasks for a job and worker, including today's task-history for that worker
   */
  async getTasksForJobWorker(jobId: number, workerId: number): Promise<any> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['client', 'workCenters', 'tasks', 'tasks.workCenter', 'tasks.taskHistories', 'workers'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Verify worker assigned to job
      const isAssigned = job.workers?.some(w => w.id === Number(workerId));
      if (!isAssigned) {
        const errNames = await this.resolveWorkerNames([Number(workerId), ...(job.workers || []).map((w) => w.id)]);
        const workerName = errNames.get(Number(workerId)) || 'Unknown worker';

        // Return a specific error with all fields needed by frontend to handle this gracefully
        return {
          message: `Worker (ID: ${workerId}) is not assigned to this job`,
          data: {
            jobId,
            workerId,
            allowedWorkers: (job.workers || []).map((w) => ({
              id: w.id,
              name: errNames.get(w.id) || `Worker ${w.id}`,
            })),
            isSuccess: false, // Include inside data for better client detection
            statusCode: 403,
            developerError: `Worker ${workerId} is not assigned to Job ${jobId}`,
            errorCode: 'WORKER_NOT_ASSIGNED'
          },
          isSuccess: false, // Keep top-level for backward compatibility
          statusCode: 403, // Forbidden is more accurate than 500 for this business rule violation
          developerError: `Worker ${workerId} is not assigned to Job ${jobId}`,
          errorCode: 'WORKER_NOT_ASSIGNED'
        };
      }

      const todayString = madridTodayKey(); // YYYY-MM-DD, business tz

      // Get worker name if available
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: workerId },
        relations: ['user'],
      });
      const workerName = workerUser?.user?.name || null;

      const tasks = (job.tasks || []).map(task => {
        const histories = task.taskHistories || [];
        const todayHistory = histories.find(h => {
          const hDate = new Date(h.date).toISOString().split('T')[0];
          return h.completedByWorkerId === workerId && hDate === todayString;
        }) || null;

        return {
          id: task.id,
          name: task.name,
          note: task.note,
          expectedDuration: task.expectedDuration,
          defaultIsCompleted: !!task.isCompleted,
          // Per-worker todays status (null if none)
          workerIsCompletedToday: todayHistory ? !!todayHistory.isCompleted : null,
          completedAt: todayHistory ? todayHistory.completedAt : null,
          completedByWorkerId: todayHistory ? todayHistory.completedByWorkerId : null,
          // Include recent histories for frontend if required
          taskHistories: histories.map(h => ({
            id: h.id,
            date: h.date,
            isCompleted: h.isCompleted,
            completedAt: h.completedAt,
            completedByWorkerId: h.completedByWorkerId,
          })),
          // periodicity fields
          periodicity: task.periodicity || null,
          periodicityValue: (task as any)?.periodicityValue ?? (task as any)?.interval ?? null,
          interval: (task as any)?.interval ?? null,
        };
      });

      return {
        message: 'Success',
        data: {
          jobId: job.id,
          jobName: job.jobName,
          clientName: job.client?.name || '',
          workCenterNames: job.workCenters?.map(w => w.name).join(', ') || '',
          workerName,
          tasks,
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching tasks for job and worker',
        data: null,
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }



  /**
   * Fetch a single task by its id with relations
   */
  async getTaskById(taskId: number) {
    try {
      const task = await this.taskRepo.findOne({
        where: { id: taskId },
        relations: ['job', 'taskHistories'],
      });

      if (!task) {
        return {
          message: 'Task not found',
          data: null,
          isSuccess: false,
          statusCode: 404,
          developerError: '',
        };
      }

      return {
        message: 'Success',
        data: task,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching task',
        data: null,
        isSuccess: false,
        statusCode: 500,
        developerError: error?.message || String(error),
      };
    }
  }

  /**
   * Generate recurrence occurrences for a task based on its periodicity config.
   * If persist is true, updates task.periodicityValue/startDate/endDate accordingly.
   */
  async generateRecurrenceForTask(taskId: number, persist = false) {
    try {
      const task = await this.taskRepo.findOne({ where: { id: taskId } })

      if (!task) {
        return { message: 'Task not found', data: null, isSuccess: false, statusCode: 404, developerError: '' }
      }

  // normalize dates to UTC midnight (avoid local timezone shifting when serialized)
  const rawStart = task.startDate ? new Date(task.startDate) : (() => { const d = new Date(); d.setDate(d.getDate()+1); return d })()
  const startDate = new Date(Date.UTC(rawStart.getFullYear(), rawStart.getMonth(), rawStart.getDate()))
  const rawEnd = task.endDate ? new Date(task.endDate) : new Date(new Date(rawStart).setFullYear(rawStart.getFullYear()+1))
  const endDate = new Date(Date.UTC(rawEnd.getFullYear(), rawEnd.getMonth(), rawEnd.getDate()))
      const interval = (task as any).interval || 1

      const occurrences: Date[] = []

      const addIfInRange = (d: Date) => {
        // normalize candidate to UTC midnight so JSON serialization keeps the same calendar date
        const dd = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
        const s = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()))
        const e = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()))
        if (dd >= s && dd <= e) {
          occurrences.push(dd)
        }
      }

      if (task.periodicity === 'once') {
        if (task.onceDate) addIfInRange(new Date(task.onceDate))
      } else if (task.periodicity === 'daily') {
        const cur = new Date(startDate)
        while (cur <= endDate) {
          addIfInRange(new Date(cur))
          cur.setDate(cur.getDate() + interval)
        }
      } else if (task.periodicity === 'weekly') {
        // weeklyDays stored as simple-array of numbers (0..6)
        const weekDays: number[] = (task.weeklyDays || []).map((v: any) => Number(v))
        if (weekDays.length) {
          const cur = new Date(startDate)
          // move to start of week window
          while (cur <= endDate) {
            const weekStart = new Date(cur)
            // for each weekday
            for (const wd of weekDays) {
              const candidate = new Date(weekStart)
              candidate.setDate(weekStart.getDate() + ((wd - weekStart.getDay() + 7) % 7))
              addIfInRange(candidate)
            }
            cur.setDate(cur.getDate() + 7 * interval)
          }
        }
      } else if (task.periodicity === 'monthly') {
        // monthlyDays: array of numeric days 1..31
        const monthlyDays: number[] = (task as any).monthlyDays || []
        if (monthlyDays && monthlyDays.length) {
          const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          while (cur <= endDate) {
            const year = cur.getFullYear(); const month = cur.getMonth()
            for (const day of monthlyDays) {
              const lastDay = new Date(year, month+1, 0).getDate()
              const validDay = Math.min(Math.max(1, Number(day)), lastDay)
              const candidate = new Date(year, month, validDay)
              addIfInRange(candidate)
            }
            cur.setMonth(cur.getMonth() + interval)
          }
        }
        // monthlyWeekdays: support selecting weekdays (1..7 where 7 may be used for Sunday)
        // Expected behavior: for each selected weekday produce up to the first 4 weekly occurrences in the month
        const monthlyWeekdays: number[] = (task as any).monthlyWeekdays || []
        if (monthlyWeekdays && monthlyWeekdays.length) {
          const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          while (cur <= endDate) {
            const year = cur.getFullYear(); const month = cur.getMonth()
            const firstDayOfMonth = new Date(year, month, 1).getDay() // 0..6 (Sun..Sat)

            for (const rawWd of monthlyWeekdays) {
              // normalize stored value: allow 1..7 or 0..6; treat 7 as 0 (Sunday)
              let wd = Number(rawWd)
              if (isNaN(wd)) continue
              if (wd === 7) wd = 0
              if (wd === 0) wd = 0
              // If user stored 1..7 (Mon..Sun) convert to 0..6 (Sun..Sat) assuming 1=Mon
              // Heuristics: if values appear in range 1..7 and not 0..6, try converting where 1=>1 (Mon) isn't correct for JS, so if any value >6 map (value % 7)
              if (wd > 6) wd = wd % 7

              // find first occurrence of wd in this month
              const offset = (wd - firstDayOfMonth + 7) % 7
              const firstOccurDay = 1 + offset // day-of-month for first occurrence

              // add up to 4 weekly occurrences (first + 0..3 weeks)
              for (let weekIndex = 0; weekIndex < 4; weekIndex++) {
                const dayOfMonth = firstOccurDay + weekIndex * 7
                const lastDay = new Date(year, month + 1, 0).getDate()
                if (dayOfMonth > lastDay) break
                const candidate = new Date(year, month, dayOfMonth)
                addIfInRange(candidate)
              }
            }

            cur.setMonth(cur.getMonth() + interval)
          }
        }
        // NEW: support selecting the first occurrence of a weekday in each month
        const monthlyStartWeekday = (task as any).monthlyStartWeekday
        if (typeof monthlyStartWeekday !== 'undefined' && monthlyStartWeekday !== null) {
          const wd = Number(monthlyStartWeekday)
          const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          while (cur <= endDate) {
            const year = cur.getFullYear(); const month = cur.getMonth()
            const firstDayOfMonth = new Date(year, month, 1).getDay()
            const offset = (wd - firstDayOfMonth + 7) % 7
            const dayOfMonth = 1 + offset
            const candidate = new Date(year, month, dayOfMonth)
            addIfInRange(candidate)
            cur.setMonth(cur.getMonth() + interval)
          }
        }

        // NEW: support selecting the last occurrence of a weekday in each month
        const monthlyEndWeekday = (task as any).monthlyEndWeekday
        if (typeof monthlyEndWeekday !== 'undefined' && monthlyEndWeekday !== null) {
          const wd = Number(monthlyEndWeekday)
          const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
          while (cur <= endDate) {
            const year = cur.getFullYear(); const month = cur.getMonth()
            const lastDay = new Date(year, month + 1, 0).getDate()
            const lastDate = new Date(year, month, lastDay)
            const lastWeekday = lastDate.getDay()
            const offset = (lastWeekday - wd + 7) % 7
            const dayOfMonth = lastDay - offset
            const candidate = new Date(year, month, dayOfMonth)
            addIfInRange(candidate)
            cur.setMonth(cur.getMonth() + interval)
          }
        }
      } else if (task.periodicity === 'yearly') {
        const months: number[] = (task as any).yearlyMonths || [] // 1..12
        const days: number[] = (task as any).yearlyDays || []
        if (months.length && days.length) {
          const startYear = startDate.getFullYear(); const endYear = endDate.getFullYear()
          for (let y = startYear; y <= endYear; y += interval) {
            for (const m of months) {
              for (const d of days) {
                const lastDay = new Date(y, m, 0).getDate()
                const validDay = Math.min(Math.max(1, Number(d)), lastDay)
                addIfInRange(new Date(y, m-1, validDay))
              }
            }
          }
        }
      }

      // sort unique
      const map = new Map<string, Date>()
      occurrences.forEach(d => map.set(d.toDateString(), d))
      const unique = Array.from(map.values()).sort((a,b)=>a.getTime()-b.getTime())

      // create a human readable periodicityValue
      let periodicityValue = ''
      const startDateStr = startDate.toISOString().split('T')[0]
      if (task.periodicity === 'weekly') {
        const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        const wd = (task.weeklyDays||[]).map((v:any)=>names[Number(v)]).filter(Boolean)
        periodicityValue = `Every ${interval} week(s) on ${wd.join(', ')} starting ${startDateStr}`
      } else if (task.periodicity === 'monthly') {
        const md = (task as any).monthlyDays || []
        const mw = (task as any).monthlyWeekdays || []
        const ms = (task as any).monthlyStartWeekday
        const me = (task as any).monthlyEndWeekday
        if (md && md.length) {
          periodicityValue = `Every ${interval} month(s) on days ${md.join(', ')}`
        } else if (mw && mw.length) {
          // normalize to 0..6 where 0=Sunday
          const norm = mw.map((v:any) => {
            let n = Number(v)
            if (isNaN(n)) return null
            if (n === 7) return 0
            if (n > 6) return n % 7
            return n
          }).filter((v:any) => v !== null) as number[]
          const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          const nameList = norm.map(n => names[n]).filter(Boolean)
          // match requested format and include numeric mapping note
          periodicityValue = `Every ${interval} month(s) on weekdays ${nameList.join(', ')} (0=Sunday, 1=Monday, …, 6=Saturday) starting ${startDateStr}`
        } else if (typeof ms !== 'undefined' && ms !== null) {
          const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          const n = Number(ms)
          const name = names[(n === 7 ? 0 : (n > 6 ? n % 7 : n))] || String(ms)
          periodicityValue = `Every ${interval} month(s) on the first ${name} starting ${startDateStr}`
        } else if (typeof me !== 'undefined' && me !== null) {
          const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          const n = Number(me)
          const name = names[(n === 7 ? 0 : (n > 6 ? n % 7 : n))] || String(me)
          periodicityValue = `Every ${interval} month(s) on the last ${name} starting ${startDateStr}`
        } else {
          periodicityValue = `Every ${interval} month(s) starting ${startDateStr}`
        }
      } else if (task.periodicity === 'daily') {
        periodicityValue = `Every ${interval} day(s) starting ${startDateStr}`
      } else if (task.periodicity === 'once') {
        periodicityValue = `Once on ${task.onceDate ? new Date(task.onceDate).toISOString().split('T')[0] : startDate.toISOString().split('T')[0]}`
      } else if (task.periodicity === 'yearly') {
        const months: number[] = (task as any).yearlyMonths || [] // 1..12
        const days: number[] = (task as any).yearlyDays || []
        if (months.length && days.length) {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          const mapped = months.map(m => {
            const idx = Number(m) - 1
            return monthNames[idx] || String(m)
          })
          periodicityValue = `Every ${interval} year(s) on ${mapped.join(', ')} ${days.join(', ')} starting ${startDateStr}`
        } else {
          periodicityValue = `Every ${interval} year(s) starting ${startDateStr}`
        }
      }

      // Optionally persist periodicityValue/start/end to task
      if (persist) {
        try {
          (task as any).periodicityValue = periodicityValue
          task.startDate = startDate
          task.endDate = endDate
          await this.taskRepo.save(task)
        } catch (err) {
          // ignore persistence error but include developerError
          return { message: 'Recurrence generated with persistence error', data: { startDate, endDate, periodicityValue, occurrences: unique, monthlyDays: (task as any).monthlyDays || null, monthlyWeekdays: (task as any).monthlyWeekdays || null, yearlyMonths: (task as any).yearlyMonths || null, yearlyDays: (task as any).yearlyDays || null }, isSuccess: true, statusCode: 200, developerError: String(err) }
        }
      }

      return { message: 'Success', data: { startDate, endDate, periodicityValue, occurrences: unique, monthlyDays: (task as any).monthlyDays || null, monthlyWeekdays: (task as any).monthlyWeekdays || null, yearlyMonths: (task as any).yearlyMonths || null, yearlyDays: (task as any).yearlyDays || null, explanation: `Generated ${unique.length} occurrences` }, isSuccess: true, statusCode: 200, developerError: '' }
    } catch (error) {
      return { message: 'Error generating recurrence', data: null, isSuccess: false, statusCode: 500, developerError: error?.message || String(error) }
    }
  }

  /**
   * Get today's tasks for a job grouped by work center
   */
  async getTodayTasksByWorkCenter(jobId: number, workerId: number) {
    try {
      // "Today" is the business day in Madrid, not the server's UTC day —
      // otherwise around midnight the wrong weekday is used and a task shows
      // (or hides) on the wrong day.
      const today = DateTime.now().setZone(JobService.BUSINESS_TZ).startOf('day');
      const todayISODate = today.toISODate();

      // Fetch all tasks for the job with work center relation
      const tasks = await this.taskRepo.find({
        where: { job: { id: jobId } },
        relations: ['workCenter', 'taskHistories'],
        order: { workCenterId: 'ASC', id: 'ASC' },
      });

      // Filter tasks scheduled for today
      const todayTasks = tasks.filter(task => this.isTaskScheduledForToday(task, today));

      // Get task completion status for today for this worker

      const taskHistories = await this.taskHistoryRepo.find({
        where: {
          task: In(todayTasks.map(t => t.id)),
          completedByWorkerId: workerId,
          date: todayISODate as any,
        },
        relations: ['task'],
      });


      const taskHistoryMap = new Map<number, boolean>();
      taskHistories.forEach(th => {
        taskHistoryMap.set(th.task.id, th.isCompleted);
      });

      // Group tasks by work center
      const workCenterMap = new Map<number | null, any[]>();
      
      todayTasks.forEach(task => {
        const wcId = task.workCenterId;
        const isCompleted = taskHistoryMap.get(task.id) || task.isCompleted || false;
        
        const taskData = {
          id: task.id,
          name: task.name,
          note: task.note || '',
          expectedDuration: task.expectedDuration,
          timing: task.timing,
          isCompleted: isCompleted,
          workCenterId: task.workCenterId,
          workCenterName: task.workCenter?.name || 'Unassigned',
        };

        if (!workCenterMap.has(wcId)) {
          workCenterMap.set(wcId, []);
        }
        workCenterMap.get(wcId).push(taskData);
      });

      // Format response
      const workCenters = Array.from(workCenterMap.entries()).map(([wcId, tasks]) => ({
        workCenterId: wcId,
        workCenterName: tasks[0]?.workCenterName || 'Unassigned',
        tasks: tasks,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.isCompleted).length,
      }));

      return {
        message: 'Success',
        data: {
          date: todayISODate,
          workCenters: workCenters,
          totalTasks: todayTasks.length,
          totalCompleted: todayTasks.filter(t => taskHistoryMap.get(t.id) || t.isCompleted).length,
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching today tasks',
        data: null,
        isSuccess: false,
        statusCode: 500,
        developerError: error?.message || String(error),
      };
    }
  }

  /**
   * Helper: Check if a task is scheduled for today
   */
  private isTaskScheduledForToday(task: any, today: DateTime): boolean {
    const todayDayOfWeek = today.weekday % 7; // Convert to 0=Sunday format
    const todayDayOfMonth = today.day;
    const todayMonth = today.month;
    const todayISO = today.toISODate();

    // startDate/endDate/onceDate are date-only columns; compare them as Madrid
    // calendar dates ("YYYY-MM-DD" strings sort chronologically) so no tz shift
    // can move a boundary across midnight.
    const dateOnly = (v: any): string | null => {
      if (!v) return null;
      if (typeof v === 'string') return v.slice(0, 10);
      return DateTime.fromJSDate(new Date(v)).setZone(JobService.BUSINESS_TZ).toISODate();
    };

    // Check start/end date boundaries
    const startISO = dateOnly(task.startDate);
    if (startISO && todayISO && todayISO < startISO) {
      return false;
    }
    const endISO = dateOnly(task.endDate);
    if (endISO && todayISO && todayISO > endISO) {
      return false;
    }

    switch (task.periodicity) {
      case 'once': {
        const onceISO = dateOnly(task.onceDate);
        return !!onceISO && onceISO === todayISO;
      }

      case 'daily':
        return true; // Daily tasks are always scheduled

      case 'weekly':
        // Ensure weeklyDays is an array of numbers
        const weeklyDays = Array.isArray(task.weeklyDays)
          ? task.weeklyDays.map(d => Number(d))
          : [];


        if (weeklyDays.length > 0) {
          return weeklyDays.includes(todayDayOfWeek);
        }
        return false;

      case 'monthly':
        // Ensure arrays are properly formatted
        const monthlyDays = Array.isArray(task.monthlyDays)
          ? task.monthlyDays.map(d => Number(d))
          : [];
        const monthlyWeekdays = Array.isArray(task.monthlyWeekdays)
          ? task.monthlyWeekdays.map(d => Number(d))
          : [];


        // Check monthly days (1-31)
        if (monthlyDays.length > 0) {
          if (monthlyDays.includes(todayDayOfMonth)) {
            return true;
          }
        }
        // Check monthly weekdays
        if (monthlyWeekdays.length > 0) {
          if (monthlyWeekdays.includes(todayDayOfWeek)) {
            return true;
          }
        }
        return false;

      case 'yearly':
        // Ensure arrays are properly formatted
        const yearlyMonths = Array.isArray(task.yearlyMonths)
          ? task.yearlyMonths.map(m => Number(m))
          : [];
        const yearlyDays = Array.isArray(task.yearlyDays)
          ? task.yearlyDays.map(d => Number(d))
          : [];


        // Check if today matches any yearly configuration
        if (yearlyMonths.length > 0) {
          if (!yearlyMonths.includes(todayMonth)) {
            return false;
          }
        }
        if (yearlyDays.length > 0) {
          const matches = yearlyDays.includes(todayDayOfMonth);
          return matches;
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Get all work session records for employer's jobs
   */
  async getEmployerWorkSessionRecords(
    employerUserId: number,
    jobId?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      // First, find the employer through EmployerUser junction table
      const employerUserLink = await this.dataSource.getRepository('EmployerUser').findOne({
        where: { user: { id: employerUserId } },
        relations: ['employer', 'user'],
      }) as any;

      if (!employerUserLink || !employerUserLink.employer) {
        return {
          message: 'Employer not found for this user',
          data: [],
          isSuccess: false,
          statusCode: 404,
          developerError: 'No employer association found for user ID ' + employerUserId
        };
      }

      const employerId = employerUserLink.employer.id;
      const employerName = employerUserLink.employer.name;

      // Build query for work sessions
      const query = this.workSessionRepo.createQueryBuilder('workSession')
        .leftJoinAndSelect('workSession.job', 'job')
        .leftJoinAndSelect('job.client', 'client')
        .leftJoinAndSelect('job.employer', 'employer')
        .leftJoinAndSelect('workSession.worker', 'worker')
        .leftJoinAndSelect('worker.user', 'workerUser')
        .leftJoinAndSelect('workSession.workCenter', 'workCenter')
        .leftJoinAndSelect('job.seasonalSchedules', 'ss')
        .leftJoinAndSelect('ss.shifts', 'shifts')
        .where('employer.id = :employerId', { employerId });

      // Filter by specific job if provided
      if (jobId) {
        query.andWhere('job.id = :jobId', { jobId });
      }

      // Filter by date range if provided
      if (startDate) {
        query.andWhere('workSession.checkInTime >= :startDate', { startDate });
      }
      if (endDate) {
        const endDatePlusOne = new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));
        query.andWhere('workSession.checkInTime < :endDate', { endDate: endDatePlusOne });
      }

      // Order by most recent first
      query.orderBy('workSession.checkInTime', 'DESC');

      const workSessions = await query.getMany();

      const _wids = Array.from(new Set(workSessions.map((s: any) => s.worker?.id).filter(Boolean)));
      const _wus = _wids.length ? await this.workerUserRepo.find({ where: _wids.map((id: any) => ({ workerId: id })), relations: ['user'] }) : [];
      const _nameBy = new Map<number, string>();
      _wus.forEach((wu: any) => { if (wu.user?.name) _nameBy.set(wu.workerId, wu.user.name); });

      // Format the data for the frontend
      const formattedRecords = workSessions.map(session => {
        const checkInDate = new Date(session.checkInTime);
        const checkOutDate = session.checkOutTime ? new Date(session.checkOutTime) : null;
        
        const fecha = checkOutDate
          ? `${this.madridDate(checkInDate)} - ${this.madridDate(checkOutDate)}`
          : `${this.madridDate(checkInDate)} - En progreso`;

        const entrada = this.madridTime(checkInDate);
        const salida = checkOutDate
          ? this.madridTime(checkOutDate)
          : session.isActive ? 'En progreso' : '-';
        
        // Format total work time
        const totalHours = Math.floor(session.totalWorkMinutes / 60);
        const totalMinutes = session.totalWorkMinutes % 60;
        const total = `${totalHours}h ${totalMinutes}m`;
        
        // Check for alerts (e.g., active session, long breaks, etc.)
        const alerts = [];
        if (session.isActive && !session.checkOutTime) {
          alerts.push('Sesión activa');
        }
        if (session.totalBreakMinutes > 60) {
          alerts.push('Descanso largo');
        }

        const _dayDate = new Date(`${this.madridDateKey(session.checkInTime)}T12:00:00`);
        const _shifts = session.job ? this.jobScheduleService.getShiftsForDate(session.job, _dayDate) : [];
        const _starts = _shifts.map((s: any) => s.baseStartTime).filter(Boolean).sort();
        const _shiftStart = _starts[0] ? _starts[0].slice(0, 5) : null;
        const _p = this.calcPunctuality(_shiftStart, this.madridMinutes(session.checkInTime));
        const puntualidad = _p?.status === 'late' ? `+${_p.minutes}m tarde` : _p?.status === 'early' ? 'Adelantado' : _p?.status === 'onTime' ? 'A tiempo' : '—';
        const _schedMin = session.job ? (this.jobScheduleService.getScheduledMinutesForDate(session.job, _dayDate) || 0) : 0;
        const extra = this.overtimeLabel(session, _schedMin);
        const centro = (session as any).workCenter?.name || '—';
        const metodo = session.checkInMethod || '—';

        return {
          id: session.publicId || session.id.toString(),
          workSessionId: session.id,
          workSessionPublicId: session.publicId,
          jobId: session.job.id,
          jobPublicId: session.job.publicId,
          fecha,
          titular: employerName || 'N/A',
          job: session.job.jobName || 'N/A',
          trabajador: _nameBy.get(session.worker?.id) || session.worker.user?.name || session.worker.code || 'N/A',
          workerCode: session.worker.code,
          workerPublicId: session.worker.publicId,
          centro,
          entrada,
          salida,
          total,
          extra,
          metodo,
          puntualidad,
          punctuality: _p?.status ?? null,
          lateMinutes: _p?.status === 'late' ? _p.minutes : null,
          totalWorkMinutes: session.totalWorkMinutes,
          totalBreakMinutes: session.totalBreakMinutes,
          alerts: alerts.length > 0 ? alerts.join(', ') : 'None',
          isActive: session.isActive,
          isOnBreak: session.isOnBreak,
          clientName: session.job.client?.name || 'N/A',
          checkInTime: session.checkInTime,
          checkOutTime: session.checkOutTime,
        };
      });

      return {
        message: 'Success',
        data: formattedRecords,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Failed to fetch work session records',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

  /**
   * Get all work session records for the signed-in worker.
   * Mirrors getEmployerWorkSessionRecords but scoped to the worker.
   */
  async getWorkerWorkSessionRecords(
    workerUserId: number,
    jobId?: number,
    startDate?: string,
    endDate?: string,
  ): Promise<any> {
    try {
      // Resolve worker id from user id via the workers_users junction
      const workerUserLink = await this.dataSource.getRepository('WorkerUser').findOne({
        where: { user: { id: workerUserId } },
        relations: ['worker', 'user'],
      }) as any;

      if (!workerUserLink || !workerUserLink.worker) {
        return {
          message: 'Worker not found for this user',
          data: [],
          isSuccess: false,
          statusCode: 404,
          developerError: 'No worker association found for user ID ' + workerUserId,
        };
      }

      const workerId = workerUserLink.worker.id;

      const query = this.workSessionRepo.createQueryBuilder('workSession')
        .leftJoinAndSelect('workSession.job', 'job')
        .leftJoinAndSelect('job.client', 'client')
        .leftJoinAndSelect('job.employer', 'employer')
        .leftJoinAndSelect('job.seasonalSchedules', 'ss')
        .leftJoinAndSelect('ss.shifts', 'shifts')
        .leftJoinAndSelect('workSession.worker', 'worker')
        .leftJoinAndSelect('worker.user', 'workerUser')
        .leftJoinAndSelect('workSession.workCenter', 'workCenter')
        .where('worker.id = :workerId', { workerId });

      if (jobId) {
        query.andWhere('job.id = :jobId', { jobId });
      }
      if (startDate) {
        query.andWhere('workSession.checkInTime >= :startDate', { startDate });
      }
      if (endDate) {
        const endDatePlusOne = new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1));
        query.andWhere('workSession.checkInTime < :endDate', { endDate: endDatePlusOne });
      }

      query.orderBy('workSession.checkInTime', 'DESC');

      const workSessions = await query.getMany();

      const formattedRecords = workSessions.map(session => {
        const checkInDate = new Date(session.checkInTime);
        const checkOutDate = session.checkOutTime ? new Date(session.checkOutTime) : null;

        const fecha = checkOutDate
          ? `${this.madridDate(checkInDate)} - ${this.madridDate(checkOutDate)}`
          : `${this.madridDate(checkInDate)} - En progreso`;

        const entrada = this.madridTime(checkInDate);
        const salida = checkOutDate
          ? this.madridTime(checkOutDate)
          : session.isActive ? 'En progreso' : '-';

        const totalHours = Math.floor(session.totalWorkMinutes / 60);
        const totalMinutes = session.totalWorkMinutes % 60;
        const total = `${totalHours}h ${totalMinutes}m`;

        const alerts: string[] = [];
        if (session.isActive && !session.checkOutTime) alerts.push('Sesión activa');
        if (session.totalBreakMinutes > 60) alerts.push('Descanso largo');

        // Punctuality: compare the actual check-in against the scheduled shift
        // start for that day (both in Madrid wall-clock). Thresholds: 15 min
        // early = "anticipado", up to 5 min late = "a tiempo", beyond = "tarde".
        let punctuality: 'early' | 'onTime' | 'late' | null = null;
        let lateMinutes: number | null = null;
        let shiftStart: string | null = null;
        if (session.job) {
          const dayDate = new Date(`${this.madridDateKey(session.checkInTime)}T12:00:00`);
          const shifts = this.jobScheduleService.getShiftsForDate(session.job, dayDate);
          const starts = shifts.map((s) => s.baseStartTime).filter(Boolean).sort();
          shiftStart = starts[0] ? starts[0].slice(0, 5) : null;
          if (shiftStart) {
            const [sh, sm] = shiftStart.split(':').map(Number);
            const diff = this.madridMinutes(session.checkInTime) - (sh * 60 + sm);
            if (diff > 5) {
              punctuality = 'late';
              lateMinutes = diff;
            } else if (diff <= -15) {
              punctuality = 'early';
            } else {
              punctuality = 'onTime';
            }
          }
        }

        const _schedMin = session.job ? (this.jobScheduleService.getScheduledMinutesForDate(session.job, new Date(`${this.madridDateKey(session.checkInTime)}T12:00:00`)) || 0) : 0;
        const extra = this.overtimeLabel(session, _schedMin);
        const puntualidad = punctuality === 'late' ? `+${lateMinutes}m tarde` : punctuality === 'early' ? 'Adelantado' : punctuality === 'onTime' ? 'A tiempo' : '—';
        const centro = (session as any).workCenter?.name || '—';
        const metodo = session.checkInMethod || '—';

        return {
          id: session.publicId || session.id.toString(),
          workSessionId: session.id,
          workSessionPublicId: session.publicId,
          jobId: session.job?.id,
          jobPublicId: session.job?.publicId,
          fecha,
          titular: session.job?.employer?.name || 'N/A',
          job: session.job?.jobName || 'N/A',
          client: session.job?.client?.name || 'N/A',
          centro,
          entrada,
          salida,
          total,
          extra,
          metodo,
          puntualidad,
          totalWorkMinutes: session.totalWorkMinutes,
          totalBreakMinutes: session.totalBreakMinutes,
          alerts: alerts.length > 0 ? alerts.join(', ') : 'None',
          punctuality,
          lateMinutes,
          shiftStart,
          isActive: session.isActive,
          isOnBreak: session.isOnBreak,
          source: session.source,
          checkInTime: session.checkInTime,
          checkOutTime: session.checkOutTime,
        };
      });

      return {
        message: 'Success',
        data: formattedRecords,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Failed to fetch work session records',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

  // Get detailed work session with scans and tasks grouped by date
  async getWorkSessionDetail(employerUserId: number, workSessionId: number): Promise<any> {
    try {
      // First verify employer access
      const employerUserEntry = await this.dataSource.getRepository('EmployerUser').findOne({
        where: { user: { id: employerUserId } },
        relations: ['employer', 'user'],
      });

      if (!employerUserEntry) {
        return {
          message: 'Employer not found for this user',
          data: null,
          isSuccess: false,
          statusCode: 404,
          developerError: 'No employer associated with this user',
        };
      }

      const employerId = employerUserEntry.employer.id;

      // Get work session with all relations
      const workSession = await this.dataSource.getRepository(WorkSession).findOne({
        where: { id: workSessionId },
        relations: [
          'job',
          'job.employer',
          'job.client',
          'job.workCenters',
          'worker',
          'worker.user',
        ],
      });

      if (!workSession) {
        return {
          message: 'Work session not found',
          data: null,
          isSuccess: false,
          statusCode: 404,
          developerError: 'Work session does not exist',
        };
      }

      // Verify the work session belongs to this employer
      if (workSession.job.employer.id !== employerId) {
        return {
          message: 'Access denied',
          data: null,
          isSuccess: false,
          statusCode: 403,
          developerError: 'Work session does not belong to this employer',
        };
      }

      // Get all scan logs for this work session (filter by jobId, workerId, and time range)
      const scanLogs = await this.dataSource.getRepository(ScanLog).find({
        where: {
          jobId: workSession.jobId,
          workerId: workSession.workerId,
        },
        order: { scanTime: 'ASC' },
      });

      // Filter scans to those around the work session timeframe (with 5 second buffer before check-in)
      const filteredScans = scanLogs.filter(scan => {
        const scanTime = new Date(scan.scanTime);
        const checkInTime = new Date(workSession.checkInTime);
        const checkOutTime = workSession.checkOutTime ? new Date(workSession.checkOutTime) : new Date();
        // Allow scans up to 5 seconds before check-in to account for timing differences
        const bufferTime = new Date(checkInTime.getTime() - 5000); 
        return scanTime >= bufferTime && scanTime <= checkOutTime;
      });

      // Get task history for this job and date range (for multi-day jobs)
      const checkInDate = this.madridDateKey(workSession.checkInTime);
      const checkOutDate = workSession.checkOutTime
        ? this.madridDateKey(workSession.checkOutTime)
        : this.madridDateKey(new Date());
      
      const taskHistory = await this.dataSource.query(
        `SELECT th.*, t.name as task_name, t."workCenterId" as work_center_id, wc.name as work_center_name
         FROM task_history th 
         LEFT JOIN task t ON th."taskId" = t.id 
         LEFT JOIN work_center wc ON t."workCenterId" = wc.id
         WHERE th."jobId" = $1 AND th.date >= $2 AND th.date <= $3`,
        [workSession.job.id, checkInDate, checkOutDate]
      );

      const filteredTaskCompletions = taskHistory.filter(th => th.isCompleted && (th.completedAt || th.completedat || th.completed_at));

      // Group scans by date
      const scansByDate = {};
      filteredScans.forEach(scan => {
        const dateKey = this.madridDateKey(scan.scanTime);

        if (!scansByDate[dateKey]) {
          scansByDate[dateKey] = [];
        }
        
        scansByDate[dateKey].push({
          id: scan.id,
          scanType: scan.scanType,
          scanTime: scan.scanTime,
          location: scan.location,
          notes: scan.notes,
        });
      });

      // Group tasks by date
      const tasksByDate = {};
      filteredTaskCompletions.forEach(tc => {
        // Convert date to YYYY-MM-DD format (tc.date may be Date or string)
        const dateKey = tc.date ? this.madridDateKey(tc.date) : 'unknown';

        if (!tasksByDate[dateKey]) {
          tasksByDate[dateKey] = [];
        }

        // Pick the completedAt value from possible column names and normalize to ISO string
        const rawCompletedAt = tc.completedAt || tc.completedat || tc.completed_at || null;
        const completedAtIso = rawCompletedAt ? (new Date(rawCompletedAt)).toISOString() : null;

        tasksByDate[dateKey].push({
          id: tc.id,
          taskName: tc.task_name || 'Unknown Task',
          completed: true,
          completedAt: completedAtIso,
          workCenter: {
            id: tc.work_center_id,
            name: tc.work_center_name || 'N/A',
          },
        });
      });

      // Calculate estimated time from work session duration (check-in to check-out)
      let estimatedMinutes = 0;
      if (workSession.checkInTime && workSession.checkOutTime) {
        const checkIn = new Date(workSession.checkInTime);
        const checkOut = new Date(workSession.checkOutTime);
        estimatedMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60));
      }

      // Calculate difference
      const difference = workSession.totalWorkMinutes - estimatedMinutes;

      // Format response
      const response = {
        workSessionId: workSession.id,
        checkInTime: workSession.checkInTime,
        checkOutTime: workSession.checkOutTime,
        isActive: workSession.isActive,
        client: {
          id: workSession.job.client?.id,
          name: workSession.job.client?.name || 'Unknown Client',
        },
        workCenter: {
          id: workSession.job.workCenters?.[0]?.id,
          name: workSession.job.workCenters?.[0]?.name || 'Unknown Work Center',
        },
        job: {
          id: workSession.job.id,
          name: workSession.job.jobName,
        },
        worker: {
          id: workSession.worker.id,
          code: workSession.worker.code,
          name: workSession.worker.user?.firstName || 'Unknown',
          lastName: workSession.worker.user?.lastName || '',
        },
        estimatedMinutes: estimatedMinutes,
        totalWorkMinutes: workSession.totalWorkMinutes || 0,
        totalBreakMinutes: workSession.totalBreakMinutes || 0,
        difference: difference,
        scansByDate: scansByDate,
        tasksByDate: tasksByDate,
      };

      return {
        message: 'Work session details fetched successfully',
        data: response,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Failed to fetch work session details',
        data: null,
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

}
