import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, VerifyOtpDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../notifications/email/email.service';
import { SmsService } from '../notifications/sms/sms.service';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private emailService: EmailService,
        private smsService: SmsService,
    ) { }

    async register(dto: RegisterDto): Promise<{ message: string; userId?: string }> {
        // Check if user exists
        let user = await this.usersService.findByEmail(dto.email);
        if (user && user.is_verified) {
            throw new BadRequestException('User already exists');
        }

        if (!user) {
            // Create new user
            const passwordHash = dto.password
                ? await bcrypt.hash(dto.password, 10)
                : null;
            user = await this.usersService.create({
                email: dto.email,
                phone: dto.phone,
                password_hash: passwordHash,
                role: dto.role,
            });
        }

        // Generate and Send OTP
        await this.generateAndSendOtp(user);
        return { message: 'OTP sent to email/phone', userId: user.id };
    }

    async verifyOtp(dto: VerifyOtpDto): Promise<{ user: User; accessToken: string }> {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) throw new UnauthorizedException('User not found');

        if (user.otp_code !== dto.otp) {
            throw new UnauthorizedException('Invalid OTP');
        }

        if (user.otp_expires_at && new Date() > user.otp_expires_at) {
            throw new UnauthorizedException('OTP Expired');
        }

        // Clear OTP and Verify
        await this.usersService.update(user.id, {
            otp_code: null,
            otp_expires_at: null,
            is_verified: true,
        });

        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            user,
            accessToken: this.jwtService.sign(payload),
        };
    }

    async googleLogin(googleUser: any) {
        if (!googleUser) throw new Error('No user from google');

        // Check if user exists by email
        let user = await this.usersService.findByEmail(googleUser.email);

        if (!user) {
            // Create new user (Role defaults to CUSTOMER, is_verified=true since it's Google)
            // We assume no password logic for this flow, or random password
            user = await this.usersService.create({
                email: googleUser.email,
                is_verified: true,
                role: 'CUSTOMER', // Default role for social signup
                // Optionally save google metadata like avatar in a profile if extended
            } as any);
        } else if (!user.is_verified) {
            // If user existed but wasn't verified, mark verified if emails match
            user = await this.usersService.update(user.id, { is_verified: true } as any);
        }

        if (!user) throw new Error('Failed to create/retrieve user'); // Should not happen

        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            accessToken: this.jwtService.sign(payload),
            user,
        };
    }

    async login(dto: LoginDto): Promise<{ accessToken: string } | { message: string }> {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) throw new UnauthorizedException('Invalid credentials');

        if (user.password_hash) {
            const isMatch = await bcrypt.compare(dto.password, user.password_hash);
            if (!isMatch) throw new UnauthorizedException('Invalid credentials');

            // If verified, return token
            if (user.is_verified) {
                const payload = { sub: user.id, email: user.email, role: user.role };
                return { accessToken: this.jwtService.sign(payload) };
            }
        }

        // If not verified or passwordless, trigger OTP
        await this.generateAndSendOtp(user);
        return { message: 'OTP required. Check your email/phone.' };
    }

    async forgotPassword(email: string) {
        const user = await this.usersService.findByEmail(email);
        if (!user) return; // Silent fail for security

        // Generate OTP/Token
        const otp = this.generateOtp();
        // Save to DB (reusing otp_code field for simplicity, or create separate reset_token)
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10);
        await this.usersService.update(user.id, { otp_code: otp, otp_expires_at: expiry } as any);

        // Send Email
        await this.emailService.sendEmail(
            user.email,
            'Password Reset Request',
            `Your password reset code is: ${otp}`
        );
    }

    async resetPassword(dto: ResetPasswordDto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) throw new BadRequestException('Invalid request');

        // Verify OTP
        if (user.otp_code !== dto.otp || !user.otp_expires_at || new Date() > user.otp_expires_at) {
            throw new BadRequestException('Invalid or expired code');
        }

        // Hash new password
        const salt = await bcrypt.genSalt();
        const hash = await bcrypt.hash(dto.newPassword, salt);

        // Update user: clean OTP and set new password
        await this.usersService.update(user.id, {
            password_hash: hash,
            otp_code: null,
            otp_expires_at: null,
        } as any);

        return { message: 'Password reset successfully' };
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.usersService.findOne(userId);
        if (!user || !user.password_hash) throw new BadRequestException('User not found or no password set');

        const isMatch = await bcrypt.compare(dto.oldPassword, user.password_hash);
        if (!isMatch) throw new UnauthorizedException('Incorrect old password');

        const salt = await bcrypt.genSalt();
        const hash = await bcrypt.hash(dto.newPassword, salt);

        await this.usersService.update(userId, { password_hash: hash } as any);
        return { message: 'Password changed successfully' };
    }

    // OTP Helper
    private generateOtp(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private async generateAndSendOtp(user: User) {
        const otp = this.generateOtp();
        const expiry = new Date();
        expiry.setMinutes(expiry.getMinutes() + 10); // 10 min expiry

        await this.usersService.update(user.id, {
            otp_code: otp,
            otp_expires_at: expiry,
        } as any);

        // Send Email
        if (user.email) {
            await this.emailService.sendEmail(user.email, 'Your OTP Code', `Your code is: ${otp}`);
        }

        // Send SMS (if phone exists)
        if (user.phone) {
            // await this.smsService.sendSms(user.phone, `Your code is: ${otp}`);
        }
    }
}
