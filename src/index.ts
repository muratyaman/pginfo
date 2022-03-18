import { Pool } from 'pg';

export type PgInfo = ReturnType<typeof newPgInfo>;

const sqlSelectSchemata = `
  SELECT
    *
  FROM information_schema.schemata
  WHERE catalog_name = $1
    AND schema_name <> 'information_schema'
    AND schema_name NOT LIKE 'pg_%'
  ORDER BY schema_name;
`;

const sqlSelectTables = `
  SELECT
    *
  FROM information_schema.tables
  WHERE table_catalog = $1
    AND table_schema = $2
    AND table_type = 'BASE TABLE'
  ORDER BY table_schema, table_name;
`;

const sqlSelectColumns = `
  SELECT
    *
  FROM information_schema.columns
  WHERE table_catalog = $1
    AND table_schema = $2
  ORDER BY table_schema, table_name, column_name
`;

const sqlSelectColumnsByTable = `
  SELECT
    *
  FROM information_schema.columns
  WHERE table_catalog = $1
    AND table_schema = $2
    AND table_name = $3
  ORDER BY table_schema, table_name, column_name
`;

export const pgMsgDbQueryError = 'DB query error';
export const pgMsgDbConnError  = 'DB connection error';

export function newPgInfo(_db: Pool, _dbName: string, logger = console) {

  async function _query<TRow = any>(text: string, values: any[] = [], name: string = ''): Promise<TRow[]> {
    let rows: TRow[] = [];
    let released = false, connErr: any = null, qryErr: any = null;
    try {
      const client = await _db.connect();
      try {
        // using prepared + parameterized queries
        const result = await client.query<TRow>({ text, values, name });
        client.release();
        released = true;
        rows = result.rows;
      } catch (err) {
        qryErr = err;
        logger.error(pgMsgDbQueryError, err);
      }
      if (!released) client.release();
    } catch (err) {
      connErr = err;
      logger.error(pgMsgDbConnError, err);
      throw err;
    }
    if (connErr) throw connErr;
    if (qryErr) throw qryErr;
    return rows;
  }

  async function schemata(): Promise<PgSchema[]> {
    return _query<PgSchema>(sqlSelectSchemata, [_dbName], 'schemata');
  }

  function schema(_schemaName: string) {

    async function tables(): Promise<PgTable[]> {
      return _query<PgTable>(sqlSelectTables, [_dbName, _schemaName], 'tables');
    }

    async function columns(): Promise<PgColumn[]> {
      return _query<PgColumn>(sqlSelectColumns, [_dbName, _schemaName], 'columns');
    }

    function table(_tableName: string) {

      async function columns(): Promise<PgColumn[]> {
        return _query<PgColumn>(sqlSelectColumnsByTable, [_dbName, _schemaName, _tableName], 'columnsByTable');
      }
      return {
        _db,
        _dbName,
        _schemaName,
        _tableName,
        columns,
      };
    }

    return {
      _db,
      _dbName,
      _schemaName,
      tables,
      table,
      columns,
    };
  }

  return {
    _db,
    _dbName,
    _query,
    schemata,
    schema,
  };
}

// @see https://www.postgresql.org/docs/current/infoschema-schemata.html
export interface PgSchema {
  catalog_name:                  string | null;
  default_character_set_catalog: string | null;
  default_character_set_name:    string | null;
  default_character_set_schema:  string | null;
  schema_name:                   string | null;
  schema_owner:                  string | null;
  sql_path:                      string | null;
}

// @see https://www.postgresql.org/docs/current/infoschema-tables.html
export interface PgTable {
  commit_action:                string | null;
  is_insertable_into:           PgYesOrNoEnum | PgYesOrNoType | null;
  is_typed:                     PgYesOrNoEnum | PgYesOrNoType | null;
  reference_generation:         string | null;
  self_referencing_column_name: string | null;
  table_catalog:                string | null;
  table_name:                   string | null;
  table_schema:                 string | null;
  table_type:                   PgTableTypeEnum | PgTableTypeType | null;
  user_defined_type_catalog:    string | null;
  user_defined_type_name:       string | null;
  user_defined_type_schema:     string | null;  
}

// @see https://www.postgresql.org/docs/current/infoschema-columns.html
export interface PgColumn {
  character_maximum_length: number | null;
  character_octet_length:   number | null;
  character_set_catalog:    string | null;
  character_set_name:       string | null;
  character_set_schema:     string | null;
  collation_catalog:        string | null;
  collation_name:           string | null;
  collation_schema:         string | null;
  column_default:           string | null;
  column_name:              string | null;
  data_type:                PgDataTypeEnum | PgDataTypeType | string | null;
  datetime_precision:       number | null;
  domain_catalog:           string | null;
  domain_name:              string | null;
  domain_schema:            string | null;
  dtd_identifier:           string | null;
  generation_expression:    string | null;
  identity_cycle:           string | null;
  identity_generation:      string | null;
  identity_increment:       string | null;
  identity_maximum:         string | null;
  identity_minimum:         string | null;
  identity_start:           string | null;
  interval_precision:       number | null;
  interval_type:            string | null;
  is_generated:             PgAlwaysOrNeverType | null;
  is_identity:              PgYesOrNoEnum | PgYesOrNoType | null;
  is_nullable:              PgYesOrNoEnum | PgYesOrNoType | null;
  is_self_referencing:      PgYesOrNoEnum | PgYesOrNoType | null;
  is_updatable:             PgYesOrNoEnum | PgYesOrNoType | null;
  maximum_cardinality:      number | null;
  numeric_precision:        number | null;
  numeric_precision_radix:  number | null;
  numeric_scale:            number | null;
  ordinal_position:         number | null;
  scope_catalog:            string | null;
  scope_name:               string | null;
  scope_schema:             string | null;
  table_catalog:            string | null;
  table_name:               string | null;
  table_schema:             string | null;
  udt_catalog:              string | null;
  udt_name:                 PgUdtNameEnum | PgUdtNameType | string | null;
  udt_schema:               string | null;
}

