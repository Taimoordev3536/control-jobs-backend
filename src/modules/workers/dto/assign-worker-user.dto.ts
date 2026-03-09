import { IsString } from 'class-validator';

export class AssignWorkerUserDto {
  @IsString()
  workerId: string;

  @IsString()
  userId: string;
}
