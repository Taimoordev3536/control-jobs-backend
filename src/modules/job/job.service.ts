import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Job } from './entities/job.entity';
import { Shift } from './entities/shift.entity';
import { SigningMethod } from './entities/signing-method.entity';
import { Alert } from './entities/alert.entity';
import { Task } from './entities/task.entity';
import { ScanLog } from './entities/scan-log.entity';
import { Worker } from '../workers/entities/worker.entity';
import { Client } from '../clients/entities/client.entity';
import { WorkCenter } from '../work-centers/entities/work-center.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { Survey } from '../survey/entities/survey.entity';
import { SurveyQuestion } from '../survey/entities/survey-question.entity';
import { JobTasksTabItemDto } from './dto/job-tasks-tab.dto';
import { User } from '../users/entities/user.entity';
import { RecordScanDto, GenerateQrCodeDto } from './dto/scan.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobStatus } from './enums/job-status.enum';
import * as QRCode from 'qrcode';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(SigningMethod) private signingMethodRepo: Repository<SigningMethod>,
    @InjectRepository(Alert) private alertRepo: Repository<Alert>,
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(ScanLog) private scanLogRepo: Repository<ScanLog>,
    @InjectRepository(Worker) private workerRepo: Repository<Worker>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(WorkCenter) private workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(Employer) private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(SurveyQuestion) private surveyQuestionRepo: Repository<SurveyQuestion>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    private dataSource: DataSource,
  ) {}

  //create job
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

      const client = await manager.findOneOrFail(Client, { where: { id: createJobDto.clientId } });
      const workCenter = await manager.findOneOrFail(WorkCenter, { where: { id: createJobDto.workCenterId } });
      const workers = await manager.findByIds(Worker, createJobDto.workerIds);

      // Create job
      job = manager.create(Job, {
        jobName: createJobDto.jobName,
        startDate: createJobDto.startDate,
        endDate: createJobDto.endDate,
        employer,
        client,
        workCenter,
        workers,
        note: createJobDto.note,
        status: createJobDto.status || JobStatus.SCHEDULED, // Default to SCHEDULED if not provided
      });
      await manager.save(job);

      // Shifts
      for (const shiftDto of createJobDto.shifts) {
        const shift = manager.create(Shift, { ...shiftDto, job });
        await manager.save(shift);
      }

      // Signing Methods
      for (const signingDto of createJobDto.signingMethods) {
        const signingMethod = manager.create(SigningMethod, { ...signingDto, job });
        await manager.save(signingMethod);
      }

      // Alerts
      for (const alertDto of createJobDto.alerts) {
        const alert = manager.create(Alert, { ...alertDto, job });
        await manager.save(alert);
      }

      // Tasks (optional)
      if (createJobDto.tasks) {
        for (const taskDto of createJobDto.tasks) {
          const task = manager.create(Task, { ...taskDto, job });
          await manager.save(task);
        }
      }

      // Survey (optional)
      if (createJobDto.survey) {
        const survey = manager.create(Survey, {
          ...createJobDto.survey,
          job,
          employer,
        });
        await manager.save(survey);
        // Survey Questions
        for (const questionDto of createJobDto.survey.questions) {
          const question = manager.create(SurveyQuestion, { ...questionDto, survey });
          await manager.save(question);
        }
      }
    });
    // Fetch with all relations
    return this.jobRepo.findOne({
      where: { id: job.id },
      relations: [
        'employer',
        'client',
        'workCenter',
        'workers',
        'shifts',
        'signingMethods',
        'alerts',
        'tasks',
        'surveys',
        'surveys.questions',
      ],
    });
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
      relations: ['client', 'workCenter', 'workers', 'tasks'],
      select: {
        id: true,
        jobName: true,
        client: { id: true, name: true },
        workCenter: { id: true, name: true },
        workers: { id: true, code: true },
        tasks: { id: true, name: true, note: true, expectedDuration: true },
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
        relations: ['client', 'workCenter', 'workers', 'tasks'],
        select: {
          id: true,
          jobName: true,
          client: { id: true, name: true },
          workCenter: { id: true, name: true },
          workers: { id: true, code: true },
          tasks: { id: true, name: true, note: true, expectedDuration: true },
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
          .leftJoinAndSelect('job.workCenter', 'workCenter')
          .leftJoinAndSelect('job.workers', 'worker')
          .leftJoinAndSelect('job.tasks', 'tasks')
          .where('worker.id = :workerId', { workerId: workerUser.worker.id })
          .select([
            'job.id', 'job.jobName',
            'client.id', 'client.name',
            'workCenter.id', 'workCenter.name',
            'worker.id', 'worker.code',
            'tasks.id', 'tasks.name', 'tasks.note', 'tasks.expectedDuration'
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

  return jobsWithWorkerNames;
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
      relations: ['client', 'workCenter', 'tasks', 'workers', 'shifts'],
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

    const formatted = jobs.map(job => ({
      jobId: job.id,
      jobName: job.jobName,
      clientName: job.client?.name || '',
      workCenter: job.workCenter?.name || '',
      totalShifts: job.shifts?.length || 0,
      expectedDuration: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0),
      tasks: job.tasks?.map(task => task.name) || [],
      workers: job.workers.map(worker => ({
        id: worker.id,
        code: worker.code,
        name: workerIdToName.get(worker.id) || null,
      })),
    }));

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


//worker dashboard job card
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

    const jobs = await this.jobRepo.find({
      where: {
        workers: { id: workerId }, // Filter jobs where this worker is assigned
      },
      relations: ['client', 'workCenter', 'tasks', 'shifts', 'signingMethods'],
      order: { id: 'ASC' },
    });

    const formatted = jobs.map(job => ({
      jobId: job.id,
      jobName: job.jobName,
      clientName: job.client?.name || '',
      workCenter: job.workCenter?.name || '',
      status: job.status || JobStatus.SCHEDULED, // Include job status from database
      totalShifts: job.shifts?.length || 0,
      expectedDuration: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0),
      tasks: job.tasks?.map(task => task.name) || [],
      shifts: job.shifts?.map(shift => ({
        shiftType: shift.shiftType,
        startTime: shift.startTime,
        endTime: shift.endTime,
        totalHours: shift.totalHours,
      })) || [],
      signingMethods: job.signingMethods?.map(sm => ({
        methodType: sm.methodType,
        methodDetails: sm.methodDetails,
        verifyIdentity: sm.verifyIdentity,
      })) || [],
    }));

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

      const jobs = await this.jobRepo.find({
        where: { client: { id: clientId } },
        relations: ['client', 'workCenter', 'tasks', 'workers', 'shifts'],
        order: { id: 'ASC' },
      });

      // Get worker names for all workers in all jobs
      const workerIds = jobs.flatMap(job => job.workers.map(w => w.id));
      const uniqueWorkerIds = [...new Set(workerIds)];

      const workerUsers = await this.workerUserRepo.find({
        where: uniqueWorkerIds.length
          ? uniqueWorkerIds.map(id => ({ worker: { id } }))
          : undefined,
        relations: ['user', 'worker'],
      });

      const workerIdToName = new Map<number, string>();
      for (const wu of workerUsers) {
        if (wu.worker?.id && wu.user?.name) {
          workerIdToName.set(wu.worker.id, wu.user.name);
        }
      }

      const formatted = jobs.map(job => ({
        jobId: job.id,
        jobNo: `JOB-${String(job.id).padStart(4, '0')}`,
        jobName: job.jobName,
        clientName: job.client?.name || '',
        workCenter: job.workCenter?.name || '',
        status: job.status || JobStatus.SCHEDULED, // Include job status
        workers: job.workers.map(worker => ({
          id: worker.id,
          code: worker.code,
          name: workerIdToName.get(worker.id) || null,
        })),
        shifts: job.shifts?.map(shift => ({
          day: shift.day,
          shiftType: shift.shiftType,
          startTime: shift.startTime,
          endTime: shift.endTime,
          totalHours: shift.totalHours,
          scheduleType: shift.scheduleType,
        })) || [],
        tasks: job.tasks?.map(task => ({
          id: task.id,
          name: task.name,
          expectedDuration: task.expectedDuration,
        })) || [],
      }));

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

  // ========== QR Code Generation and Scanning Methods ========== //

  /**
   * Generate QR Code for a job
   */
  async generateJobQrCode(generateQrCodeDto: GenerateQrCodeDto): Promise<{ qrCode: string; jobData: any }> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: generateQrCodeDto.jobId },
        relations: ['client', 'workCenter', 'shifts'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Create QR code data
      const qrData = {
        jobId: job.id,
        jobName: job.jobName,
        clientName: job.client?.name || '',
        workCenter: job.workCenter?.name || '',
        startDate: job.startDate,
        endDate: job.endDate,
        timestamp: new Date().toISOString(),
      };

      // Generate QR code as base64 data URL
      const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      });

      return {
        qrCode,
        jobData: qrData,
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Record a scan event
   */
  async recordScan(recordScanDto: RecordScanDto, userId: number): Promise<{ status: string; scanData: ScanLog }> {
    try {
      // Get worker from token (similar to getAllJobsByWorkerFromToken)
      const workerUser = await this.workerUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['worker'],
      });

      if (!workerUser?.worker?.id) {
        throw new Error('Worker not found for this user');
      }

      const workerId = workerUser.worker.id;

      // Verify job exists
      const job = await this.jobRepo.findOne({
        where: { id: recordScanDto.jobId },
        relations: ['workers'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Check if worker is assigned to this job
      const isWorkerAssigned = job.workers.some(w => w.id === workerId);
      if (!isWorkerAssigned) {
        throw new Error('Worker is not assigned to this job');
      }

      // Create scan log entry
      const scanLog = this.scanLogRepo.create({
        jobId: recordScanDto.jobId,
        workerId: workerId,
        scanType: recordScanDto.scanType,
        location: recordScanDto.location,
        notes: recordScanDto.notes,
      });

      const savedScanLog = await this.scanLogRepo.save(scanLog);

      return {
        status: 'Scan recorded successfully',
        scanData: savedScanLog,
      };
    } catch (error) {
      throw new Error(`Failed to record scan: ${error.message}`);
    }
  }

  /**
   * Get scan history for a job
   */
  async getJobScanHistory(jobId: number): Promise<any[]> {
    try {
      const scanLogs = await this.scanLogRepo.find({
        where: { jobId },
        relations: ['worker', 'worker.user'],
        order: { scanTime: 'DESC' },
      });

      return scanLogs.map(log => ({
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
      }));
    } catch (error) {
      throw new Error(`Failed to fetch scan history: ${error.message}`);
    }
  }

  /**
   * Get scan history for a worker
   */
  async getWorkerScanHistory(workerId: number): Promise<any[]> {
    try {
      const scanLogs = await this.scanLogRepo.find({
        where: { workerId },
        relations: ['job', 'job.client'],
        order: { scanTime: 'DESC' },
      });

      return scanLogs.map(log => ({
        id: log.id,
        scanType: log.scanType,
        scanTime: log.scanTime,
        location: log.location,
        notes: log.notes,
        job: {
          id: log.job.id,
          jobName: log.job.jobName,
          clientName: log.job.client?.name || '',
        },
      }));
    } catch (error) {
      throw new Error(`Failed to fetch worker scan history: ${error.message}`);
    }
  }

  /**
   * Get today's attendance summary for a job
   */
  async getTodayAttendanceSummary(jobId: number): Promise<any> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayScans = await this.scanLogRepo
        .createQueryBuilder('scan')
        .leftJoinAndSelect('scan.worker', 'worker')
        .leftJoinAndSelect('worker.user', 'user')
        .where('scan.jobId = :jobId', { jobId })
        .andWhere('scan.scanTime >= :today', { today })
        .andWhere('scan.scanTime < :tomorrow', { tomorrow })
        .orderBy('scan.scanTime', 'ASC')
        .getMany();

      // Group scans by worker
      const workerScans = new Map();
      
      todayScans.forEach(scan => {
        const workerId = scan.workerId;
        if (!workerScans.has(workerId)) {
          workerScans.set(workerId, {
            worker: {
              id: scan.worker.id,
              code: scan.worker.code,
              name: scan.worker.user?.name || null,
            },
            scans: [],
          });
        }
        workerScans.get(workerId).scans.push({
          scanType: scan.scanType,
          scanTime: scan.scanTime,
          location: scan.location,
        });
      });

      return {
        date: today.toISOString().split('T')[0],
        totalWorkers: workerScans.size,
        attendanceData: Array.from(workerScans.values()),
      };
    } catch (error) {
      throw new Error(`Failed to fetch attendance summary: ${error.message}`);
    }
  }

  // ========== Job Status Management Methods ========== //

  /**
   * Update job status
   */
  async updateJobStatus(jobId: number, updateJobStatusDto: UpdateJobStatusDto, userId: number): Promise<{ message: string; job: Job }> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['employer', 'client', 'workCenter'],
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
        relations: ['client', 'workCenter', 'workers', 'tasks', 'shifts'],
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
        relations: ['scanLogs', 'tasks'],
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

} 