export type PgTableTypeType = 'BASE TABLE' | 'VIEW' | 'FOREIGN' | 'LOCAL TEMPORARY';
export enum PgTableTypeEnum {
  BASE_TABLE      = 'BASE TABLE',
  VIEW            = 'VIEW',
  FOREIGN         = 'FOREIGN',
  LOCAL_TEMPORARY = 'LOCAL TEMPORARY',
}

export type PgAlwaysOrNeverType = 'ALWAYS' | 'NEVER';
export enum PgAlwaysOrNeverEnum {
  ALWAYS = 'ALWAYS',
  NEVER  = 'NEVER',
}

export type PgYesOrNoType = 'YES' | 'NO';
export enum PgYesOrNoEnum {
  YES = 'YES',
  NO  = 'NO',
}

export enum PgDataTypeEnum {
  char                        = 'char',
  anyarray                    = 'anyarray',
  ARRAY                       = 'ARRAY',
  bigint                      = 'bigint',
  boolean                     = 'boolean',
  bytea                       = 'bytea',
  character_varying           = 'character varying',
  date                        = 'date',
  double_precision            = 'double precision',
  inet                        = 'inet',
  integer                     = 'integer',
  interval                    = 'interval',
  json                        = 'json',
  jsonb                       = 'jsonb',
  name                        = 'name',
  numeric                     = 'numeric',
  oid                         = 'oid',
  pg_dependencies             = 'pg_dependencies',
  pg_lsn                      = 'pg_lsn',
  pg_mcv_list                 = 'pg_mcv_list',
  pg_ndistinct                = 'pg_ndistinct',
  pg_node_tree                = 'pg_node_tree',
  real                        = 'real',
  regproc                     = 'regproc',
  regtype                     = 'regtype',
  smallint                    = 'smallint',
  text                        = 'text',
  timestamp_with_time_zone    = 'timestamp with time zone',
  tsz                         = 'timestamp with time zone', // alias
  timestamp_without_time_zone = 'timestamp without time zone',
  ts                          = 'timestamp without time zone', // alias
  USER_DEFINED                = 'USER-DEFINED',
  uuid                        = 'uuid',
  xid                         = 'xid',
}

export type PgDataTypeType =
  'char' |
  'anyarray' |
  'ARRAY' |
  'bigint' |
  'boolean' |
  'bytea' |
  'character varying' |
  'date' |
  'double precision' |
  'inet' |
  'integer' |
  'interval' |
  'json' |
  'jsonb' |
  'name' |
  'numeric' |
  'oid' |
  'pg_dependencies' |
  'pg_lsn' |
  'pg_mcv_list' |
  'pg_ndistinct' |
  'pg_node_tree' |
  'real' |
  'regproc' |
  'regtype' |
  'smallint' |
  'text' |
  'timestamp with time zone' |
  'timestamp without time zone' |
  'USER-DEFINED' |
  'uuid' |
  'xid'
;

// Enum for default User-Defined Types in pg_catalog
export enum PgUdtNameEnum {
  anyarray       = 'anyarray',
  bool            = 'bool',
  bytea           = 'bytea',
  char            = 'char',
  date            = 'date',
  float4          = 'float4',
  float8          = 'float8',
  inet            = 'inet',
  int2            = 'int2',
  int2vector      = 'int2vector',
  int4            = 'int4',
  int8            = 'int8',
  interval        = 'interval',
  json            = 'json',
  jsonb           = 'jsonb',
  name            = 'name',
  numeric         = 'numeric',
  oid             = 'oid',
  oidvector       = 'oidvector',
  pg_dependencies = 'pg_dependencies',
  pg_lsn          = 'pg_lsn',
  pg_mcv_list     = 'pg_mcv_list',
  pg_ndistinct    = 'pg_ndistinct',
  pg_node_tree    = 'pg_node_tree',
  regproc         = 'regproc',
  regtype         = 'regtype',
  text            = 'text',
  timestamp       = 'timestamp',
  timestamptz     = 'timestamptz',
  uuid            = 'uuid',
  varchar         = 'varchar',
  xid             = 'xid',
  _aclitem        = '_aclitem',
  _bool           = '_bool',
  _char           = '_char',
  _float4         = '_float4',
  _float8         = '_float8',
  _int2           = '_int2',
  _name           = '_name',
  _oid            = '_oid',
  _regtype        = '_regtype',
  _text           = '_text',
  _varchar        = '_varchar',
}

export type PgUdtNameType = 
  'anyarray' |
  'bool' |
  'bytea' |
  'char' |
  'date' |
  'float4' |
  'float8' |
  'inet' |
  'int2' |
  'int2vector' |
  'int4' |
  'int8' |
  'interval' |
  'json' |
  'jsonb' |
  'name' |
  'numeric' |
  'oid' |
  'oidvector' |
  'pg_dependencies' |
  'pg_lsn' |
  'pg_mcv_list' |
  'pg_ndistinct' |
  'pg_node_tree' |
  'regproc' |
  'regtype' |
  'text' |
  'timestamp' |
  'timestamptz' |
  'uuid' |
  'varchar' |
  'xid' |
  '_aclitem' |
  '_bool' |
  '_char' |
  '_float4' |
  '_float8' |
  '_int2' |
  '_name' |
  '_oid' |
  '_regtype' |
  '_text' |
  '_varchar'
;
