import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddPartnerTierForeignKey1747228668001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createForeignKey(
            'cjobs_partners',
            new TableForeignKey({
                columnNames: ['partner_tier_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'cjobs_tipospartner',
                onDelete: 'RESTRICT',
                name: 'FK_partners_partner_tier'
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('cjobs_partners');
        const foreignKey = table.foreignKeys.find(fk => fk.name === 'FK_partners_partner_tier');
        if (foreignKey) {
            await queryRunner.dropForeignKey('cjobs_partners', foreignKey);
        }
    }
} 