import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAgentProfileFields1748390000000 implements MigrationInterface {
    name = 'AddAgentProfileFields1748390000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableName = 'agent_profiles';
        const columns = [
            new TableColumn({ name: 'agent_type', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'address', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'id_type', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'id_number', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'id_document_url', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'selfie_url', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'service_radius_km', type: 'int', isNullable: true }),
            new TableColumn({
                name: 'rating',
                type: 'decimal',
                precision: 3,
                scale: 2,
                isNullable: true,
                default: 0.00,
            }),
            new TableColumn({ name: 'rating_count', type: 'int', isNullable: true, default: 0 }),
            new TableColumn({ name: 'orders_fulfilled', type: 'int', isNullable: true, default: 0 }),
            new TableColumn({ name: 'preferred_payout_method', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'zelle_email', type: 'varchar', isNullable: true }),
            new TableColumn({ name: 'zelle_phone', type: 'varchar', isNullable: true }),
        ];

        for (const column of columns) {
            const exists = await queryRunner.hasColumn(tableName, column.name);
            if (!exists) {
                await queryRunner.addColumn(tableName, column);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tableName = 'agent_profiles';
        const columnNames = [
            'agent_type',
            'address',
            'id_type',
            'id_number',
            'id_document_url',
            'selfie_url',
            'service_radius_km',
            'rating',
            'rating_count',
            'orders_fulfilled',
            'preferred_payout_method',
            'zelle_email',
            'zelle_phone',
        ];

        for (const columnName of columnNames) {
            const exists = await queryRunner.hasColumn(tableName, columnName);
            if (exists) {
                await queryRunner.dropColumn(tableName, columnName);
            }
        }
    }
}
