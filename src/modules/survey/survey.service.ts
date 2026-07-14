import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { DateTime } from 'luxon';
import { Survey } from './entities/survey.entity';
import { SurveyResponse } from './entities/survey-response.entity';
import { Job } from '../job/entities/job.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { AlertsService } from '../realtime/alerts.service';

const BUSINESS_TZ = 'Europe/Madrid';

@Injectable()
export class SurveyService {
  constructor(
    @InjectRepository(Survey) private surveyRepo: Repository<Survey>,
    @InjectRepository(SurveyResponse) private responseRepo: Repository<SurveyResponse>,
    @InjectRepository(Job) private jobRepo: Repository<Job>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    private alerts: AlertsService,
  ) {}

  private todayKey(): string {
    return DateTime.now().setZone(BUSINESS_TZ).toFormat('yyyy-MM-dd');
  }

  /** Bucket a date into the survey's period so a periodic survey is "due" once per period. */
  private periodKeyFor(periodicity: string | null, dateStr: string): string {
    const dt = DateTime.fromISO(dateStr, { zone: BUSINESS_TZ });
    const p = (periodicity || 'daily').toLowerCase();
    if (p === 'weekly') return `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
    if (p === 'monthly') return dt.toFormat('yyyy-MM');
    return dt.toFormat('yyyy-MM-dd');
  }

  private classify(s: Survey): 'customer' | 'worker' {
    return s.client ? 'customer' : 'worker';
  }

  private cfg(s: Survey, periodKey: string) {
    return {
      surveyPublicId: s.publicId,
      questionText: s.questionText,
      rateDigit: s.rateDigit,
      textAlertTracking: s.textAlertTracking,
      greetingText: s.greetingText,
      periodicity: s.periodicity || 'daily',
      periodKey,
    };
  }

  private respView(r: SurveyResponse | null) {
    if (!r) return null;
    return {
      rating: r.rating,
      comment: r.comment,
      submittedAt: r.submittedAt,
      by: r.worker ? 'worker' : r.client ? 'client' : null,
    };
  }

  private async resolveJob(jobKey: string): Promise<Job> {
    const where: any = isUUID(jobKey) ? { publicId: jobKey } : { id: Number(jobKey) };
    const job = await this.jobRepo.findOne({
      where,
      relations: ['surveys', 'surveys.client', 'surveys.worker', 'client'],
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private async callerRole(userId: number): Promise<'worker' | 'client' | 'employer' | null> {
    if (await this.workerUserRepo.findOne({ where: { userId } })) return 'worker';
    if (await this.clientUserRepo.findOne({ where: { user: { id: userId } } })) return 'client';
    if (await this.employerUserRepo.findOne({ where: { user: { id: userId } } })) return 'employer';
    return null;
  }

  /** Survey status (worker + customer) for a job on a given date: config, filled?, response. */
  async getStatus(userId: number, jobKey: string, dateStr?: string) {
    const date = dateStr || this.todayKey();
    const job = await this.resolveJob(jobKey);
    const role = await this.callerRole(userId);

    const workerSurvey = (job.surveys || []).find((s) => this.classify(s) === 'worker') || null;
    const customerSurvey = (job.surveys || []).find((s) => this.classify(s) === 'customer') || null;

    const build = async (s: Survey | null, fillRole: 'worker' | 'client') => {
      if (!s) return null;
      const periodKey = this.periodKeyFor(s.periodicity, date);
      const resp = await this.responseRepo.findOne({
        where: { survey: { id: s.id }, periodKey },
        relations: ['worker', 'client'],
        order: { submittedAt: 'DESC' },
      });
      return {
        ...this.cfg(s, periodKey),
        filled: !!resp,
        response: this.respView(resp),
        canFill: role === fillRole && !resp,
      };
    };

    return {
      message: 'Success',
      data: {
        date,
        worker: await build(workerSurvey, 'worker'),
        customer: await build(customerSurvey, 'client'),
      },
      isSuccess: true,
      statusCode: 200,
    };
  }

  /** Submit a survey response for the caller (worker → worker survey, client → customer survey). */
  async submit(userId: number, surveyPublicId: string, body: { date?: string; rating: number; reason?: string }) {
    const survey = await this.surveyRepo.findOne({
      where: { publicId: surveyPublicId },
      relations: ['job', 'job.workers', 'job.employer', 'job.client', 'client', 'worker'],
    });
    if (!survey) throw new NotFoundException('Survey not found');
    if (!survey.job) throw new BadRequestException('Survey is not linked to a job');

    const type = this.classify(survey);
    const rating = Number(body.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
      throw new BadRequestException('La valoración debe estar entre 0 y 10.');
    }
    if (survey.rateDigit != null && rating <= survey.rateDigit && !body.reason?.trim()) {
      throw new BadRequestException(survey.textAlertTracking || 'Indica el motivo de la valoración.');
    }

    let responseWorker: any = null;
    let responseClient: any = null;

    if (type === 'worker') {
      const wu = await this.workerUserRepo.findOne({ where: { userId }, relations: ['worker'] });
      if (!wu?.worker) throw new ForbiddenException('Solo el trabajador puede responder esta encuesta.');
      const assigned = (survey.job.workers || []).some((w) => w.id === wu.worker.id);
      if (!assigned) throw new ForbiddenException('No estás asignado a este trabajo.');
      responseWorker = wu.worker;
    } else {
      const cu = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
      if (!cu?.client) throw new ForbiddenException('Solo el cliente puede responder esta encuesta.');
      if (survey.job.client && cu.client.id !== survey.job.client.id) {
        throw new ForbiddenException('Esta encuesta pertenece a otro cliente.');
      }
      responseClient = cu.client;
    }

    const date = body.date || this.todayKey();
    const periodKey = this.periodKeyFor(survey.periodicity, date);

    const existing = await this.responseRepo.findOne({ where: { survey: { id: survey.id }, periodKey } });
    if (existing) throw new BadRequestException('La encuesta de este periodo ya ha sido respondida.');

    const saved = await this.responseRepo.save(
      this.responseRepo.create({
        survey,
        job: survey.job,
        worker: responseWorker,
        client: responseClient,
        periodKey,
        rating,
        comment: body.reason?.trim() || null,
      }),
    );

    // Threshold escalation — notify the employer when the rating is at/below the alert digit.
    if (survey.rateDigit != null && rating <= survey.rateDigit) {
      try {
        const eu = await this.employerUserRepo.findOne({
          where: { employer: { id: survey.job.employer.id } },
          relations: ['user'],
        });
        if (eu?.user?.id) {
          await this.alerts.createAndEmitForUser({
            userId: eu.user.id,
            role: 'EMPLOYER',
            type: 'SURVEY_ALERT',
            message: `Encuesta ${type === 'worker' ? 'de trabajador' : 'de cliente'} con valoración baja (${rating}/10) en "${survey.job.jobName}".`,
            meta: {
              jobId: survey.job.id,
              jobPublicId: survey.job.publicId,
              surveyPublicId: survey.publicId,
              rating,
              reason: saved.comment,
              surveyType: type,
            },
          });
        }
      } catch (e: any) {
        console.error('Survey alert notify failed:', e?.message);
      }
    }

    return {
      message: 'Encuesta enviada',
      data: { publicId: saved.publicId, rating: saved.rating, comment: saved.comment, periodKey },
      isSuccess: true,
      statusCode: 200,
    };
  }
}
