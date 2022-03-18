import { expect } from 'chai';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { newPgInfo } from '../src';

dotenv.config();
const { PGDATABASE = 'demo' } = process.env;

describe('newPgInfo', () => {
  const db1 = new Pool(); // relying on correct env settings; see .env.sample
  const db2 = new Pool({ database: 'nodb', password: 'incorrect' });

  const pgInfo = newPgInfo(db1, PGDATABASE);

  after(async () => {
    await db1.end();
    await db2.end();
  });
  
  it('should get schemata', async() => {
    const schemaRows = await pgInfo.schemata();
    expect(schemaRows.length > 0).to.eq(true);
    const publicSchemaRow = schemaRows.find(s => s.schema_name === 'public');
    expect(!!publicSchemaRow).to.eq(true);
  });

  it('should get tables in public schema', async() => {
    const schema = pgInfo.schema('public');
    const tableRows = await schema.tables();
    expect(tableRows.length > 0).to.eq(true);
    const usersTableRow = tableRows.find(t => t.table_name === 'users');
    expect(!!usersTableRow).to.eq(true);
  });

  it('should get columns for all tables in public schema', async() => {
    const schema = pgInfo.schema('public');
    const columnRows = await schema.columns();
    expect(columnRows.length > 0).to.eq(true);
  });

  it('should get columns of users table in public schema', async() => {
    const schema = pgInfo.schema('public');
    const usersTable = schema.table('users');
    const columnRows = await usersTable.columns();
    expect(columnRows.length > 0).to.eq(true);
    const idColumnRow = columnRows.find(c => c.column_name === 'id');
    expect(!!idColumnRow).to.eq(true);
  });

  it('should handle connection issues', async() => {
    let called = 0, errMsg = '';
    const logger = {
      ...console,
      error: (msg: string, err: Error) => {
        errMsg = msg;
        called++;
      }
    }
    const pgInfo2 = newPgInfo(db2, 'nodb', logger);
    try {
      const _ignore = await pgInfo2.schemata();
    } catch (err) {
      // todo
    }
    expect(called).to.eq(1);
  });

  it('should handle query issues', async() => {
    let called = 0, errMsg = '';
    const logger = {
      ...console,
      error: (msg: string, err: Error) => {
        errMsg = msg;
        called++;
      }
    }
    const pgInfo3 = newPgInfo(db, PGDATABASE, logger);
    try {
      const _ignore = await pgInfo3._query('SELECT * FROM no_table');
    } catch (err) {
      // todo
    }
    expect(called).to.eq(1);
  });

});
