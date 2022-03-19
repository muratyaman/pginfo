import { expect } from 'chai';
import dotenv from 'dotenv';
import { PgInfoService } from '../src';

dotenv.config();
const { PGDATABASE = 'demo' } = process.env;

describe('newPgInfo', () => {
  // relying on correct env settings; see .env.sample
  const pgInfo = new PgInfoService({}, PGDATABASE);

  after(async () => {
    await pgInfo.disconnect();
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

  it('should get columns for all user defined types in public schema', async() => {
    const schema = pgInfo.schema('public');
    const udtRows = await schema.userDefinedTypes();
    expect(udtRows.length > 0).to.eq(true);
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
    const pgInfo2 = new PgInfoService({ database: 'nodb', password: 'incorrect' }, 'nodb', logger);
    try {
      const _ignore = await pgInfo2.schemata();
    } catch (err) {
      // todo
    }
    pgInfo2.disconnect();
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
    const pgInfo3 = new PgInfoService({}, PGDATABASE, logger);
    try {
      const _ignore = await pgInfo3.query('SELECT * FROM no_table');
    } catch (err) {
      // todo
    }
    pgInfo3.disconnect();
    expect(called).to.eq(1);
  });

});
