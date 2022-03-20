import { expect } from 'chai';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PgInfoService } from '../src';

dotenv.config();
const { PGDATABASE = 'demo' } = process.env;

describe('newPgInfo', () => {

  const mockLogger = {
    ...console,
    error: () => {
      // ignore
    },
  };

  // relying on correct env settings; see .env.sample
  const pgInfo = new PgInfoService(new Pool(), PGDATABASE);

  after(async () => {
    await pgInfo.disconnect();
  });
  
  it('should get schemata', async() => {
    const schemaRecords = await pgInfo.schemata();
    expect(schemaRecords.length > 0).to.eq(true);
    const publicSchemaRow = schemaRecords.find(s => s.schema_name === 'public');
    expect(!!publicSchemaRow).to.eq(true);
  });

  it('should get domains', async() => {
    const rows = await pgInfo.domains();
    expect(rows.length > 0).to.eq(true);
  });

  it('should get types in pg_catalog', async() => {
    const typeRows = await pgInfo.types();
    expect(typeRows.length > 0).to.eq(true);
  });

  it('should throw error when getting types in information_schema', async() => {
    const pgInfoErr = new PgInfoService(new Pool(), PGDATABASE, mockLogger);
    let error = null;
    try {
      await pgInfoErr.types('information_schema');
    } catch (err) {
      error = err;
    }
    expect(!!error).to.eq(true);
  });

  it('should throw error when getting types in invalid_schema', async() => {
    const pgInfoErr = new PgInfoService(new Pool(), PGDATABASE, mockLogger);
    let error = null;
    try {
      await pgInfoErr.types('invalid_schema');
    } catch (err) {
      error = err;
    }
    expect(!!error).to.eq(true);
  });

  it('should get tables in public schema', async() => {
    const schema = pgInfo.schema('public');
    const tableRecords = await schema.tables();
    expect(tableRecords.length > 0).to.eq(true);
    const usersTableRow = tableRecords.find(t => t.table_name === 'users');
    expect(!!usersTableRow).to.eq(true);
  });

  it('should get columns for all user defined types in public schema', async() => {
    const schema = pgInfo.schema('public');
    const udtRecords = await schema.userDefinedTypes();
    expect(udtRecords.length > 0).to.eq(true);
  });

  it('should get columns for all tables in public schema', async() => {
    const schema = pgInfo.schema('public');
    const columnRecords = await schema.columns();
    expect(columnRecords.length > 0).to.eq(true);
  });

  it('should get columns of options table in public schema', async() => {
    const schema = pgInfo.schema('public');
    const optionsTable = schema.table('options');
    const columnRecords = await optionsTable.columns();
    expect(columnRecords.length > 0).to.eq(true);
    const idColumnRow = columnRecords.find(c => c.column_name === 'uuid');
    expect(!!idColumnRow).to.eq(true);

    const varcharArrDim1Row = columnRecords.find(c => c.column_name === 'varchar_arr_dim1');
    expect(!!varcharArrDim1Row).to.eq(true);
    expect(varcharArrDim1Row?.array_dimension).to.eq(1);

    const intArrDim2Row = columnRecords.find(c => c.column_name === 'int_arr_dim2');
    expect(!!intArrDim2Row).to.eq(true);
    expect(intArrDim2Row?.array_dimension).to.eq(2);
  });

  it('should get attributes for all UDTs in public schema', async() => {
    const schema = pgInfo.schema('public');
    const attributesRecords = await schema.attributes();
    expect(attributesRecords.length > 0).to.eq(true);
  });

  it('should handle connection issues', async() => {
    let called = 0, errMsg = '';
    const logger = {
      ...console,
      error: (msg: string, err: Error) => {
        errMsg = msg;
        called++;
      }
    };
    const pgInfo2 = new PgInfoService(new Pool({ database: 'nodb', password: 'incorrect' }), 'nodb', logger);
    try {
      await pgInfo2.schemata();
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
    const pgInfo3 = new PgInfoService(new Pool({}), PGDATABASE, logger);
    try {
      const _ignore = await pgInfo3.query('SELECT * FROM no_table');
    } catch (err) {
      // todo
    }
    pgInfo3.disconnect();
    expect(called).to.eq(1);
  });

  it('constructor should throw error when db name is nil', async() => {
    let error = null;
    try {
      const _ = new PgInfoService(new Pool(), '');
    } catch (err) {
      error = err;
    }
    expect(!!error).to.eq(true);
  });

});
