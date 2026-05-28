import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShipmentLifecycleFields1748500000000 implements MigrationInterface {
    name = 'AddShipmentLifecycleFields1748500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`p2p_shipment_requests\`
                ADD COLUMN \`pickupConfirmationCode\` varchar(10) NULL,
                ADD COLUMN \`proofOfDeliveryUrls\` json NULL,
                ADD COLUMN \`deliveredAt\` timestamp NULL,
                ADD COLUMN \`completedAt\` timestamp NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`p2p_shipment_requests\`
                DROP COLUMN \`completedAt\`,
                DROP COLUMN \`deliveredAt\`,
                DROP COLUMN \`proofOfDeliveryUrls\`,
                DROP COLUMN \`pickupConfirmationCode\`
        `);
    }
}
