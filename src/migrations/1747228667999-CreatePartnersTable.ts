import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePartnersTable1747228667999 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'cjobs_partners',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                    },
                    {
                        name: 'address_street',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'address_floor_door',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'mobile',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'nif',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'type_of_partner',
                        type: 'enum',
                        enum: ['gold', 'silver', 'bronze', 'affiliate'],
                        isNullable: true,
                    },
                    {
                        name: 'commission',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'retention',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'payment_method',
                        type: 'enum',
                        enum: ['Transfer', 'Cash', 'PayPal', 'Others'],
                        isNullable: true,
                    },
                    {
                        name: 'account_iban',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'bic_swift',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'partner_tier_id',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('cjobs_partners');
    }
} 