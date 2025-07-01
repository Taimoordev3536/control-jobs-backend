import { ConflictException } from '@nestjs/common';

export class DuplicateEmailException extends ConflictException {
    constructor(email: string) {
        super(`Email ${email} is already registered`);
    }
} 