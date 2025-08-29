import { Injectable } from '@nestjs/common';
// Mock WorkCenter data (used for every client)
const MOCK_WORK_CENTER = { id: 1, name: 'WorkCenter 1' };
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Job } from './entities/job.entity';
import { Shift } from './entities/shift.entity';
import { SigningMethod } from './entities/signing-method.entity';
import { Alert } from './entities/alert.entity';
import { Task } from './entities/task.entity';
import { TaskHistory } from './entities/task-history.entity';
import { ScanLog } from './entities/scan-log.entity';
import { WorkSession } from './entities/work-session.entity';
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
    @InjectRepository(SurveyQuestion) private surveyQuestionRepo: Repository<SurveyQuestion>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    private dataSource: DataSource,
    private alertsService: AlertsService,
  ) {}

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
    // Use the mock WorkCenter for every client
    const workCenter = { ...MOCK_WORK_CENTER, clientId: createJobDto.clientId };

    /*
    // Previous code to fetch WorkCenter from DB
    // const workCenter = await manager.findOneOrFail(WorkCenter, { where: { id: createJobDto.workCenterId } });
    */
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
      for (const shiftDto of createJobDto.shifts || []) {
        const shift = manager.create(Shift, { ...shiftDto, job });
        await manager.save(shift);
      }

      // Signing Methods
      for (const signingDto of createJobDto.signingMethods || []) {
        const signingMethod = manager.create(SigningMethod, { ...signingDto, job });
        await manager.save(signingMethod);
      }

      // Alerts
      for (const alertDto of createJobDto.alerts || []) {
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
        for (const questionDto of createJobDto.survey.questions || []) {
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
    
    // 1. Delete survey questions and surveys
    const surveys = await manager.find(Survey, { where: { job: { id: jobId } } });
    for (const survey of surveys) {
      await manager.delete(SurveyQuestion, { survey: { id: survey.id } });
      await manager.delete(Survey, { id: survey.id });
    }

    // 2. Delete tasks
    await manager.delete(Task, { job: { id: jobId } });

    // 3. Delete alerts
    await manager.delete(Alert, { job: { id: jobId } });

    // 4. Delete signing methods
    await manager.delete(SigningMethod, { job: { id: jobId } });

    // 5. Delete shifts
    await manager.delete(Shift, { job: { id: jobId } });

    // 6. Delete scan logs and work sessions
    await manager.delete(ScanLog, { job: { id: jobId } });
    await manager.delete(WorkSession, { job: { id: jobId } });

    // Finally, delete the job itself
    await manager.delete(Job, { id: jobId });
  });
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
      startDate: job.startDate, // Added
      endDate: job.endDate,     // Added
      status: job.status || JobStatus.SCHEDULED, // Added status if available
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

// worker dashboard job card
// async getAllJobsByWorkerFromToken(userId: number) {
//   try {
//     const workerUser = await this.workerUserRepo.findOne({
//       where: { user: { id: userId } },
//       relations: ['worker'],
//     });

//     if (!workerUser?.worker?.id) {
//       throw new Error('Worker not found for this user');
//     }

//     const workerId = workerUser.worker.id;

//     const jobs = await this.jobRepo.find({
//       where: {
//         workers: { id: workerId }, // Filter jobs where this worker is assigned
//       },
//       relations: ['client', 'workCenter', 'tasks', 'shifts', 'signingMethods', 'workSessions'],
//       order: { id: 'ASC' },
//     });

//     // Get active work sessions for this worker
//     const activeWorkSessions = await this.workSessionRepo.find({
//       where: {
//         worker: { id: workerId },
//         checkOutTime: IsNull(),
//       },
//       relations: ['job'],
//     });

//     const activeSessionsByJobId = new Map();
//     activeWorkSessions.forEach(session => {
//       activeSessionsByJobId.set(session.job.id, session);
//     });

//     const formatted = jobs.map(job => {
//       const activeSession = activeSessionsByJobId.get(job.id);
      
