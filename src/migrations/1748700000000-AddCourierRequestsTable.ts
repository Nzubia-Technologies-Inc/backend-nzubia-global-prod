import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCourierRequestsTable1748700000000 implements MigrationInterface {
    name = 'AddCourierRequestsTable1748700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`p2p_courier_requests\` (
                \`id\` varchar(36) NOT NULL,
                \`shipment_request_id\` varchar(36) NOT NULL,
                \`route_id\` varchar(36) NOT NULL,
                \`seeker_user_id\` varchar(36) NOT NULL,
                \`message\` text NULL,
                \`status\` enum('PENDING','ACCEPTED','DECLINED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
                \`declineReason\` text NULL,
                \`respondedAt\` timestamp NULL,
                \`expiresAt\` timestamp NULL,
                \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`IDX_p2p_courier_requests_shipment_request_id\` (\`shipment_request_id\`),
                KEY \`IDX_p2p_courier_requests_route_id\` (\`route_id\`),
                KEY \`IDX_p2p_courier_requests_seeker_user_id\` (\`seeker_user_id\`),
                KEY \`IDX_p2p_courier_requests_status\` (\`status\`),
                CONSTRAINT \`FK_p2p_courier_requests_shipment_request_id\`
                    FOREIGN KEY (\`shipment_request_id\`) REFERENCES \`p2p_shipment_requests\` (\`id\`) ON DELETE CASCADE,
                CONSTRAINT \`FK_p2p_courier_requests_route_id\`
                    FOREIGN KEY (\`route_id\`) REFERENCES \`p2p_routes\` (\`id\`) ON DELETE CASCADE,
                CONSTRAINT \`FK_p2p_courier_requests_seeker_user_id\`
                    FOREIGN KEY (\`seeker_user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`p2p_courier_requests\``);
    }
}
