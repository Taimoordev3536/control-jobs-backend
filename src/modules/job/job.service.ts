
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
// Mock WorkCenter data (used for every client)
const MOCK_WORK_CENTER = { id: 1, name: 'WorkCenter 1' };
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import { Job } from './entities/job.entity';
import { Shift, Weekday, ScheduleType } from './entities/shift.entity';
import { SigningMethod, SigningMethodType, SigningMethodDetail } from './entities/signing-method.entity';
import { Alert } from './entities/alert.entity';
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
import { ClientUser } from '../clients/entities/client-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Survey } from '../survey/entities/survey.entity';
import { SurveyResponse } from '../survey/entities/survey-response.entity';
import { JobTasksTabItemDto } from './dto/job-tasks-tab.dto';
import { User } from '../users/entities/user.entity';
import { RecordScanDto, GenerateQrCodeDto } from './dto/scan.dto';
import { v4 as uuidv4 } from 'uuid';
import { QrCode, QrCodeType, QrCodeOwnerType } from './entities/qr-code.entity';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './enums/job-status.enum';
import * as QRCode from 'qrcode';
import { AlertsService } from '../realtime/alerts.service';

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
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
  @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(QrCode) private qrCodeRepo: Repository<QrCode>,
    private dataSource: DataSource,
    private alertsService: AlertsService,
  ) {}


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
        const cid = Number(createJobDto.clientId);
        if (isNaN(cid)) {
          throw new Error(`Invalid clientId ${createJobDto.clientId}`);
        }

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
        // Load provided work centers and ensure they exist
        const wcs = await manager.findBy(WorkCenter, { id: In(createJobDto.workCenterIds as number[]) });
        if (!wcs || wcs.length !== createJobDto.workCenterIds.length) {
          // find which ids are missing
          const foundIds = new Set((wcs || []).map((w) => w.id));
          const missing = (createJobDto.workCenterIds as number[]).filter((id) => !foundIds.has(id));
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

      // Load workers referenced in DTO
      const workers = (createJobDto.workerIds && createJobDto.workerIds.length)
        ? await manager.findBy(Worker, { id: In(createJobDto.workerIds as number[]) })
        : [];

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
              // accumulate only numeric totalHours
              if (typeof w.totalHours === 'number' && !Number.isNaN(w.totalHours)) {
                totalWeekHours += Math.floor(w.totalHours);
              }
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
        clientId: job.client?.id || null,
        workCenterIds: job.workCenters?.map(wc => wc.id) || [],
        workerIds: job.workers?.map(w => w.id) || [],
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
        tasks: job.tasks?.map(task => ({
          id: task.id,
          name: task.name,
          note: task.note || '',
          expectedDuration: task.expectedDuration || 0,
          shift: task.shift || null,
          timing: task.timing,
          periodicity: task.periodicity,
          workCenterId: task.workCenterId !== undefined && task.workCenterId !== null ? task.workCenterId : null,
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
        })) || [],

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
          const cid = Number(updateJobDto.clientId);
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
          const wcs = await manager.findBy(WorkCenter, { id: In(updateJobDto.workCenterIds as number[]) });
          if (wcs.length !== updateJobDto.workCenterIds.length) {
            const foundIds = new Set(wcs.map(w => w.id));
            const missing = (updateJobDto.workCenterIds as number[]).filter(id => !foundIds.has(id));
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
          const workers = await manager.findBy(Worker, { id: In(updateJobDto.workerIds as number[]) });
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
              if (typeof w.totalHours === 'number' && !Number.isNaN(w.totalHours)) {
                totalWeekHours += Math.floor(w.totalHours);
              }
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

    // Helper: weekday order
    const weekdayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Group shifts by season and include startDate/endDate
    const output: any = {};
    if (job.seasonalSchedules && job.seasonalSchedules.length) {
      for (const ss of job.seasonalSchedules) {
        if (ss.shifts && ss.shifts.length) {
          const shifts = ss.shifts.map(shift => {
            const startIdx = weekdayOrder.indexOf(String(shift.startWeekday).toLowerCase());
            const endIdx = weekdayOrder.indexOf(String(shift.endWeekday).toLowerCase());
            if (startIdx === -1 || endIdx === -1) return null;

            let days = [];
            if (startIdx === endIdx) {
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
              for (let i = startIdx + 1; i < endIdx; i++) {
                days.push({
                  day: weekdayOrder[i % 7],
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
    console.log('getTasksTabDataForUser -> normalized count:', normalized.length);
    if (normalized.length > 0) {
      const sample = normalized.slice(0, 5).map(x => ({ id: x.id, client: x.client?.name || null, employer: x.employer?.name || null, clientName: x.clientName || null }));
      console.log('getTasksTabDataForUser sample:', JSON.stringify(sample));
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
      order: { id: 'ASC' },
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
      if (wu.worker?.id && wu.user?.name) {
        workerIdToName.set(wu.worker.id, wu.user.name);
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
        if (job.scheduleType === ScheduleType.FIXED) {
          scheduleType = 'fixed';
        } else if (job.scheduleType === ScheduleType.FREE) {
          scheduleType = 'free';
        } else if (job.scheduleType === ScheduleType.SEASONAL) {
          // Seasonal logic
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const todayKey = `${dd}-${mm}`; // matches stored format DD-MM

          const parseDayMonthValue = (dm: string): number => {
            const [dStr, mStr] = dm.split('-');
            const d = Number(dStr); const m = Number(mStr);
            // value used for simple in-year comparison m*100 + d
            return m * 100 + d;
          };

          // Separate schedules
            const summerSchedules = (job.seasonalSchedules || []).filter(ss => !!ss.startDate && !!ss.endDate);
            const normalSchedules = (job.seasonalSchedules || []).filter(ss => !ss.startDate && !ss.endDate);

          // Find active summer schedule
          let activeSummer: any = null;
          const todayVal = parseDayMonthValue(todayKey);
          for (const ss of summerSchedules) {
            try {
              const startVal = parseDayMonthValue(ss.startDate);
              const endVal = parseDayMonthValue(ss.endDate);
              // basic non wrap-around comparison (assumes start <= end inside same year)
              if (startVal <= todayVal && todayVal <= endVal) {
                activeSummer = ss;
                break;
              }
            } catch { /* ignore parse errors */ }
          }

          if (activeSummer) {
            scheduleType = 'summer';
            // prefer precomputed totalWeekHours, fallback compute from shifts
            activeScheduleWeekHours = typeof activeSummer.totalWeekHours === 'number'
              ? activeSummer.totalWeekHours
              : (activeSummer.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
          } else if (normalSchedules.length) {
            // Normal applies when no summer active
            const normal = normalSchedules[0];
            scheduleType = 'normal';
            activeScheduleWeekHours = typeof normal.totalWeekHours === 'number'
              ? normal.totalWeekHours
              : (normal.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
          } else {
            // Fallback to generic seasonal when no identifiable schedule rows
            scheduleType = 'seasonal';
            // sum all shifts as fallback
            activeScheduleWeekHours = (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
              const shifts = ss.shifts || [];
              const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
              return outerAcc + ssTotal;
            }, 0);
          }
        }
      } catch (e) {
        scheduleType = 'free';
        activeScheduleWeekHours = null;
      }

      return {
        jobId: job.id,
        jobName: job.jobName,
        jobStatus: job.status || JobStatus.SCHEDULED,
        clientName: job.client?.name || '',
        workCenters: job.workCenters?.map(w => ({ id: w.id, name: w.name })) || [],
        workCenterNames: job.workCenters?.map(w => w.name).join(', ') || '',
        startDate: job.startDate,
        endDate: job.endDate,
        scheduleType, // now can be free | fixed | summer | normal | seasonal(fallback)
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
        tasks: job.tasks?.map(task => ({ id: task.id, name: task.name, expectedDuration: task.expectedDuration })) || [],
        signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
        hasClientSurvey,
        hasWorkerSurvey,
        workers: job.workers.map(worker => ({
          id: worker.id,
          code: worker.code,
          name: workerIdToName.get(worker.id) || null,
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
      order: { id: 'ASC' },
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

    console.log(`📊 Found ${workSessions.length} active work sessions for worker ${workerId}`);
    
    // Create a map of jobId -> workSession for quick lookup
    const jobIdToSession = new Map<number, any>();
    workSessions.forEach(session => {
      if (session.job?.id) {
        console.log(`✅ Mapping work session to job ${session.job.id}`);
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
      if (wu.worker?.id && wu.user?.name) {
        workerIdToName.set(wu.worker.id, wu.user.name);
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
        if (job.scheduleType === ScheduleType.FIXED) {
          scheduleType = 'fixed';
        } else if (job.scheduleType === ScheduleType.FREE) {
          scheduleType = 'free';
        } else if (job.scheduleType === ScheduleType.SEASONAL) {
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, '0');
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const todayKey = `${dd}-${mm}`;

          const parseDayMonthValue = (dm: string): number => {
            const [dStr, mStr] = dm.split('-');
            const d = Number(dStr); const m = Number(mStr);
            return m * 100 + d;
          };

          const summerSchedules = (job.seasonalSchedules || []).filter(ss => !!ss.startDate && !!ss.endDate);
          const normalSchedules = (job.seasonalSchedules || []).filter(ss => !ss.startDate && !ss.endDate);

          let activeSummer: any = null;
          const todayVal = parseDayMonthValue(todayKey);
          for (const ss of summerSchedules) {
            try {
              const startVal = parseDayMonthValue(ss.startDate);
              const endVal = parseDayMonthValue(ss.endDate);
              if (startVal <= todayVal && todayVal <= endVal) {
                activeSummer = ss;
                break;
              }
            } catch { /* ignore parse errors */ }
          }

          if (activeSummer) {
            scheduleType = 'summer';
            activeScheduleWeekHours = typeof activeSummer.totalWeekHours === 'number'
              ? activeSummer.totalWeekHours
              : (activeSummer.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
          } else if (normalSchedules.length) {
            const normal = normalSchedules[0];
            scheduleType = 'normal';
            activeScheduleWeekHours = typeof normal.totalWeekHours === 'number'
              ? normal.totalWeekHours
              : (normal.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
          } else {
            scheduleType = 'seasonal';
            activeScheduleWeekHours = (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
              const shifts = ss.shifts || [];
              const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
              return outerAcc + ssTotal;
            }, 0);
          }
        }
      } catch (e) {
        scheduleType = 'free';
        activeScheduleWeekHours = null;
      }

      return {
        jobId: job.id,
        jobName: job.jobName,
        jobStatus: job.status || JobStatus.SCHEDULED,
        clientName: job.client?.name || '',
        workCenters: job.workCenters?.map(w => ({ id: w.id, name: w.name })) || [],
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
        tasks: job.tasks?.map(task => ({ id: task.id, name: task.name, expectedDuration: task.expectedDuration })) || [],
        signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
        hasClientSurvey,
        hasWorkerSurvey,
        workers: job.workers.map(worker => ({ id: worker.id, code: worker.code, name: workerIdToName.get(worker.id) || null })),
        // Include active work session if exists
        workSession: jobIdToSession.has(job.id) ? (() => {
          const session = jobIdToSession.get(job.id);
          console.log(`✅ Including workSession for job ${job.id}:`, {
            checkInTime: session.checkInTime,
            isActive: session.isActive
          });
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

      const clientId = clientUser.client.id;

      // Keep relations consistent with employer endpoint and include signingMethods
      const jobs = await this.jobRepo.find({
        where: { client: { id: clientId } },
        relations: ['client', 'workCenters', 'tasks', 'tasks.workCenter', 'workers', 'seasonalSchedules', 'seasonalSchedules.shifts', 'signingMethods'],
        order: { id: 'ASC' },
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
        if (wu.worker?.id && wu.user?.name) {
          workerIdToName.set(wu.worker.id, wu.user.name);
        }
      }

      // NOTE: Unlike the employer version we DO NOT fetch or expose survey flags here
      const formatted = jobs.map(job => {
        // Schedule type computation mirrors employer version
        let scheduleType: string = 'free';
        let activeScheduleWeekHours: number | null = null;
        try {
          if (job.scheduleType === ScheduleType.FIXED) {
            scheduleType = 'fixed';
          } else if (job.scheduleType === ScheduleType.FREE) {
            scheduleType = 'free';
          } else if (job.scheduleType === ScheduleType.SEASONAL) {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, '0');
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const todayKey = `${dd}-${mm}`;

            const parseDayMonthValue = (dm: string): number => {
              const [dStr, mStr] = dm.split('-');
              const d = Number(dStr); const m = Number(mStr);
              return m * 100 + d;
            };

            const summerSchedules = (job.seasonalSchedules || []).filter(ss => !!ss.startDate && !!ss.endDate);
            const normalSchedules = (job.seasonalSchedules || []).filter(ss => !ss.startDate && !ss.endDate);

            let activeSummer: any = null;
            const todayVal = parseDayMonthValue(todayKey);
            for (const ss of summerSchedules) {
              try {
                const startVal = parseDayMonthValue(ss.startDate);
                const endVal = parseDayMonthValue(ss.endDate);
                if (startVal <= todayVal && todayVal <= endVal) {
                  activeSummer = ss;
                  break;
                }
              } catch { /* ignore parse errors */ }
            }

            if (activeSummer) {
              scheduleType = 'summer';
              activeScheduleWeekHours = typeof activeSummer.totalWeekHours === 'number'
                ? activeSummer.totalWeekHours
                : (activeSummer.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
            } else if (normalSchedules.length) {
              const normal = normalSchedules[0];
              scheduleType = 'normal';
              activeScheduleWeekHours = typeof normal.totalWeekHours === 'number'
                ? normal.totalWeekHours
                : (normal.shifts || []).reduce((acc: number, sh: any) => acc + (Number(sh.totalHours) || 0), 0);
            } else {
              scheduleType = 'seasonal';
              activeScheduleWeekHours = (job.seasonalSchedules || []).reduce((outerAcc: number, ss: any) => {
                const shifts = ss.shifts || [];
                const ssTotal = shifts.reduce((sAcc: number, sh: any) => sAcc + (Number(sh.totalHours) || 0), 0);
                return outerAcc + ssTotal;
              }, 0);
            }
          }
        } catch (e) {
          scheduleType = 'free';
          activeScheduleWeekHours = null;
        }

        return {
          jobId: job.id,
          jobName: job.jobName,
          jobStatus: job.status || JobStatus.SCHEDULED,
          clientName: job.client?.name || '',
          workCenters: job.workCenters?.map(w => ({ id: w.id, name: w.name })) || [],
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
          tasks: job.tasks?.map(task => ({ id: task.id, name: task.name, expectedDuration: task.expectedDuration })) || [],
          signingMethods: job.signingMethods?.map(sm => ({ methodType: sm.methodType, methodDetails: sm.methodDetails, verifyIdentity: sm.verifyIdentity })) || [],
          workers: job.workers.map(worker => ({ id: worker.id, code: worker.code, name: workerIdToName.get(worker.id) || null })),
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
  async generateJobQrCode(generateQrCodeDto: GenerateQrCodeDto, userId: number): Promise<{ qrImage: string; token: string; type: QrCodeType; expiresAt: Date | null; lastRefreshedAt: Date | null }> {
    const { type } = generateQrCodeDto;
    const qrType: QrCodeType = type || QrCodeType.STATIC;

    // Determine ownerId and ownerType from userId
    let ownerId: string;
    let ownerType: QrCodeOwnerType;

    // Check if user is an employer
    const employerUser = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (employerUser) {
      ownerId = String(employerUser.employer.id);
      ownerType = QrCodeOwnerType.EMPLOYER;
    } else {
      // Check if user is a client
      const clientUser = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
      if (clientUser) {
        ownerId = String(clientUser.client.id);
        ownerType = QrCodeOwnerType.CLIENT;
      } else {
        throw new Error('User is not associated with an employer or client');
      }
    }

    // Find or create QR code
    let qrCode = await this.qrCodeRepo.findOne({ where: { ownerType, ownerId: String(ownerId), type: qrType, isActive: true } });
    if (!qrCode) {
      // Generate token
      const token = this.generateQrToken(qrType);
      const now = new Date();
      let expiresAt: Date | null = null;
      let lastRefreshedAt: Date | null = null;
      if (qrType === QrCodeType.DYNAMIC) {
        expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 min expiry
        lastRefreshedAt = now;
      }
      qrCode = this.qrCodeRepo.create({
        token,
        type: qrType,
        ownerType,
        ownerId: String(ownerId),
        expiresAt,
        lastRefreshedAt,
        isActive: true,
      });
      await this.qrCodeRepo.save(qrCode);
    }

    // If DYNAMIC and expired, refresh
    if (qrType === QrCodeType.DYNAMIC && qrCode.expiresAt && qrCode.expiresAt < new Date()) {
      qrCode.token = this.generateQrToken(qrType);
      qrCode.lastRefreshedAt = new Date();
      qrCode.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      await this.qrCodeRepo.save(qrCode);
    }

    // Generate QR image (base64) - only token
    const qrString = qrCode.token;
    const qrImage = await QRCode.toDataURL(qrString);

    return {
      qrImage,
      token: qrCode.token,
      type: qrCode.type,
      expiresAt: qrCode.expiresAt,
      lastRefreshedAt: qrCode.lastRefreshedAt,
    };
  }

  /**
   * Generate a secure QR token (44 chars, base64url for DYNAMIC, UUIDv4 for STATIC)
   */
  private generateQrToken(type: QrCodeType): string {
    if (type === QrCodeType.STATIC) {
      // UUIDv4
      return uuidv4();
    } else {
      // 256-bit random, base64url
      const bytes = require('crypto').randomBytes(32);
      return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
  }

  /**
   * Validate QR token against employer or client QR codes (static or dynamic)
   */
  private async validateQRToken(scannedToken: string, employerId?: number, clientId?: number): Promise<boolean> {
    if (!scannedToken) return false;

    // Check employer's QR codes (both static and dynamic)
    if (employerId) {
      const employerQR = await this.qrCodeRepo.findOne({
        where: [
          { ownerId: String(employerId), ownerType: QrCodeOwnerType.EMPLOYER, token: scannedToken, isActive: true, type: QrCodeType.STATIC },
          { ownerId: String(employerId), ownerType: QrCodeOwnerType.EMPLOYER, token: scannedToken, isActive: true, type: QrCodeType.DYNAMIC }
        ]
      });

      if (employerQR) {
        // If dynamic, check expiry
        if (employerQR.type === QrCodeType.DYNAMIC) {
          if (employerQR.expiresAt && employerQR.expiresAt > new Date()) {
            return true;
          }
          return false; // Expired
        }
        return true; // Static QR, always valid
      }
    }

    // Check client's QR codes (both static and dynamic)
    if (clientId) {
      const clientQR = await this.qrCodeRepo.findOne({
        where: [
          { ownerId: String(clientId), ownerType: QrCodeOwnerType.CLIENT, token: scannedToken, isActive: true, type: QrCodeType.STATIC },
          { ownerId: String(clientId), ownerType: QrCodeOwnerType.CLIENT, token: scannedToken, isActive: true, type: QrCodeType.DYNAMIC }
        ]
      });

      if (clientQR) {
        // If dynamic, check expiry
        if (clientQR.type === QrCodeType.DYNAMIC) {
          if (clientQR.expiresAt && clientQR.expiresAt > new Date()) {
            return true;
          }
          return false; // Expired
        }
        return true; // Static QR, always valid
      }
    }

    return false; // Token not found or invalid
  }

  /**
   * Record a scan event and manage work sessions
   */
  async recordScan(recordScanDto: RecordScanDto, userId: number): Promise<{ status: string; scanData: ScanLog; workSession?: any }> {
    try {
      console.log('=== DEBUG: Starting recordScan ===');
      console.log('User ID:', userId);
      console.log('Record Scan DTO:', recordScanDto);

      // Try to find if user is a worker first
      let workerId: number | null = null;
      const workerUser = await this.workerUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['worker'],
      });

      if (workerUser?.worker?.id) {
        workerId = workerUser.worker.id;
        console.log('Found as Worker with ID:', workerId);
      } else {
        // Check if user is an employer (for testing purposes)
        const employerUser = await this.employerUserRepo.findOne({
          where: { user: { id: userId } },
          relations: ['employer'],
        });

        if (employerUser?.employer?.id) {
          console.log('User is an Employer - allowing scan for testing');
          // For testing, let's use the first worker assigned to this job
          const job = await this.jobRepo.findOne({
            where: { id: recordScanDto.jobId },
            relations: ['workers'],
          });

          if (!job) {
            throw new Error('Job not found');
          }

          if (job.workers.length === 0) {
            throw new Error('No workers assigned to this job');
          }

          workerId = job.workers[0].id; // Use first worker for testing
          console.log('Using first assigned worker ID for testing:', workerId);
        } else {
          throw new Error('User is neither a worker nor an employer');
        }
      }

      if (!workerId) {
        throw new Error('Worker not found for this user');
      }

      // Verify job exists
      const job = await this.jobRepo.findOne({
        where: { id: recordScanDto.jobId },
        relations: ['workers','employer','client'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Check if worker is assigned to this job
      const isWorkerAssigned = job.workers.some(w => w.id === workerId);
      if (!isWorkerAssigned) {
        throw new Error('Worker is not assigned to this job');
      }

      // Get user's timezone from request data (frontend should send this)
      // If not available, default to UTC
      const userTimezone = recordScanDto.userTimezone || 
        Intl.DateTimeFormat().resolvedOptions().timeZone || 
        'UTC';
      
      // Validate signing method if provided
      if (recordScanDto.signingMethod === 'qrcode' && recordScanDto.qrToken) {
        // Validate QR token against employer or client QR codes
        const isValidQR = await this.validateQRToken(
          recordScanDto.qrToken,
          job.employer?.id,
          job.client?.id
        );
        
        if (!isValidQR) {
          throw new Error('Invalid or expired QR code');
        }
      }

      // Create scan log entry
      const scanLog = this.scanLogRepo.create({
        jobId: recordScanDto.jobId,
        workerId: workerId,
        scanType: recordScanDto.scanType,
        location: recordScanDto.location,
        notes: recordScanDto.notes,
        userTimezone: userTimezone,
        signingMethod: recordScanDto.signingMethod,
        ipAddress: recordScanDto.ipAddress,
        latitude: recordScanDto.latitude,
        longitude: recordScanDto.longitude,
        qrToken: recordScanDto.qrToken,
        // scanTime will be automatically set by @CreateDateColumn in UTC
      });

      const savedScanLog = await this.scanLogRepo.save(scanLog);

      // Handle work session tracking based on scan type
      let workSession = null;
      
      switch (recordScanDto.scanType) {
        case 'check-in':
          workSession = await this.handleCheckIn(recordScanDto.jobId, workerId, recordScanDto.signingMethod);
          // Emit alert to linked employer and client
          if (job?.employer?.id && job?.client?.id) {
            // Find employer userId and client userId via link tables
            const employerUser = await this.employerUserRepo.findOne({ where: { employer: { id: job.employer.id } }, relations: ['user'] });
            const clientUser = await this.clientUserRepo.findOne({ where: { client: { id: job.client.id } }, relations: ['user'] });
            if (employerUser?.user?.id && clientUser?.user?.id) {
              await this.alertsService.createAndEmitAlert({
                type: 'CHECK_IN',
                jobId: job.id,
                workerId,
                employerUserId: employerUser.user.id,
                clientUserId: clientUser.user.id,
                message: `Worker checked in to ${job.jobName}`,
                meta: { jobName: job.jobName },
              });
            }
          }
          break;
        case 'break-start':
          workSession = await this.handleBreakStart(recordScanDto.jobId, workerId);
          break;
        case 'break-end':
          workSession = await this.handleBreakEnd(recordScanDto.jobId, workerId);
          break;
        case 'check-out':
          workSession = await this.handleCheckOut(recordScanDto.jobId, workerId, recordScanDto.signingMethod);
          if (job?.employer?.id && job?.client?.id) {
            const employerUser = await this.employerUserRepo.findOne({ where: { employer: { id: job.employer.id } }, relations: ['user'] });
            const clientUser = await this.clientUserRepo.findOne({ where: { client: { id: job.client.id } }, relations: ['user'] });
            if (employerUser?.user?.id && clientUser?.user?.id) {
              await this.alertsService.createAndEmitAlert({
                type: 'CHECK_OUT',
                jobId: job.id,
                workerId,
                employerUserId: employerUser.user.id,
                clientUserId: clientUser.user.id,
                message: `Worker checked out from ${job.jobName}`,
                meta: { jobName: job.jobName },
              });
            }
          }
          break;
      }

      return {
        status: 'Scan recorded successfully',
        scanData: savedScanLog,
        workSession,
      };
    } catch (error) {
      throw new Error(`Failed to record scan: ${error.message}`);
    }
  }

  /**
   * Handle check-in logic
   */
  private async handleCheckIn(jobId: number, workerId: number, signingMethod?: string) {
    // Check if there's already an active work session
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (activeSession) {
      throw new Error('Worker already has an active session for this job');
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
      isActive: true,
      isOnBreak: false,
      totalWorkMinutes: 0,
      totalBreakMinutes: 0,
    });

    const savedWorkSession = await this.workSessionRepo.save(workSession);
    console.log(`✅ Created active work session ${savedWorkSession.id} for job ${jobId}, worker ${workerId}`);

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
      throw new Error('No active session found for this worker and job');
    }

    if (activeSession.isOnBreak) {
      throw new Error('Worker is already on break');
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
      throw new Error('No active session found for this worker and job');
    }

    if (!activeSession.isOnBreak || !activeSession.currentBreakStart) {
      throw new Error('Worker is not currently on break');
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
  private async handleCheckOut(jobId: number, workerId: number, signingMethod?: string) {
    const activeSession = await this.workSessionRepo.findOne({
      where: {
        job: { id: jobId },
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
    });

    if (!activeSession) {
      throw new Error('No active session found for this worker and job');
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
    console.log(`✅ Closed work session ${activeSession.id} for job ${jobId}, worker ${workerId}`);

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
        console.log(`⚠️ Job ${jobId}: Worker checked out but ${job.tasks.filter(t => !t.isCompleted).length} tasks remain incomplete`);
        // Note: We're not auto-completing tasks here to maintain data integrity
        // Tasks should be explicitly marked as complete by workers
      }
      
      // Update job status to COMPLETED if:
      // 1. All tasks are completed AND all workers have checked out, OR
      // 2. All workers have checked out (regardless of task completion - business decision)
      if (allWorkersCheckedOut) {
        job.status = JobStatus.COMPLETED;
        await this.jobRepo.save(job);
        console.log(`✅ Job ${jobId} marked as COMPLETED - all workers checked out`);
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

    // Query work sessions for the same job and date range
    const sessionQuery = this.workSessionRepo.createQueryBuilder('workSession')
      .leftJoinAndSelect('workSession.worker', 'worker')
      .leftJoinAndSelect('worker.user', 'user')
      .where('workSession.jobId = :jobId', { jobId });

    if (startDate) {
      sessionQuery.andWhere('workSession.checkInTime >= :startDate', { startDate });
    }
    if (endDate) {
      sessionQuery.andWhere('workSession.checkInTime < :endDate', { endDate: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1)) });
    }

    const workSessions = await sessionQuery.getMany();
    
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
    console.log('Task histories found:', taskHistories);

    // Group scan logs by date
    const groupedByDate = scanLogs.reduce((acc, log) => {
      const date = log.scanTime.toISOString().split('T')[0]; // Extract YYYY-MM-DD
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
          name: log.worker.user?.name || null,
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

    // Group work sessions by date
    const sessionsByDate = workSessions.reduce((acc, session) => {
      const date = session.checkInTime.toISOString().split('T')[0]; // Extract YYYY-MM-DD
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        id: session.id,
        worker: {
          id: session.worker.id,
          code: session.worker.code,
          name: session.worker.user?.name || null,
        },
        checkInTime: session.checkInTime,
        checkOutTime: session.checkOutTime,
        totalWorkMinutes: session.totalWorkMinutes,
        totalBreakMinutes: session.totalBreakMinutes,
        isOnBreak: session.isOnBreak,
      });
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
    const result = Array.from(allDates).map(date => ({
      date,
      scans: groupedByDate[date] || [],
      breaks: breaksByDate[date] || [],
      sessions: sessionsByDate[date] || [],
      tasks: tasksByDate[date] || [], // Include tasks for each date
    }));
    
    console.log('Final result with tasks:', JSON.stringify(result, null, 2));

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
    const todayString = new Date().toISOString().split('T')[0];
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
        // Find if the worker exists (to provide better error messages)
        const worker = await this.workerRepo.findOne({ 
          where: { id: workerId },
          relations: ['user']
        });
        const workerName = worker?.user?.name || 'Unknown worker';
        
        // Return a specific error with all fields needed by frontend to handle this gracefully
        return {
          message: `Worker (ID: ${workerId}) is not assigned to this job`,
          data: {
            jobId,
            workerId,
            allowedWorkers: await Promise.all((job.workers || []).map(async (w) => {
              const workerWithUser = await this.workerRepo.findOne({
                where: { id: w.id },
                relations: ['user']
              });
              return { 
                id: w.id, 
                name: workerWithUser?.user?.name || `Worker ${w.id}`
              };
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

      const todayString = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

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
      const today = DateTime.now().startOf('day');
      const todayDate = today.toJSDate();
      const todayISODate = today.toISODate();

      // Fetch all tasks for the job with work center relation
      const tasks = await this.taskRepo.find({
        where: { job: { id: jobId } },
        relations: ['workCenter', 'taskHistories'],
        order: { workCenterId: 'ASC', id: 'ASC' },
      });

      // Filter tasks scheduled for today
      const todayTasks = tasks.filter(task => this.isTaskScheduledForToday(task, todayDate));

      // Get task completion status for today for this worker
      console.log('🔍 Querying TaskHistories for:', {
        taskIds: todayTasks.map(t => t.id),
        workerId,
        date: todayISODate,
      });

      const taskHistories = await this.taskHistoryRepo.find({
        where: {
          task: In(todayTasks.map(t => t.id)),
          completedByWorkerId: workerId,
          date: todayISODate as any,
        },
        relations: ['task'],
      });

      console.log('📊 Found TaskHistories:', taskHistories.length, taskHistories.map(th => ({
        taskId: th.task.id,
        isCompleted: th.isCompleted,
        date: th.date,
      })));

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
  private isTaskScheduledForToday(task: any, todayDate: Date): boolean {
    const today = DateTime.fromJSDate(todayDate);
    const todayDayOfWeek = today.weekday % 7; // Convert to 0=Sunday format
    const todayDayOfMonth = today.day;
    const todayMonth = today.month;

    // Check start/end date boundaries
    if (task.startDate) {
      const start = DateTime.fromJSDate(new Date(task.startDate));
      if (today < start.startOf('day')) return false;
    }
    if (task.endDate) {
      const end = DateTime.fromJSDate(new Date(task.endDate));
      if (today > end.startOf('day')) return false;
    }

    switch (task.periodicity) {
      case 'once':
        if (task.onceDate) {
          const onceDate = DateTime.fromJSDate(new Date(task.onceDate));
          return onceDate.hasSame(today, 'day');
        }
        return false;

      case 'daily':
        return true; // Daily tasks are always scheduled

      case 'weekly':
        if (task.weeklyDays && task.weeklyDays.length > 0) {
          return task.weeklyDays.includes(todayDayOfWeek);
        }
        return false;

      case 'monthly':
        // Check monthly days (1-31)
        if (task.monthlyDays && task.monthlyDays.length > 0) {
          if (task.monthlyDays.includes(todayDayOfMonth)) return true;
        }
        // Check monthly weekdays
        if (task.monthlyWeekdays && task.monthlyWeekdays.length > 0) {
          if (task.monthlyWeekdays.includes(todayDayOfWeek)) return true;
        }
        return false;

      case 'yearly':
        // Check if today matches any yearly configuration
        if (task.yearlyMonths && task.yearlyMonths.length > 0) {
          if (!task.yearlyMonths.includes(todayMonth)) return false;
        }
        if (task.yearlyDays && task.yearlyDays.length > 0) {
          return task.yearlyDays.includes(todayDayOfMonth);
        }
        return false;

      default:
        return false;
    }
  }

} 




