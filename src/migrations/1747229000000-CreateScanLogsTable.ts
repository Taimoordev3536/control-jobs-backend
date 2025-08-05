import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateScanLogsTable1747229000000 implements MigrationInterface {
  name = 'CreateScanLogsTable1747229000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'scan_logs',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'job_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'worker_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'scanType',
            type: 'varchar',
            length: '50',
            default: "'check-in'",
          },
          {
            name: 'location',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'scan_time',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'scan_logs',
      new TableIndex({ name: 'IDX_SCAN_LOGS_JOB_ID', columnNames: ['job_id'] }),
    );

    await queryRunner.createIndex(
      'scan_logs',
      new TableIndex({ name: 'IDX_SCAN_LOGS_WORKER_ID', columnNames: ['worker_id'] }),
    );

    await queryRunner.createIndex(
      'scan_logs',
      new TableIndex({ name: 'IDX_SCAN_LOGS_SCAN_TIME', columnNames: ['scan_time'] }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'scan_logs',
      new TableForeignKey({
        columnNames: ['job_id'],
        referencedTableName: 'job',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_SCAN_LOGS_JOB',
      }),
    );

    await queryRunner.createForeignKey(
      'scan_logs',
      new TableForeignKey({
        columnNames: ['worker_id'],
        referencedTableName: 'workers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_SCAN_LOGS_WORKER',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('scan_logs', 'FK_SCAN_LOGS_WORKER');
    await queryRunner.dropForeignKey('scan_logs', 'FK_SCAN_LOGS_JOB');
    await queryRunner.dropIndex('scan_logs', 'IDX_SCAN_LOGS_SCAN_TIME');
    await queryRunner.dropIndex('scan_logs', 'IDX_SCAN_LOGS_WORKER_ID');
    await queryRunner.dropIndex('scan_logs', 'IDX_SCAN_LOGS_JOB_ID');
    await queryRunner.dropTable('scan_logs');
  }
}
