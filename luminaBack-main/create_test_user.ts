import { Client } from 'pg';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to the database. Checking for users...');
    
    // Check if the users table exists and has rows
    const res = await client.query('SELECT id, email, first_name, role FROM users LIMIT 5');
    
    if (res.rows.length > 0) {
      console.log('Found existing users in the database!');
      res.rows.forEach(r => console.log(`- Email: ${r.email} | Role: ${r.role} | Name: ${r.first_name}`));
      console.log('\nSince a user already exists, you can try logging in with one of these emails if you remember the password. If not, you can either:');
      console.log('1. Use the Supabase Dashboard SQL Editor to reset their password hash.');
      console.log('2. Modify this script to create a new user.');
    } else {
      console.log('No users found. Creating a default test user...');
      const hash = await bcrypt.hash('password123', 10);
      await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
      `, ['admin@lumina.com', hash, 'Admin', 'User', 'Admin']);
      console.log('\n✅ Successfully created default user!');
      console.log('-----------------------------------');
      console.log('Email: admin@lumina.com');
      console.log('Password: password123');
      console.log('-----------------------------------');
      console.log('You can now log in using these credentials.');
    }
  } catch(e: any) {
    console.error('\n❌ Failed to query database. Error details:');
    console.error(e.message);
    if (e.message.includes('password authentication failed')) {
      console.error('Make sure your DATABASE_URL in .env has the correct password.');
    } else if (e.message.includes('relation "users" does not exist')) {
      console.error('The "users" table does not exist in your database yet. Did you run the database migrations?');
    }
  } finally {
    await client.end();
  }
}

main();
