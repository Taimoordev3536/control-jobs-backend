export class VerifyOtpDto {
  phoneNumber!: string;
  otp!: number;
  intent!: 'register' | 'login';
}
