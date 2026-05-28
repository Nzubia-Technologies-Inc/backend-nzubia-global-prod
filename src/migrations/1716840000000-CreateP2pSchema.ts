import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateP2pSchema1716840000000 implements MigrationInterface {
    name = 'CreateP2pSchema1716840000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_courier_profiles\` (
                \`id\` varchar(36) NOT NULL,
                \`user_id\` varchar(36) NOT NULL,
                \`verificationState\` enum('DRAFT','SUBMITTED','PENDING_REVIEW','APPROVED','ACTIVE','SUSPENDED','REJECTED') NOT NULL DEFAULT 'DRAFT',
                \`rating\` decimal(3,2) NOT NULL DEFAULT 0.00,
                \`isActive\` tinyint(1) NOT NULL DEFAULT 0,
                \`homeLatitude\` decimal(10,7) NULL,
                \`homeLongitude\` decimal(10,7) NULL,
                \`serviceRadiusKm\` decimal(6,2) NULL,
                \`acceptedCategories\` json NULL,
                \`payoutReady\` tinyint(1) NOT NULL DEFAULT 0,
                \`reputationSummary\` text NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_courier_profiles_user_id\` (\`user_id\`),
                CONSTRAINT \`FK_p2p_courier_profiles_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_routes\` (
                \`id\` varchar(36) NOT NULL,
                \`courier_profile_id\` varchar(36) NOT NULL,
                \`destinationCountry\` varchar(255) NOT NULL,
                \`destinationCity\` varchar(255) NOT NULL,
                \`departureDate\` date NOT NULL,
                \`returnDate\` date NULL,
                \`pickupOrigin\` text NOT NULL,
                \`pickupLatitude\` decimal(10,7) NULL,
                \`pickupLongitude\` decimal(10,7) NULL,
                \`currentLatitude\` decimal(10,7) NULL,
                \`currentLongitude\` decimal(10,7) NULL,
                \`capacityKg\` decimal(6,2) NOT NULL,
                \`acceptedItemCategories\` json NULL,
                \`routeNotes\` text NULL,
                \`status\` enum('DRAFT','PUBLISHED','PAUSED','EXPIRED','REMOVED') NOT NULL DEFAULT 'DRAFT',
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_routes_courier_profile_id\` (\`courier_profile_id\`),
                KEY \`IDX_p2p_routes_status_departureDate\` (\`status\`, \`departureDate\`),
                CONSTRAINT \`FK_p2p_routes_courier_profile_id\` FOREIGN KEY (\`courier_profile_id\`) REFERENCES \`p2p_courier_profiles\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_shipment_requests\` (
                \`id\` varchar(36) NOT NULL,
                \`seeker_user_id\` varchar(36) NOT NULL,
                \`originAddress\` text NOT NULL,
                \`originLatitude\` decimal(10,7) NULL,
                \`originLongitude\` decimal(10,7) NULL,
                \`destinationCountry\` varchar(255) NOT NULL,
                \`destinationCity\` varchar(255) NOT NULL,
                \`itemCategory\` enum('DOCUMENTS','CLOTHING','ELECTRONICS','ACCESSORIES','FOOD','MEDICINE','OTHER') NOT NULL,
                \`itemDescription\` text NOT NULL,
                \`dimensionsCm\` json NULL,
                \`weightKg\` decimal(6,2) NOT NULL,
                \`declaredValueUsd\` decimal(10,2) NOT NULL,
                \`photoUrls\` json NULL,
                \`status\` enum('DRAFT','OPEN','MATCHED','RESERVED','HANDOFF_PENDING','IN_TRANSIT','DELIVERED','COMPLETED','CANCELLED','DISPUTED','REJECTED') NOT NULL DEFAULT 'DRAFT',
                \`matchMetadata\` json NULL,
                \`chatThreadId\` varchar(255) NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_shipment_requests_seeker_user_id\` (\`seeker_user_id\`),
                KEY \`IDX_p2p_shipment_requests_status_destination\` (\`status\`, \`destinationCountry\`, \`destinationCity\`),
                CONSTRAINT \`FK_p2p_shipment_requests_seeker_user_id\` FOREIGN KEY (\`seeker_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_offers\` (
                \`id\` varchar(36) NOT NULL,
                \`shipment_request_id\` varchar(36) NOT NULL,
                \`route_id\` varchar(36) NOT NULL,
                \`offerAmountUsd\` decimal(10,2) NULL,
                \`status\` enum('PROPOSED','ACCEPTED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PROPOSED',
                \`acceptedAt\` timestamp NULL DEFAULT NULL,
                \`rejectedAt\` timestamp NULL DEFAULT NULL,
                \`expiresAt\` timestamp NULL DEFAULT NULL,
                \`paymentReference\` varchar(255) NULL,
                \`paymentStatus\` varchar(50) NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_offers_shipment_request_id\` (\`shipment_request_id\`),
                KEY \`IDX_p2p_offers_route_id\` (\`route_id\`),
                CONSTRAINT \`FK_p2p_offers_shipment_request_id\` FOREIGN KEY (\`shipment_request_id\`) REFERENCES \`p2p_shipment_requests\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT \`FK_p2p_offers_route_id\` FOREIGN KEY (\`route_id\`) REFERENCES \`p2p_routes\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_reviews\` (
                \`id\` varchar(36) NOT NULL,
                \`reviewerUserId\` varchar(36) NOT NULL,
                \`reviewedUserId\` varchar(36) NOT NULL,
                \`shipmentRequestId\` varchar(36) NOT NULL,
                \`rating\` int NOT NULL,
                \`comment\` text NULL,
                \`trustFlags\` json NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_reviews_reviewerUserId\` (\`reviewerUserId\`),
                KEY \`IDX_p2p_reviews_reviewedUserId\` (\`reviewedUserId\`),
                KEY \`IDX_p2p_reviews_shipmentRequestId\` (\`shipmentRequestId\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_waivers\` (
                \`id\` varchar(36) NOT NULL,
                \`shipment_request_id\` varchar(36) NOT NULL,
                \`signed_by_user_id\` varchar(36) NOT NULL,
                \`termsVersion\` varchar(255) NOT NULL,
                \`acknowledgedFlags\` json NOT NULL,
                \`proofMetadata\` json NULL,
                \`status\` enum('PENDING','ACCEPTED','DECLINED','EXPIRED') NOT NULL DEFAULT 'PENDING',
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_waivers_shipment_request_id\` (\`shipment_request_id\`),
                KEY \`IDX_p2p_waivers_signed_by_user_id\` (\`signed_by_user_id\`),
                CONSTRAINT \`FK_p2p_waivers_shipment_request_id\` FOREIGN KEY (\`shipment_request_id\`) REFERENCES \`p2p_shipment_requests\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT \`FK_p2p_waivers_signed_by_user_id\` FOREIGN KEY (\`signed_by_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_compliance_records\` (
                \`id\` varchar(36) NOT NULL,
                \`shipment_request_id\` varchar(36) NOT NULL,
                \`prohibitedItemDetected\` tinyint(1) NOT NULL DEFAULT 0,
                \`restrictedCategoryFlags\` json NULL,
                \`manualReviewRequired\` tinyint(1) NOT NULL DEFAULT 0,
                \`rejectionReason\` text NULL,
                \`reviewedAt\` timestamp NULL DEFAULT NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_compliance_records_shipment_request_id\` (\`shipment_request_id\`),
                CONSTRAINT \`FK_p2p_compliance_records_shipment_request_id\` FOREIGN KEY (\`shipment_request_id\`) REFERENCES \`p2p_shipment_requests\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_compliance_records`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_waivers`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_reviews`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_offers`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_shipment_requests`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_routes`');
        await queryRunner.query('DROP TABLE IF EXISTS `p2p_courier_profiles`');
    }
}