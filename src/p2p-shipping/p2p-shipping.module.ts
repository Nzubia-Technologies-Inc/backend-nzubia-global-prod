import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { P2pCourierProfile } from './entities/p2p-courier-profile.entity';
import { P2pRoute } from './entities/p2p-route.entity';
import { P2pShipmentRequest } from './entities/p2p-shipment-request.entity';
import { P2pOffer } from './entities/p2p-offer.entity';
import { P2pWaiver } from './entities/p2p-waiver.entity';
import { P2pReview } from './entities/p2p-review.entity';
import { P2pComplianceRecord } from './entities/p2p-compliance-record.entity';
import { P2pCourierRequest } from './entities/p2p-courier-request.entity';

// Services
import { CourierService } from './courier.service';
import { RouteService } from './route.service';
import { ShipmentService } from './shipment.service';
import { ComplianceService } from './compliance.service';
import { ReviewService } from './review.service';
import { WaiverService } from './waiver.service';

// Controllers
import { CourierController } from './courier.controller';
import { RouteController } from './route.controller';
import { ShipmentController } from './shipment.controller';
import { ComplianceController } from './compliance.controller';
import { ReviewController } from './review.controller';
import { WaiverController } from './waiver.controller';

// External modules
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PaymentsModule } from '../payments/payments.module';
import { DocumentsModule } from '../documents/documents.module';
// PlatformSettingsModule is @Global() — no explicit import needed

@Module({
    imports: [
        TypeOrmModule.forFeature([
            P2pCourierProfile,
            P2pRoute,
            P2pShipmentRequest,
            P2pOffer,
            P2pWaiver,
            P2pReview,
            P2pComplianceRecord,
            P2pCourierRequest,
        ]),
        NotificationsModule,  // provides EmailService, SmsService
        MessagingModule,      // provides MessagingService
        PaymentsModule,       // provides PaymentsService
        DocumentsModule,      // provides DocumentsService
    ],
    controllers: [
        CourierController,
        RouteController,
        ShipmentController,
        ComplianceController,
        ReviewController,
        WaiverController,
    ],
    providers: [
        CourierService,
        RouteService,
        ShipmentService,
        ComplianceService,
        ReviewService,
        WaiverService,
    ],
    exports: [
        CourierService,
        RouteService,
        ShipmentService,
        ComplianceService,
        ReviewService,
        WaiverService,
    ],
})
export class P2pShippingModule { }
