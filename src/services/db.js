// src/services/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
console.log(`[DB] Menjalankan dalam mode: ${isTest ? 'TEST' : 'DEVELOPMENT'}`);

export const db = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: isTest ? 'menfess_bot_test' : process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});