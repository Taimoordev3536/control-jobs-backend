import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddUserPartnerForeignKey1747228668002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createForeignKey(
            'cjobs_user',
            new TableForeignKey({
                columnNames: ['partner_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'cjobs_partners',
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const userTable = await queryRunner.getTable('cjobs_user');
        const foreignKey = userTable.foreignKeys.find(fk => fk.columnNames.indexOf('partner_id') !== -1);
        if (foreignKey) {
            await queryRunner.dropForeignKey('cjobs_user', foreignKey);
        }
    }
} 