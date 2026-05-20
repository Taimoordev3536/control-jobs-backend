import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { MAX_ATTACHMENTS_PER_MESSAGE } from '../chat.constants';
import { ChatService } from '../services/chat.service';
import { CreateDirectConversationDto } from '../dto/create-direct-conversation.dto';
import { CreateGroupConversationDto } from '../dto/create-group-conversation.dto';
import { UpdateGroupNameDto } from '../dto/update-group-name.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { EditMessageDto } from '../dto/edit-message.dto';
import { MarkReadDto } from '../dto/mark-read.dto';
import { SearchMessagesDto } from '../dto/search-messages.dto';
import { ReactMessageDto } from '../dto/react-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('me')
  async getMyScope(@Req() req: any) {
    const data = await this.chatService.getMyScope(req.user);
    return { data, isSuccess: true };
  }

  @Get('conversations')
  async listConversations(@Req() req: any) {
    const data = await this.chatService.listConversations(req.user);
    return { data, isSuccess: true };
  }

  @Get('conversations/:publicId/messages')
  async listMessages(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.max(1, parseInt(limit, 10) || 0) : undefined;
    const data = await this.chatService.getMessages(req.user, publicId, before, parsedLimit);
    return { data, isSuccess: true };
  }

  @Post('conversations/direct')
  async createDirect(@Req() req: any, @Body() dto: CreateDirectConversationDto) {
    const data = await this.chatService.createDirect(req.user, dto.targetType, dto.targetEntityPublicId);
    return { data, isSuccess: true };
  }

  @Post('conversations/group')
  async createGroup(@Req() req: any, @Body() dto: CreateGroupConversationDto) {
    const data = await this.chatService.createGroup(
      req.user,
      dto.employerPublicId,
      dto.clientPublicId,
      dto.workerPublicId,
      dto.adminPublicId,
      dto.name,
      dto.partnerPublicId,
    );
    return { data, isSuccess: true };
  }

  @Patch('conversations/:publicId/name')
  async renameGroup(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: UpdateGroupNameDto,
  ) {
    const data = await this.chatService.renameGroup(req.user, publicId, dto.name);
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/image')
  @UseInterceptors(FileInterceptor('file'))
  async setGroupImage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.chatService.setGroupImage(req.user, publicId, file);
    return { data, isSuccess: true };
  }

  @Delete('conversations/:publicId/image')
  async deleteGroupImage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
  ) {
    const data = await this.chatService.deleteGroupImage(req.user, publicId);
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/messages')
  async sendMessage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.chatService.sendMessage(
      req.user,
      publicId,
      dto.body,
      dto.repliedToMessagePublicId,
    );
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/messages/upload')
  @UseInterceptors(FilesInterceptor('files', MAX_ATTACHMENTS_PER_MESSAGE))
  async sendMessageWithAttachments(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('body') body?: string,
    @Body('repliedToMessagePublicId') repliedToMessagePublicId?: string,
  ) {
    const data = await this.chatService.sendMessageWithAttachments(
      req.user,
      publicId,
      files,
      body,
      repliedToMessagePublicId,
    );
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/messages/:messageId/pin')
  async pinMessage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const data = await this.chatService.setPinned(req.user, publicId, messageId, true);
    return { data, isSuccess: true };
  }

  @Delete('conversations/:publicId/messages/:messageId/pin')
  async unpinMessage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const data = await this.chatService.setPinned(req.user, publicId, messageId, false);
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/messages/:messageId/reactions')
  async addReaction(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    const data = await this.chatService.setReaction(req.user, publicId, messageId, dto.emoji, 'add');
    return { data, isSuccess: true };
  }

  @Delete('conversations/:publicId/messages/:messageId/reactions')
  async removeReaction(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    const data = await this.chatService.setReaction(req.user, publicId, messageId, dto.emoji, 'remove');
    return { data, isSuccess: true };
  }

  @Get('conversations/:publicId/pinned')
  async listPinned(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
  ) {
    const data = await this.chatService.listPinned(req.user, publicId);
    return { data, isSuccess: true };
  }

  @Patch('conversations/:publicId/messages/:messageId')
  async editMessage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    const data = await this.chatService.editMessage(req.user, publicId, messageId, dto.body);
    return { data, isSuccess: true };
  }

  @Delete('conversations/:publicId/messages/:messageId')
  async deleteMessage(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    const data = await this.chatService.deleteMessage(req.user, publicId, messageId);
    return { data, isSuccess: true };
  }

  @Post('conversations/:publicId/read')
  async markRead(
    @Req() req: any,
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Body() dto: MarkReadDto,
  ) {
    const data = await this.chatService.markRead(req.user, publicId, dto.upToMessagePublicId);
    return { data, isSuccess: true };
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const data = await this.chatService.getUnreadCount(req.user);
    return { data, isSuccess: true };
  }

  @Get('contacts')
  async contacts(@Req() req: any) {
    const data = await this.chatService.getContacts(req.user);
    return { data, isSuccess: true };
  }

  @Get('search')
  async search(@Req() req: any, @Query() query: SearchMessagesDto) {
    const data = await this.chatService.searchMessages(req.user, query.q, query.conversationPublicId);
    return { data, isSuccess: true };
  }
}
