import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load environment variables

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'controljobs',
    entities: ['src/**/*.entity.ts'],
    migrations: [
        'src/migrations/1747228667998-CreateUsersTable.ts',
        'src/migrations/1747228667999-CreatePartnersTable.ts',
        'src/migrations/1747228668000-CreateEmployersTable.ts',
        'src/migrations/1747228668000-CreatePartnerTiers.ts',
        'src/migrations/1747228668001-AddPartnerTierForeignKey.ts',
        'src/migrations/1747228668002-AddUserPartnerForeignKey.ts',
        'src/migrations/1747228668003-CreateRolesTable.ts',
        'src/migrations/1747228668004-CreatePartnerUsersTable.ts'
    ],
    synchronize: false,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
});

AppDataSource.initialize()
    .then(async () => {
        console.log('Running migrations...');
        await AppDataSource.runMigrations();
        console.log('Migrations completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error running migrations:', error);
        process.exit(1);
    }); 