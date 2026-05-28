import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserRole, KycStatus } from './entities/user.entity';
import { Repository } from 'typeorm';
import { DeepPartial } from 'typeorm';

import { AgentProfile } from './entities/agent-profile.entity';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';

import { EmailService } from '../notifications/email/email.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
    private emailService: EmailService,
  ) { }



  async create(userData: DeepPartial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: ['agentProfile'] });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id }, relations: ['agentProfile'] });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: ['agentProfile'] });
  }


  async update(id: string, updateData: DeepPartial<User>): Promise<User | null> {
    await this.usersRepository.update(id, updateData);
    return this.usersRepository.findOne({ where: { id }, relations: ['agentProfile'] });
  }

  async updateAgentProfile(userId: string, data: Partial<AgentProfile>): Promise<AgentProfile | null> {
    let profile = await this.agentProfileRepository.findOne({ where: { user: { id: userId } } });
    if (!profile) {
      profile = this.agentProfileRepository.create({ user: { id: userId } as User });
    }
    Object.assign(profile, data);
    return this.agentProfileRepository.save(profile);
  }

  async findPendingAgents() {
    return this.usersRepository.find({
      where: { role: UserRole.AGENT, kyc_status: KycStatus.PENDING },
      relations: ['agentProfile'],
    });
  }

  async verifyAgent(id: string, status: KycStatus): Promise<User> {
    const user = await this.findOne(id);
    if (!user) throw new Error('User not found');

    user.kyc_status = status;
    const savedUser = await this.usersRepository.save(user);

    // Send Notification
    if (user.email) {
      let subject = 'Agent Application Status Update';
      let body = `Your agent application status has been updated to: ${status}.`;

      if (status === KycStatus.VERIFIED) {
        subject = 'Welcome to Nzubia Global - Agent Approved!';
        body = 'Congratulations! Your agent application has been approved. You can now log in and start quoting on shipments.';
      } else if (status === KycStatus.REJECTED) {
        subject = 'Agent Application Update';
        body = 'We regret to inform you that your agent application has been rejected. Please contact support for more details.';
      }

      await this.emailService.sendEmail(user.email, subject, body);
    }

    return savedUser;
  }


  async submitOnboarding(user: any, dto: SubmitOnboardingDto) {
    // 1. Update/Create Agent Profile
    let profile = await this.agentProfileRepository.findOne({ where: { user: { id: user.id } } });
    if (!profile) {
      profile = this.agentProfileRepository.create({
        user: { id: user.id } as User, // Link by ID
      });
    }

    // Merge DTO fields into agentProfile
    const { tax_id, ...profileFields } = dto;
    Object.assign(profile, profileFields);
    await this.agentProfileRepository.save(profile);

    // 2. Update User Entity (Tax ID, KYC Status)
    const updatePayload: DeepPartial<User> = {
      kyc_status: KycStatus.PENDING,
    };
    if (tax_id) updatePayload.tax_id = tax_id;

    await this.usersRepository.update(user.id, updatePayload);

    return { success: true, message: 'Onboarding submitted' };
  }


}
