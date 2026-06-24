import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // Any authenticated user can submit a help request.
  @Post('tickets')
  createTicket(@Request() req, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(req.user, dto);
  }

  @Get('tickets')
  @Roles(UserRole.Admin)
  listTickets() {
    return this.supportService.listTickets();
  }

  @Post('suggestions')
  createSuggestion(@Request() req, @Body() dto: CreateSuggestionDto) {
    return this.supportService.createSuggestion(req.user, dto);
  }

  @Get('suggestions')
  @Roles(UserRole.Admin)
  listSuggestions() {
    return this.supportService.listSuggestions();
  }
}