//       return {
//         jobId: job.id,
//         jobName: job.jobName,
//         clientName: job.client?.name || '',
//         workCenter: job.workCenter?.name || '',
//         status: job.status || JobStatus.SCHEDULED,
//         startDate: job.startDate, // ✅ Added
//         endDate: job.endDate,     // ✅ Added
//         totalShifts: job.shifts?.length || 0,
//         expectedDuration: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0),
//         tasks: job.tasks?.map(task => ({
//           id: task.id,
//           name: task.name,
//           note: task.note,
//           expectedDuration: task.expectedDuration,
//           isCompleted: task.isCompleted || false,
//           completedAt: task.completedAt,
//           completedByWorkerId: task.completedByWorkerId,
//         })) || [],
//         shifts: job.shifts?.map(shift => ({
//           shiftType: shift.shiftType,
//           startTime: shift.startTime,
//           endTime: shift.endTime,
//           totalHours: shift.totalHours,
//         })) || [],
//         signingMethods: job.signingMethods?.map(sm => ({
//           methodType: sm.methodType,
//           methodDetails: sm.methodDetails,
//           verifyIdentity: sm.verifyIdentity,
//         })) || [],
//         workSession: activeSession ? {
//           id: activeSession.id,
//           checkInTime: activeSession.checkInTime,
//           isOnBreak: activeSession.isOnBreak,
//           currentBreakStart: activeSession.currentBreakStart,
//           totalWorkMinutes: activeSession.totalWorkMinutes,
//           totalBreakMinutes: activeSession.totalBreakMinutes,
//         } : null,
//       };
//     });

//     return {
//       message: 'Success',
//       data: formatted,
//       isSuccess: true,
//       statusCode: 200,
//       developerError: '',
//     };
//   } catch (error) {
//     return {
//       message: 'Error fetching jobs',
//       data: [],
//       isSuccess: false,
//       statusCode: 500,
//       developerError: error.message,
//     };
//   }
// }


