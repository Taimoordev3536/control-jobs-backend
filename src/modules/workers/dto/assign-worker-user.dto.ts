import { IsNumber } from 'class-validator';

export class AssignWorkerUserDto {
  @IsNumber()
  workerId: number;

  @IsNumber()
  userId: number;
}
