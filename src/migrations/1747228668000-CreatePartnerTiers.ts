import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePartnerTiers1747228668000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'cjobs_tipospartner',
                columns: [
                    {
                        name: 'id',
                        type: 'serial',
                        isPrimary: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '50',
                        isUnique: true,
                    },
                    {
                        name: 'commissionPercentage',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                    },
                    {
                        name: 'retentionPercentage',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                    },
                ],
            }),
            true,
        );

        // Insert default partner tiers
        await queryRunner.query(`
            INSERT INTO cjobs_tipospartner (name, "commissionPercentage", "retentionPercentage")
            VALUES 
                ('Gold', 20.00, 5.00),
                ('Silver', 15.00, 7.50),
                ('Bronze', 10.00, 10.00),
                ('Affiliate', 5.00, 15.00)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('cjobs_tipospartner');
    }
} 