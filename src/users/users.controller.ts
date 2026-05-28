import { Body, Controller, Post, HttpCode, HttpStatus, Get, Param, Patch, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SubmitOnboardingDto } from './dto/submit-onboarding.dto';
import { AuthGuard } from '@nestjs/passport';

import { UpdateUserDto } from './dto/update-user.dto';
import { KycStatus } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // ── Authenticated profile routes (must precede @Get(':id') to avoid shadowing) ──

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getMyProfile(@Request() req) {
    const user = await this.usersService.findOne(req.user.id);
    if (!user) return null;
    const { password_hash, otp_code, otp_expires_at, ...safeUser } = user as any;
    return safeUser;
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateMyProfile(
    @Request() req,
    @Body() body: { fullName?: string; phone?: string; profile_image_url?: string },
  ) {
    const updates: Partial<{ full_name: string; phone: string; profile_image_url: string }> = {};
    if (body.fullName !== undefined) updates.full_name = body.fullName;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.profile_image_url !== undefined) updates.profile_image_url = body.profile_image_url;
    const user = await this.usersService.update(req.user.id, updates as any);
    if (!user) return null;
    const { password_hash, otp_code, otp_expires_at, ...safeUser } = user as any;
    return safeUser;
  }

  @Patch('agent/profile')
  @UseGuards(AuthGuard('jwt'))
  async updateAgentProfile(
    @Request() req,
    @Body() body: {
      preferred_payout_method?: string;
      zelle_email?: string;
      zelle_phone?: string;
      company_name?: string;
    },
  ) {
    return this.usersService.updateAgentProfile(req.user.id, body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post('agent/onboarding')
  @UseGuards(AuthGuard('jwt'))
  async submitOnboarding(@Body() dto: SubmitOnboardingDto, @Request() req) {
    return this.usersService.submitOnboarding(req.user, dto);
  }

  // Admin Routes

  @Get('admin/pending-agents')
  // @Roles(UserRole.ADMIN) // Implement Roles Guard later
  async getPendingAgents() {
    return this.usersService.findPendingAgents();
  }

  @Patch('admin/verify/:id')
  async verifyAgent(
    @Param('id') id: string,
    @Body('status') status: KycStatus,
  ) {
    return this.usersService.verifyAgent(id, status);
  }
}
