import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, IsNull, LessThan, Repository } from 'typeorm';
import { DateTime } from 'luxon';
import { SurveyForm } from './entities/survey-form.entity';
import { SurveyFormQuestion } from './entities/survey-form-question.entity';
import { SurveyFormResponse } from './entities/survey-form-response.entity';
import { SurveyFormAnswer } from './entities/survey-form-answer.entity';
import { SurveyFormSubmission } from './entities/survey-form-submission.entity';
import { SurveyFormSettings } from './entities/survey-form-settings.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { AlertsService } from '../realtime/alerts.service';

const QUESTION_TYPES = ['rating', 'yes_no', 'single_choice', 'multi_choice', 'text'];

interface QuestionInput {
  text: string;
  type: string;
  required?: boolean;
  options?: any;
}

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    @InjectRepository(SurveyForm) private formRepo: Repository<SurveyForm>,
    @InjectRepository(SurveyFormQuestion) private questionRepo: Repository<SurveyFormQuestion>,
    @InjectRepository(SurveyFormResponse) private responseRepo: Repository<SurveyFormResponse>,
    @InjectRepository(SurveyFormAnswer) private answerRepo: Repository<SurveyFormAnswer>,
    @InjectRepository(SurveyFormSubmission) private submissionRepo: Repository<SurveyFormSubmission>,
    @InjectRepository(SurveyFormSettings) private settingsRepo: Repository<SurveyFormSettings>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerWorker) private employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(EmployerClient) private employerClientRepo: Repository<EmployerClient>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
    private readonly alerts: AlertsService,
  ) {}

  // ---- Settings (per employer) ----

  async getSettings(userId: number) {
    const employerId = await this.employerIdForUser(userId);
    const s = await this.settingsRepo.findOne({ where: { employerId } });
    return { retentionDays: s?.retentionDays ?? null };
  }

  async updateSettings(userId: number, dto: { retentionDays?: number | null }) {
    const employerId = await this.employerIdForUser(userId);
    let s = await this.settingsRepo.findOne({ where: { employerId } });
    if (!s) s = this.settingsRepo.create({ employerId });
    const days = dto.retentionDays;
    s.retentionDays = days == null || days === ('' as any) || Number(days) <= 0 ? null : Math.floor(Number(days));
    await this.settingsRepo.save(s);
    return { retentionDays: s.retentionDays };
  }

  // All user ids of an audience for an employer.
  private async audienceUserIds(employerId: number, audience: string): Promise<number[]> {
    if (audience === 'WORKERS') {
      const links = await this.employerWorkerRepo.find({ where: { employer: { id: employerId } }, relations: ['worker'] });
      const workerIds = links.map((l) => l.worker?.id).filter(Boolean) as number[];
      if (!workerIds.length) return [];
      const wu = await this.workerUserRepo.find({ where: { worker: { id: In(workerIds) } }, relations: ['user'] });
      return wu.map((x) => x.user?.id).filter(Boolean) as number[];
    }
    const links = await this.employerClientRepo.find({ where: { employer: { id: employerId } }, relations: ['client'] });
    const clientIds = links.map((l) => l.client?.id).filter(Boolean) as number[];
    if (!clientIds.length) return [];
    const cu = await this.clientUserRepo.find({ where: { client: { id: In(clientIds) } }, relations: ['user'] });
    return cu.map((x) => x.user?.id).filter(Boolean) as number[];
  }

  private async notifyAudienceOfSurvey(form: SurveyForm) {
    try {
      const userIds = await this.audienceUserIds(form.employerId, form.audience);
      const role = form.audience === 'WORKERS' ? 'WORKER' : 'CLIENT';
      for (const uid of userIds) {
        await this.alerts.createAndEmitForUser({
          userId: uid,
          role: role as any,
          type: 'SURVEY_PUBLISHED',
          message: `Nueva encuesta: ${form.title}`,
          meta: { surveyPublicId: form.publicId },
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to notify survey audience: ${(e as Error)?.message}`);
    }
  }

  // Daily purge of responses older than each employer's retention window.
  @Cron('0 3 * * *')
  async purgeExpiredResponses() {
    const rows = await this.settingsRepo.find({ where: { retentionDays: Not(IsNull()) } });
    for (const s of rows) {
      if (!s.retentionDays || s.retentionDays <= 0) continue;
      const cutoff = DateTime.now().minus({ days: s.retentionDays }).toJSDate();
      const forms = await this.formRepo.find({ where: { employerId: s.employerId } });
      const formIds = forms.map((f) => f.id);
      if (!formIds.length) continue;
      try {
        await this.responseRepo.delete({ form: { id: In(formIds) }, submittedAt: LessThan(cutoff) } as any);
        await this.submissionRepo.delete({ formId: In(formIds), submittedAt: LessThan(cutoff) });
      } catch (e) {
        this.logger.warn(`Purge failed for employer ${s.employerId}: ${(e as Error)?.message}`);
      }
    }
  }

  private today(): string {
    return DateTime.now().setZone('Europe/Madrid').toISODate() as string;
  }

  private async employerIdForUser(userId: number): Promise<number> {
    const link = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!link?.employer?.id) throw new NotFoundException('Employer not found for this user');
    return link.employer.id;
  }

  // Determine whether the caller is a worker or client and their employer.
  private async resolveRespondent(userId: number): Promise<{ role: 'WORKER' | 'CLIENT'; employerId: number }> {
    const w = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    if (w?.worker?.id) {
      const link = await this.employerWorkerRepo.findOne({ where: { worker: { id: w.worker.id } }, relations: ['employer'] });
      if (link?.employer?.id) return { role: 'WORKER', employerId: link.employer.id };
    }
    const c = await this.clientUserRepo.findOne({ where: { user: { id: userId } }, relations: ['client'] });
    if (c?.client?.id) {
      const link = await this.employerClientRepo.findOne({ where: { client: { id: c.client.id } }, relations: ['employer'] });
      if (link?.employer?.id) return { role: 'CLIENT', employerId: link.employer.id };
    }
    throw new ForbiddenException('Not a worker or client');
  }

  private mapForm(f: SurveyForm, extra?: Record<string, any>) {
    return {
      id: f.publicId,
      title: f.title,
      description: f.description,
      audience: f.audience,
      anonymous: f.anonymous,
      status: f.status,
      startDate: f.startDate,
      endDate: f.endDate,
      retentionDays: f.retentionDays,
      createdAt: f.createdAt,
      questions: (f.questions || [])
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((q) => ({ id: q.publicId, text: q.text, type: q.type, required: q.required, options: q.options })),
      ...extra,
    };
  }

  private buildQuestions(formId: number, questions: QuestionInput[]): SurveyFormQuestion[] {
    return (questions || []).map((q, i) => {
      if (!q.text?.trim()) throw new BadRequestException('Question text is required');
      if (!QUESTION_TYPES.includes(q.type)) throw new BadRequestException(`Invalid question type: ${q.type}`);
      return this.questionRepo.create({
        form: { id: formId } as any,
        orderIndex: i,
        text: q.text.trim(),
        type: q.type as any,
        required: q.required !== false,
        options: q.options ?? null,
      });
    });
  }

  // ---- Employer ----

  async create(
    userId: number,
    dto: {
      title?: string;
      description?: string;
      audience?: string;
      anonymous?: boolean;
      status?: string;
      startDate?: string;
      endDate?: string;
      retentionDays?: number | null;
      questions?: QuestionInput[];
    },
  ) {
    const employerId = await this.employerIdForUser(userId);
    if (!dto.title?.trim()) throw new BadRequestException('Title is required');
    if (!['WORKERS', 'CLIENTS'].includes(dto.audience || '')) throw new BadRequestException('Invalid audience');
    if (!dto.questions?.length) throw new BadRequestException('At least one question is required');

    const form = this.formRepo.create({
      employerId,
      title: dto.title.trim(),
      description: dto.description || null,
      audience: dto.audience as any,
      anonymous: dto.anonymous ?? (dto.audience === 'WORKERS'),
      status: ['draft', 'active', 'closed'].includes(dto.status || '') ? (dto.status as any) : 'draft',
      startDate: dto.startDate || null,
      endDate: dto.endDate || null,
      retentionDays: dto.retentionDays ?? null,
      createdByUserId: userId,
    });
    const saved = await this.formRepo.save(form);
    await this.questionRepo.save(this.buildQuestions(saved.id, dto.questions));
    if (saved.status === 'active') await this.notifyAudienceOfSurvey(saved);
    const full = await this.formRepo.findOne({ where: { id: saved.id }, relations: ['questions'] });
    return this.mapForm(full || saved, { responseCount: 0 });
  }

  async list(userId: number) {
    const employerId = await this.employerIdForUser(userId);
    const forms = await this.formRepo.find({ where: { employerId }, relations: ['questions'], order: { createdAt: 'DESC' } });
    const counts = await this.responseCounts(forms.map((f) => f.id));
    return forms.map((f) => this.mapForm(f, { responseCount: counts.get(f.id) ?? 0 }));
  }

  private async responseCounts(formIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!formIds.length) return map;
    const rows = await this.responseRepo
      .createQueryBuilder('r')
      .select('r.form_id', 'formId')
      .addSelect('COUNT(*)', 'cnt')
      .where('r.form_id IN (:...ids)', { ids: formIds })
      .groupBy('r.form_id')
      .getRawMany();
    rows.forEach((r) => map.set(Number(r.formId), Number(r.cnt)));
    return map;
  }

  async getOne(userId: number, publicId: string) {
    const employerId = await this.employerIdForUser(userId);
    const form = await this.formRepo.findOne({ where: { publicId, employerId }, relations: ['questions'] });
    if (!form) throw new NotFoundException('Survey not found');
    const counts = await this.responseCounts([form.id]);
    return this.mapForm(form, { responseCount: counts.get(form.id) ?? 0 });
  }

  async update(
    userId: number,
    publicId: string,
    dto: {
      title?: string;
      description?: string;
      audience?: string;
      anonymous?: boolean;
      status?: string;
      startDate?: string;
      endDate?: string;
      retentionDays?: number | null;
      questions?: QuestionInput[];
    },
  ) {
    const employerId = await this.employerIdForUser(userId);
    // Load WITHOUT the questions relation: touching form.questions here would make
    // TypeORM try to null out existing question FKs on save.
    const form = await this.formRepo.findOne({ where: { publicId, employerId } });
    if (!form) throw new NotFoundException('Survey not found');

    const hasResponses = (await this.responseCounts([form.id])).get(form.id) ?? 0;
    const wasActive = form.status === 'active';

    if (dto.title !== undefined) form.title = dto.title.trim();
    if (dto.description !== undefined) form.description = dto.description || null;
    if (dto.status !== undefined && ['draft', 'active', 'closed'].includes(dto.status)) form.status = dto.status as any;
    if (dto.startDate !== undefined) form.startDate = dto.startDate || null;
    if (dto.endDate !== undefined) form.endDate = dto.endDate || null;
    if (dto.retentionDays !== undefined) form.retentionDays = dto.retentionDays ?? null;
    // Audience / anonymity / questions can only change before any responses exist.
    let newQuestions: SurveyFormQuestion[] | null = null;
    if (!hasResponses) {
      if (dto.audience !== undefined && ['WORKERS', 'CLIENTS'].includes(dto.audience)) form.audience = dto.audience as any;
      if (dto.anonymous !== undefined) form.anonymous = dto.anonymous;
      if (dto.questions !== undefined) {
        await this.questionRepo.delete({ form: { id: form.id } });
        newQuestions = this.buildQuestions(form.id, dto.questions);
      }
    }
    const saved = await this.formRepo.save(form);
    if (newQuestions) await this.questionRepo.save(newQuestions);

    // Notify the audience when a survey is published (goes active).
    if (saved.status === 'active' && !wasActive) {
      await this.notifyAudienceOfSurvey(saved);
    }

    const full = await this.formRepo.findOne({ where: { id: saved.id }, relations: ['questions'] });
    return this.mapForm(full || saved, { responseCount: hasResponses });
  }

  async remove(userId: number, publicId: string) {
    const employerId = await this.employerIdForUser(userId);
    const form = await this.formRepo.findOne({ where: { publicId, employerId } });
    if (!form) throw new NotFoundException('Survey not found');
    await this.submissionRepo.delete({ formId: form.id });
    await this.formRepo.remove(form); // cascades questions/responses/answers
    return { ok: true };
  }

  async results(userId: number, publicId: string) {
    const employerId = await this.employerIdForUser(userId);
    const form = await this.formRepo.findOne({ where: { publicId, employerId }, relations: ['questions'] });
    if (!form) throw new NotFoundException('Survey not found');
    const responses = await this.responseRepo.find({ where: { form: { id: form.id } }, relations: ['answers'], order: { submittedAt: 'DESC' } });

    const questions = (form.questions || [])
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => {
        const answers = responses.flatMap((r) => (r.answers || []).filter((a) => a.questionId === q.id));
        return { id: q.publicId, text: q.text, type: q.type, ...this.aggregate(q.type, q.options, answers) };
      });

    return {
      form: this.mapForm(form),
      total: responses.length,
      anonymous: form.anonymous,
      questions,
      // Individual responses only for non-anonymous surveys.
      responses: form.anonymous
        ? []
        : responses.map((r) => ({
            id: r.publicId,
            submittedAt: r.submittedAt,
            answers: (r.answers || []).map((a) => ({ questionId: a.questionId, questionText: a.questionText, type: a.questionType, value: this.answerValue(a) })),
          })),
    };
  }

  private answerValue(a: SurveyFormAnswer): any {
    if (a.valueNumber != null) return a.valueNumber;
    if (a.valueBool != null) return a.valueBool;
    if (a.valueChoices != null) return a.valueChoices;
    return a.valueText;
  }

  private aggregate(type: string, options: any, answers: SurveyFormAnswer[]) {
    const count = answers.length;
    if (type === 'rating') {
      const nums = answers.map((a) => a.valueNumber).filter((n): n is number => n != null);
      const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
      const distribution: Record<number, number> = {};
      nums.forEach((n) => (distribution[n] = (distribution[n] || 0) + 1));
      return { count, average: Math.round(avg * 100) / 100, distribution };
    }
    if (type === 'yes_no') {
      const yes = answers.filter((a) => a.valueBool === true).length;
      const no = answers.filter((a) => a.valueBool === false).length;
      return { count, yes, no };
    }
    if (type === 'single_choice' || type === 'multi_choice') {
      const tally: Record<string, number> = {};
      (Array.isArray(options) ? options : []).forEach((o: string) => (tally[o] = 0));
      answers.forEach((a) => {
        const chosen: string[] = Array.isArray(a.valueChoices) ? a.valueChoices : a.valueText ? [a.valueText] : [];
        chosen.forEach((c) => (tally[c] = (tally[c] || 0) + 1));
      });
      return { count, tally };
    }
    // text
    return { count, texts: answers.map((a) => a.valueText).filter(Boolean) };
  }

  // ---- Worker / Client ----

  async listMine(userId: number) {
    const who = await this.resolveRespondent(userId);
    const audience = who.role === 'WORKER' ? 'WORKERS' : 'CLIENTS';
    const forms = await this.formRepo.find({
      where: { employerId: who.employerId, audience: audience as any, status: 'active' },
      relations: ['questions'],
      order: { createdAt: 'DESC' },
    });
    const today = this.today();
    const active = forms.filter((f) => (!f.startDate || f.startDate <= today) && (!f.endDate || f.endDate >= today));
    const subs = active.length
      ? await this.submissionRepo.find({ where: { userId, formId: In(active.map((f) => f.id)) } })
      : [];
    const filled = new Set(subs.map((s) => s.formId));
    return active.map((f) => this.mapForm(f, { filled: filled.has(f.id) }));
  }

  // A respondent's own submitted answers (only for non-anonymous surveys).
  async myResponse(userId: number, publicId: string) {
    const form = await this.formRepo.findOne({ where: { publicId }, relations: ['questions'] });
    if (!form) throw new NotFoundException('Survey not found');
    if (form.anonymous) return { anonymous: true, title: form.title, answers: [] };
    const resp = await this.responseRepo.findOne({
      where: { form: { id: form.id }, respondentUserId: userId },
      relations: ['answers'],
      order: { submittedAt: 'DESC' },
    });
    if (!resp) return { anonymous: false, title: form.title, answers: [] };
    const order = new Map((form.questions || []).map((q) => [q.id, q.orderIndex]));
    const answers = (resp.answers || [])
      .sort((a, b) => (order.get(a.questionId) ?? 0) - (order.get(b.questionId) ?? 0))
      .map((a) => ({ questionText: a.questionText, type: a.questionType, value: this.answerValue(a) }));
    return { anonymous: false, title: form.title, submittedAt: resp.submittedAt, answers };
  }

  async submit(userId: number, publicId: string, body: { answers?: any[] }) {
    const form = await this.formRepo.findOne({ where: { publicId }, relations: ['questions'] });
    if (!form) throw new NotFoundException('Survey not found');
    if (form.status !== 'active') throw new BadRequestException('Survey is not active');

    const who = await this.resolveRespondent(userId);
    const expectedRole = form.audience === 'WORKERS' ? 'WORKER' : 'CLIENT';
    if (who.role !== expectedRole || who.employerId !== form.employerId) {
      throw new ForbiddenException('This survey is not addressed to you');
    }

    const already = await this.submissionRepo.findOne({ where: { formId: form.id, userId } });
    if (already) throw new BadRequestException('You have already answered this survey');

    const byId = new Map((form.questions || []).map((q) => [q.publicId, q]));
    const answers: SurveyFormAnswer[] = [];
    for (const q of form.questions || []) {
      const raw = (body.answers || []).find((a) => a?.questionId === q.publicId);
      const provided = raw && raw.value !== undefined && raw.value !== null && raw.value !== '';
      if (q.required && !provided) throw new BadRequestException(`Missing answer for: ${q.text}`);
      if (!provided) continue;
      answers.push(this.mapAnswer(q, raw.value));
    }
    void byId;

    const response = this.responseRepo.create({
      form: { id: form.id } as any,
      respondentUserId: form.anonymous ? null : userId,
      respondentRole: who.role,
    });
    const savedResponse = await this.responseRepo.save(response);
    if (answers.length) {
      answers.forEach((a) => (a.response = { id: savedResponse.id } as any));
      await this.answerRepo.save(answers);
    }
    await this.submissionRepo.save(this.submissionRepo.create({ formId: form.id, userId }));
    return { ok: true };
  }

  private mapAnswer(q: SurveyFormQuestion, value: any): SurveyFormAnswer {
    const a = new SurveyFormAnswer();
    a.questionId = q.id;
    a.questionText = q.text;
    a.questionType = q.type;
    a.valueNumber = null;
    a.valueBool = null;
    a.valueText = null;
    a.valueChoices = null;
    if (q.type === 'rating') a.valueNumber = Number(value);
    else if (q.type === 'yes_no') a.valueBool = value === true || value === 'yes' || value === 'true';
    else if (q.type === 'multi_choice') a.valueChoices = Array.isArray(value) ? value : [value];
    else if (q.type === 'single_choice') a.valueChoices = [String(value)];
    else a.valueText = String(value);
    return a;
  }
}
