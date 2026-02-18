import pkg from 'pg';
const { Pool } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'server', '.env.production') });

async function testConnection() {
    console.log('--- Database Connection Test (ESM) ---');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    console.log('URL:', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Successfully connected to Supabase PostgreSQL!');

        const res = await client.query('SELECT COUNT(*) FROM users');
        console.log('✅ Users table check:', res.rows[0].count, 'users found.');

        const users = await client.query('SELECT id, email, role FROM users');
        console.log('Users in DB:', users.rows);

        client.release();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
    } finally {
        await pool.end();
    }
}

testConnection();
