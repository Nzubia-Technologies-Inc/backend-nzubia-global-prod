import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';

@Injectable()
export class MessagingService {
    constructor(
        @InjectRepository(Message)
        private messageRepo: Repository<Message>,
    ) { }

    async getRooms(userId: string) {
        // Find unique room_ids where user is sender or (implicitly) receiver if we had that field.
        // For now, let's just return all distinct rooms the user has participated in as sender.
        // Or if rooms are public/global context, just list distinct room_ids.
        // Assuming simple chat logic:
        const rooms = await this.messageRepo
            .createQueryBuilder('message')
            .select('DISTINCT message.room_id', 'room_id')
            .where('message.sender_id = :userId', { userId })
            .getRawMany();

        return rooms.map(r => ({ id: r.room_id, name: `Room ${r.room_id}` }));
    }

    async getMessages(roomId: string) {
        return this.messageRepo.find({
            where: { room_id: roomId },
            order: { created_at: 'ASC' },
            relations: ['sender'],
        });
    }

    async createMessage(roomId: string, senderId: string, content: string) {
        const msg = this.messageRepo.create({
            room_id: roomId,
            sender_id: senderId,
            content,
        });
        return this.messageRepo.save(msg);
    }
}
