import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class ImpersonateDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['partner', 'employer', 'client', 'worker'])
  targetEntityType: string;

  @IsString()
  @IsNotEmpty()
  targetEntityPublicId: string;
}
