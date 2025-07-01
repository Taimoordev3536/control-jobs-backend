import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateEmployersTable1747228668000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'cjobs_employers',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'class',
                        type: 'enum',
                        enum: ['Particular', 'Autonomous', 'Company'],
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                    },
                    {
                        name: 'landline',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'mobile',
                        type: 'varchar',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                    },
                    {
                        name: 'nif',
                        type: 'varchar',
                    },
                    {
                        name: 'partner_id',
                        type: 'int',
                    },
                    {
                        name: 'fee',
                        type: 'enum',
                        enum: ['Home', 'Static', 'Remote'],
                    },
                    {
                        name: 'discount_percentage',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'payment_method',
                        type: 'enum',
                        enum: ['Card', 'PayPal'],
                    },
                    {
                        name: 'responsible',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'activation_status',
                        type: 'enum',
                        enum: ['Postpone', 'Request'],
                    },
                    {
                        name: 'probation_days',
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

        await queryRunner.createForeignKey(
            'cjobs_employers',
            new TableForeignKey({
                columnNames: ['partner_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'cjobs_partners',
                onDelete: 'CASCADE',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('cjobs_employers');
        const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('partner_id') !== -1);
        await queryRunner.dropForeignKey('cjobs_employers', foreignKey);
        await queryRunner.dropTable('cjobs_employers');
    }
} 