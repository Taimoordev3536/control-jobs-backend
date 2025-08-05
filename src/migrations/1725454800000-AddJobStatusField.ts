import { DataSource } from 'typeorm';

export class AddJobStatusField1725454800000 {
    public async up(dataSource: DataSource): Promise<void> {
        await dataSource.query(`
            ALTER TABLE job 
            ADD COLUMN status ENUM('scheduled', 'pending', 'in_progress', 'completed', 'cancelled', 'on_hold') 
            DEFAULT 'scheduled'
        `);
    }

    public async down(dataSource: DataSource): Promise<void> {
        await dataSource.query(`
            ALTER TABLE job DROP COLUMN status
        `);
    }
}
