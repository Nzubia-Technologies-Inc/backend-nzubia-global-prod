import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class MessagingController {
    constructor(private readonly messagingService: MessagingService) { }

    @Get('rooms')
    async getRooms(@Request() req) {
        return this.messagingService.getRooms(req.user.id);
    }

    @Get('rooms/:roomId/messages')
    async getMessages(@Param('roomId') roomId: string) {
        return this.messagingService.getMessages(roomId);
    }

    @Post('rooms/:roomId/messages')
    async sendMessage(
        @Param('roomId') roomId: string,
        @Body('content') content: string,
        @Request() req
    ) {
        return this.messagingService.createMessage(roomId, req.user.id, content);
    }
}