// Updated method in job.service.ts
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

    // Get today's date for TaskHistory filtering
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

    const jobs = await this.jobRepo.find({
      where: {
        workers: { id: workerId },
      },
      relations: [
        'client', 
        'workCenter', 
        'tasks', 
        'tasks.taskHistories', // Include task histories
        'shifts', 
        'signingMethods', 
        'workSessions'
      ],
      order: { id: 'ASC' },
    });

    // Get active work sessions for this worker
    const activeWorkSessions = await this.workSessionRepo.find({
      where: {
        worker: { id: workerId },
        checkOutTime: IsNull(),
      },
      relations: ['job'],
    });

    const activeSessionsByJobId = new Map();
    activeWorkSessions.forEach(session => {
      activeSessionsByJobId.set(session.job.id, session);
    });

    const formatted = jobs.map(job => {
      const activeSession = activeSessionsByJobId.get(job.id);
      
      return {
        jobId: job.id,
        jobName: job.jobName,
        clientName: job.client?.name || '',
        workCenter: job.workCenter?.name || '',
        status: job.status || JobStatus.SCHEDULED,
        startDate: job.startDate,
        endDate: job.endDate,
        totalShifts: job.shifts?.length || 0,
        expectedDuration: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0),
        
        // Enhanced task mapping with TaskHistory
        tasks: job.tasks?.map(task => {
          // Find today's TaskHistory for this specific task
          const todayHistory = task.taskHistories?.find(
            history => {
              const historyDate = new Date(history.date).toISOString().split('T')[0];
              return historyDate === todayString;
            }
          );

          return {
            id: task.id,
            name: task.name,
            note: task.note,
            expectedDuration: task.expectedDuration,
            // Use TaskHistory data if available, otherwise use task's default completion status
            isCompleted: todayHistory ? todayHistory.isCompleted : (task.isCompleted || false),
            completedAt: todayHistory ? todayHistory.completedAt : task.completedAt,
            completedByWorkerId: todayHistory ? todayHistory.completedByWorkerId : task.completedByWorkerId,
            // Include TaskHistory for frontend reference
            taskHistories: task.taskHistories?.map(history => ({
              id: history.id,
              taskId: history.taskId,
              date: history.date,
              isCompleted: history.isCompleted,
              completedAt: history.completedAt,
              completedByWorkerId: history.completedByWorkerId,
            })) || []
          };
        }) || [],
        
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
        workSession: activeSession ? {
          id: activeSession.id,
          checkInTime: activeSession.checkInTime,
          isOnBreak: activeSession.isOnBreak,
          currentBreakStart: activeSession.currentBreakStart,
          totalWorkMinutes: activeSession.totalWorkMinutes,
          totalBreakMinutes: activeSession.totalBreakMinutes,
        } : null,
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
          startDate: job.startDate, // ✅ Added
  endDate: job.endDate,     // ✅ Added
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






  // ========== Client Dashboard Enhanced Methods ========== //

  /**
   * Get job history with detailed information for client dashboard
   */
  async getJobHistoryForClient(userId: number, jobId?: number) {
    try {
      const clientUser = await this.clientUserRepo.findOne({
        where: { user: { id: userId } },
        relations: ['client'],
      });

      if (!clientUser?.client?.id) {
        throw new Error('Client not found for this user');
      }

      const clientId = clientUser.client.id;

      // Base query for jobs
      let whereClause: any = { client: { id: clientId } };
      if (jobId) {
        whereClause.id = jobId;
      }

      const jobs = await this.jobRepo.find({
        where: whereClause,
        relations: [
          'client', 
          'workCenter', 
          'tasks', 
          'workers', 
          'shifts', 
          'signingMethods',
          'scanLogs',
          'workSessions',
          'workSessions.worker'
        ],
        order: { id: 'DESC' },
      });

      // Get worker names
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

      const enhancedJobs = jobs.map(job => {
        // Calculate time summary
        const workSessions = job.workSessions || [];
        const totalWorkMinutes = workSessions.reduce((sum, session) => sum + (session.totalWorkMinutes || 0), 0);
        const totalBreakMinutes = workSessions.reduce((sum, session) => sum + (session.totalBreakMinutes || 0), 0);
        
        // Get scan logs for this job
        const scanLogs = (job.scanLogs || []).map(scan => ({
          id: scan.id,
          scanType: scan.scanType,
          scanTime: scan.scanTime,
          location: scan.location,
          notes: scan.notes,
          workerId: scan.workerId,
          workerName: workerIdToName.get(scan.workerId) || 'Unknown',
        }));

        // Calculate check-in methods used
        const checkInScans = scanLogs.filter(scan => scan.scanType === 'check-in');
        const usedVerificationMethods = job.signingMethods?.map(sm => sm.methodType) || [];

        // Task checklist with completion status
        const taskChecklist = (job.tasks || []).map(task => ({
          id: task.id,
          name: task.name,
          note: task.note,
          expectedDuration: task.expectedDuration,
          isCompleted: task.isCompleted || false,
          completedAt: task.completedAt,
          completedByWorkerId: task.completedByWorkerId,
          completedByWorkerName: task.completedByWorkerId ? workerIdToName.get(task.completedByWorkerId) || 'Unknown' : null,
        }));

        return {
          jobId: job.id,
          jobNo: `JOB-${String(job.id).padStart(4, '0')}`,
          jobName: job.jobName,
          clientName: job.client?.name || '',
          workCenter: job.workCenter?.name || '',
          status: job.status || 'SCHEDULED',
          startDate: job.startDate,
          endDate: job.endDate,
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
          // Security verification methods
          securityMethods: {
            available: job.signingMethods?.map(sm => ({
              methodType: sm.methodType,
              methodDetails: sm.methodDetails,
              verifyIdentity: sm.verifyIdentity,
            })) || [],
            used: usedVerificationMethods,
            checkInCount: checkInScans.length,
          },
          // Task checklist
          taskChecklist,
          taskProgress: {
            total: taskChecklist.length,
            completed: taskChecklist.filter(t => t.isCompleted).length,
            percentage: taskChecklist.length > 0 ? Math.round((taskChecklist.filter(t => t.isCompleted).length / taskChecklist.length) * 100) : 0,
          },
          // Time summary
          timeSummary: {
            totalWorkHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
            totalBreakHours: Math.round((totalBreakMinutes / 60) * 100) / 100,
            sessionsCount: workSessions.length,
            averageSessionHours: workSessions.length > 0 ? Math.round(((totalWorkMinutes / workSessions.length) / 60) * 100) / 100 : 0,
            workSessions: workSessions.map(session => ({
              id: session.id,
              workerName: workerIdToName.get(session.worker?.id) || 'Unknown',
              checkInTime: session.checkInTime,
              checkOutTime: session.checkOutTime,
              totalWorkMinutes: session.totalWorkMinutes,
              totalBreakMinutes: session.totalBreakMinutes,
              isOnBreak: session.isOnBreak,
            })),
          },
          // Activity history
          activityHistory: scanLogs,
          // Summary stats
          stats: {
            plannedHours: job.tasks?.reduce((sum, t) => sum + (t.expectedDuration || 0), 0) || 0,
            actualHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
            efficiency: job.tasks?.length > 0 && totalWorkMinutes > 0 
              ? Math.round(((job.tasks.reduce((sum, t) => sum + (t.expectedDuration || 0), 0) * 60) / totalWorkMinutes) * 100) 
              : 0,
          },
        };
      });

      return {
        message: 'Success',
        data: enhancedJobs,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching job history',
        data: [],
        isSuccess: false,
        statusCode: 500,
        developerError: error.message,
      };
    }
  }

  /**
   * Get detailed job analytics for client dashboard
   */
  async getJobAnalyticsForClient(userId: number) {
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
        relations: ['tasks', 'workSessions', 'scanLogs', 'signingMethods'],
      });

      // Calculate analytics
      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(job => job.status === JobStatus.COMPLETED).length;
      const inProgressJobs = jobs.filter(job => job.status === JobStatus.IN_PROGRESS).length;
      const scheduledJobs = jobs.filter(job => job.status === JobStatus.SCHEDULED).length;

      // Time analytics
      const totalWorkMinutes = jobs.reduce((sum, job) => {
        return sum + (job.workSessions?.reduce((sessSum, sess) => sessSum + (sess.totalWorkMinutes || 0), 0) || 0);
      }, 0);

      // Task analytics
      const totalTasks = jobs.reduce((sum, job) => sum + (job.tasks?.length || 0), 0);
      const completedTasks = jobs.reduce((sum, job) => {
        return sum + (job.tasks?.filter(task => task.isCompleted).length || 0);
      }, 0);

      // Security method usage
      const securityMethodUsage = new Map<string, number>();
      jobs.forEach(job => {
        job.signingMethods?.forEach(method => {
          const count = securityMethodUsage.get(method.methodType) || 0;
          securityMethodUsage.set(method.methodType, count + 1);
        });
      });

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentJobs = jobs.filter(job => new Date(job.startDate) >= thirtyDaysAgo);

      return {
        message: 'Success',
        data: {
          jobStats: {
            total: totalJobs,
            completed: completedJobs,
            inProgress: inProgressJobs,
            scheduled: scheduledJobs,
            completionRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
          },
          timeStats: {
            totalHours: Math.round((totalWorkMinutes / 60) * 100) / 100,
            averageJobHours: totalJobs > 0 ? Math.round(((totalWorkMinutes / 60) / totalJobs) * 100) / 100 : 0,
          },
          taskStats: {
            total: totalTasks,
            completed: completedTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          },
          securityMethodStats: Object.fromEntries(securityMethodUsage),
          recentActivity: {
            last30Days: recentJobs.length,
            trend: 'stable', // Could be calculated based on historical data
          },
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      return {
        message: 'Error fetching job analytics',
        data: null,
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
  async generateJobQrCode(generateQrCodeDto: GenerateQrCodeDto): Promise<{ qrData: any }> {
    try {
      const job = await this.jobRepo.findOne({
        where: { id: generateQrCodeDto.jobId },
        relations: ['client', 'workCenter', 'shifts'],
      });

      if (!job) {
        throw new Error('Job not found');
      }

      // Create QR code data - just return the data, don't generate image
      const qrData = {
        jobId: job.id,
        jobName: job.jobName,
        clientName: job.client?.name || '',
        workCenter: job.workCenter?.name || '',
        startDate: job.startDate,
        endDate: job.endDate,
        timestamp: new Date().toISOString(),
        // Add a secure token for verification
        token: `SECURE-JOB-${job.id}-${Date.now()}`,
      };

      return {
        qrData,
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code data: ${error.message}`);
    }
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

      // Create scan log entry
      const scanLog = this.scanLogRepo.create({
        jobId: recordScanDto.jobId,
        workerId: workerId,
        scanType: recordScanDto.scanType,
        location: recordScanDto.location,
        notes: recordScanDto.notes,
      });

      const savedScanLog = await this.scanLogRepo.save(scanLog);

      // Handle work session tracking based on scan type
      let workSession = null;
      
      switch (recordScanDto.scanType) {
        case 'check-in':
          workSession = await this.handleCheckIn(recordScanDto.jobId, workerId);
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
          workSession = await this.handleCheckOut(recordScanDto.jobId, workerId);
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
  private async handleCheckIn(jobId: number, workerId: number) {
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

    // Create new work session
    const workSession = this.workSessionRepo.create({
      job: { id: jobId },
      worker: { id: workerId },
      checkInTime: new Date(),
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

    // Calculate break duration and add to total
    const breakDuration = Math.floor((new Date().getTime() - activeSession.currentBreakStart.getTime()) / (1000 * 60));
    activeSession.totalBreakMinutes += breakDuration;
    activeSession.isOnBreak = false;
    activeSession.currentBreakStart = null;

    return await this.workSessionRepo.save(activeSession);
  }

  /**
   * Handle check-out logic
   */
  private async handleCheckOut(jobId: number, workerId: number) {
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
      const breakDuration = Math.floor((new Date().getTime() - activeSession.currentBreakStart.getTime()) / (1000 * 60));
      activeSession.totalBreakMinutes += breakDuration;
      activeSession.isOnBreak = false;
      activeSession.currentBreakStart = null;
    }

    // Calculate total work time
    const checkOutTime = new Date();
    const totalSessionTime = Math.floor((checkOutTime.getTime() - activeSession.checkInTime.getTime()) / (1000 * 60));
    activeSession.totalWorkMinutes = totalSessionTime - activeSession.totalBreakMinutes;
    activeSession.checkOutTime = checkOutTime;

    const updatedSession = await this.workSessionRepo.save(activeSession);

    // Update job status based on check-out and task completion
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: ['tasks', 'workSessions'],
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
  async completeTask(taskId: number, workerId: number) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['job'],
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Check if worker is assigned to this job
    const job = await this.jobRepo.findOne({
      where: { id: task.job.id },
      relations: ['workers'],
    });

    if (!job) {
      throw new Error('Job not found');
    }

    const isWorkerAssigned = job.workers.some(w => w.id === workerId);
    if (!isWorkerAssigned) {
      throw new Error('Worker is not assigned to this job');
    }

    // Update task as completed
    task.isCompleted = true;
    task.completedAt = new Date();
    task.completedByWorkerId = workerId;

    const updatedTask = await this.taskRepo.save(task);

    // Check if all tasks for this job are completed
    const allTasks = await this.taskRepo.find({
      where: { job: { id: task.job.id } },
    });

    const allTasksCompleted = allTasks.every(t => t.isCompleted);
    if (allTasksCompleted) {
      job.status = JobStatus.COMPLETED;
      await this.jobRepo.save(job);
    }

    return {
      task: updatedTask,
      allTasksCompleted,
      jobStatus: job.status,
    };
  }

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

    // Combine into daily history cards
    const result = Object.keys(groupedByDate).map(date => ({
      date,
      scans: groupedByDate[date],
      breaks: breaksByDate[date],
      sessions: sessionsByDate[date] || [],
    }));

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


// async toggleTaskCompletion(taskId: number, workerId: number, jobId: number) {
//   try {
//     // Verify task exists and belongs to this job
//     const task = await this.taskRepo.findOne({
//       where: { id: taskId, job: { id: jobId } },
//       relations: ['job', 'job.workers'],
//     });

//     if (!task) {
//       throw new Error('Task not found in this job');
//     }

//     // Verify worker is assigned to this job
//     const isWorkerAssigned = task.job.workers.some(w => w.id === workerId);
//     if (!isWorkerAssigned) {
//       throw new Error('Worker not assigned to this job');
//     }

//     // Toggle completion status
//     task.isCompleted = !task.isCompleted;
//     task.completedAt = task.isCompleted ? new Date() : null;
//     task.completedByWorkerId = task.isCompleted ? workerId : null;

//     const updatedTask = await this.taskRepo.save(task);

//     // Create history record
//     const history = this.taskHistoryRepo.create({
//       taskId,
//       jobId,
//       date: new Date(),
//       isCompleted: task.isCompleted,
//       completedAt: task.completedAt,
//       completedByWorkerId: task.completedByWorkerId,
//     });
//     await this.taskHistoryRepo.save(history);

//     return {
//       message: 'Task completion toggled successfully',
//       isCompleted: task.isCompleted,
//       isSuccess: true,
//       statusCode: 200,
//       developerError: '',
//     };
//   } catch (error) {
//     return {
//       message: 'Failed to toggle task completion',
//       isCompleted: null,
//       isSuccess: false,
//       statusCode: 500,
//       developerError: error.message,
//     };
//   }
// }


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
      return historyDate === todayString;
    });

    if (todayHistory) {
      // Update existing TaskHistory
      todayHistory.isCompleted = !todayHistory.isCompleted;
      todayHistory.completedAt = todayHistory.isCompleted ? new Date() : null;
      todayHistory.completedByWorkerId = todayHistory.isCompleted ? workerId : null;
      
      const updatedHistory = await this.taskHistoryRepo.save(todayHistory);
      
      return {
        message: 'Task completion toggled successfully',
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
      relations: ['tasks', 'tasks.taskHistories', 'workers'],
    });
    if (!job) return;
    for (const task of job.tasks) {
      // Only save for assigned workers
      const isWorkerAssigned = job.workers.some(w => w.id === workerId);
      if (!isWorkerAssigned) continue;
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

} 


