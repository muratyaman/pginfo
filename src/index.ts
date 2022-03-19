import { Pool, PoolConfig } from 'pg';

const sqlSelectSchemata = `
SELECT
  *
FROM information_schema.schemata
WHERE catalog_name = $1
  AND schema_name <> 'information_schema'
  AND schema_name NOT LIKE 'pg_%'
ORDER BY schema_name;
`;

const sqlSelectUserDefinedTypes = `
SELECT
*
FROM information_schema.user_defined_types
WHERE user_defined_type_catalog = $1
  AND user_defined_type_schema = $2
ORDER BY user_defined_type_name
`;

const sqlSelectTables = `
SELECT
  *,
  obj_description((table_schema || '.' || table_name)::regclass) AS table_comment
FROM information_schema.tables
WHERE table_catalog = $1
  AND table_schema = $2
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;
`;

const sqlSelectColumns = `
SELECT
  *,
  col_description(((table_schema || '.' || table_name)::regclass)::oid, ordinal_position) AS column_comment
FROM information_schema.columns
WHERE table_catalog = $1
  AND table_schema = $2
ORDER BY table_name, column_name
`;

const sqlSelectColumnsByTable = `
SELECT
  *
FROM information_schema.columns
WHERE table_catalog = $1
  AND table_schema = $2
  AND table_name = $3
ORDER BY column_name
`;

export const pgMsgDbQueryError = 'DB query error';
export const pgMsgDbConnError  = 'DB connection error';

export class PgInfoService {
  protected _db: Pool;

  constructor(protected _dbConfig: PoolConfig, public readonly dbName: string, protected logger = console) {
    this._db = new Pool(this._dbConfig);
  }

  async disconnect() {
    await this._db.end();
  }

  async query<TRow = any>(text: string, values: any[] = [], name: string = ''): Promise<TRow[]> {
    let rows: TRow[] = [];
    let dbErr: any = null;
    try {
      const client = await this._db.connect();
      try {
        // using prepared + parameterized queries
        const result = await client.query<TRow>({ text, values, name });
        rows = result.rows;
      } catch (err) {
        dbErr = err;
        this.logger.error(pgMsgDbQueryError, err);
      } finally {
        client.release();
      }
    } catch (err) {
      dbErr = err;
      this.logger.error(pgMsgDbConnError, err);
      throw err;
    }
    if (dbErr) throw dbErr;
    return rows;
  }

  async schemata(): Promise<PgSchema[]> {
    return this.query<PgSchema>(sqlSelectSchemata, [this.dbName], 'schemata');
  }

  schema(schemaName: string): PgSchemaService {
    return new PgSchemaService(this, schemaName);
  }
}

export class PgSchemaService {
  constructor(protected _pg: PgInfoService, public readonly schemaName: string) {}

  async userDefinedTypes(): Promise<PgUserDefinedType[]> {
    return this._pg.query<PgUserDefinedType>(sqlSelectUserDefinedTypes, [this._pg.dbName, this.schemaName], 'userDefinedTypes');
  }

  async tables(): Promise<PgTable[]> {
    return this._pg.query<PgTable>(sqlSelectTables, [this._pg.dbName, this.schemaName], 'tables');
  }

  async columns(): Promise<PgColumn[]> {
    return this._pg.query<PgColumn>(sqlSelectColumns, [this._pg.dbName, this.schemaName], 'columns');
  }

  table(tableName: string) {
    return new PgTableService(this._pg, this, tableName);
  }
}

export class PgTableService {
  constructor(protected _pg: PgInfoService, protected _pgSchema: PgSchemaService, public readonly tableName: string) {}

  async columns(): Promise<PgColumn[]> {
    return this._pg.query<PgColumn>(sqlSelectColumnsByTable, [this._pg.dbName, this._pgSchema.schemaName, this.tableName], 'columnsByTable');
  }
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
  is_insertable_into:           PgYesOrNoEnum | PgYesOrNoType | string | null;
  is_typed:                     PgYesOrNoEnum | PgYesOrNoType | string | null;
  reference_generation:         string | null;
  self_referencing_column_name: string | null;
  table_catalog:                string | null;
  table_name:                   string | null;
  table_schema:                 string | null;
  table_type:                   PgTableTypeEnum | PgTableTypeType | string | null;
  user_defined_type_catalog:    string | null;
  user_defined_type_name:       string | null;
  user_defined_type_schema:     string | null;

  /**
   * artificial property dynamically retrieves comment
   */
  table_comment: string | null;
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
  is_identity:              PgYesOrNoEnum | PgYesOrNoType | string | null;
  is_nullable:              PgYesOrNoEnum | PgYesOrNoType | string | null;
  is_self_referencing:      PgYesOrNoEnum | PgYesOrNoType | string | null;
  is_updatable:             PgYesOrNoEnum | PgYesOrNoType | string | null;
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

  /**
   * artificial property dynamically retrieves comment
   */
  column_comment: string | null;
}

// @see https://www.postgresql.org/docs/current/infoschema-user-defined-types.html
export interface PgUserDefinedType {
  character_maximum_length:   number | null;
  character_octet_length:     number | null;
  character_set_catalog:      string | null;
  character_set_name:         string | null;
  character_set_schema:       string | null;
  collation_catalog:          string | null;
  collation_name:             string | null;
  collation_schema:           string | null;
  data_type:                  string | null;
  datetime_precision:         number | null;
  interval_precision:         number | null;
  interval_type:              string | null;
  is_final:                   string | null; // max 3
  is_instantiable:            PgYesOrNoEnum | PgYesOrNoType | string | null; // max 3
  numeric_precision:          number | null;
  numeric_precision_radix:    number | null;
  numeric_scale:              number | null;
  ordering_category:          string | null;
  ordering_form:              string | null;
  ordering_routine_catalog:   string | null;
  ordering_routine_name:      string | null;
  ordering_routine_schema:    string | null;
  ref_dtd_identifier:         string | null;
  reference_type:             string | null;
  source_dtd_identifier:      string | null;
  user_defined_type_catalog:  string | null;
  user_defined_type_category: 'STRUCTURED' | string | null; // Currently always 'STRUCTURED'
  user_defined_type_name:     string | null;
  user_defined_type_schema:   string | null;
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
  char = 'char',
  anyarray = 'anyarray',
  ARRAY = 'ARRAY',
  bigint = 'bigint',
  bit = 'bit',
  bit_varying = 'bit varying',
  boolean = 'boolean',
  box = 'box',
  bytea = 'bytea',
  character = 'character',
  character_varying = 'character varying',
  cidr = 'cidr',
  circle = 'circle',
  date = 'date',
  double_precision = 'double precision',
  inet = 'inet',
  integer = 'integer',
  interval = 'interval',
  json = 'json',
  jsonb = 'jsonb',
  line = 'line',
  lseg = 'lseg',
  macaddr = 'macaddr',
  macaddr8 = 'macaddr8',
  money = 'money',
  name = 'name',
  numeric = 'numeric',
  oid = 'oid',
  path = 'path',
  pg_dependencies = 'pg_dependencies',
  pg_lsn = 'pg_lsn',
  pg_mcv_list = 'pg_mcv_list',
  pg_ndistinct = 'pg_ndistinct',
  pg_node_tree = 'pg_node_tree',
  point = 'point',
  polygon = 'polygon',
  real = 'real',
  regproc = 'regproc',
  regtype = 'regtype',
  smallint = 'smallint',
  text = 'text',
  time_with_time_zone = 'time with time zone',
  time_without_time_zone = 'time without time zone',
  timestamp_with_time_zone = 'timestamp with time zone',
  timestamp_without_time_zone = 'timestamp without time zone',
  tsquery = 'tsquery',
  tsvector = 'tsvector',
  txid_snapshot = 'txid_snapshot',
  uuid = 'uuid',
  xid = 'xid',
  xml = 'xml',
}

export type PgDataTypeType =
  | 'char'
  | 'anyarray'
  | 'ARRAY'
  | 'bigint'
  | 'bit'
  | 'bit varying'
  | 'boolean'
  | 'box'
  | 'bytea'
  | 'character'
  | 'character varying'
  | 'cidr'
  | 'circle'
  | 'date'
  | 'double precision'
  | 'inet'
  | 'integer'
  | 'interval'
  | 'json'
  | 'jsonb'
  | 'line'
  | 'lseg'
  | 'macaddr'
  | 'macaddr8'
  | 'money'
  | 'name'
  | 'numeric'
  | 'oid'
  | 'path'
  | 'pg_dependencies'
  | 'pg_lsn'
  | 'pg_mcv_list'
  | 'pg_ndistinct'
  | 'pg_node_tree'
  | 'point'
  | 'polygon'
  | 'real'
  | 'regproc'
  | 'regtype'
  | 'smallint'
  | 'text'
  | 'time with time zone'
  | 'time without time zone'
  | 'timestamp with time zone'
  | 'timestamp without time zone'
  | 'tsquery'
  | 'tsvector'
  | 'txid_snapshot'
  | 'uuid'
  | 'xid'
  | 'xml'
;

// Enum for default User-Defined Types in pg_catalog
export enum PgUdtNameEnum {
  _aclitem = '_aclitem',
  _bool = '_bool',
  _char = '_char',
  _float4 = '_float4',
  _float8 = '_float8',
  _int2 = '_int2',
  _int4 = '_int4',
  _name = '_name',
  _oid = '_oid',
  _pg_statistic = '_pg_statistic',
  _regtype = '_regtype',
  _text = '_text',
  _varchar = '_varchar',
  anyarray = 'anyarray',
  bit = 'bit',
  bool = 'bool',
  box = 'box',
  bpchar = 'bpchar',
  bytea = 'bytea',
  char = 'char',
  cidr = 'cidr',
  circle = 'circle',
  date = 'date',
  float4 = 'float4',
  float8 = 'float8',
  inet = 'inet',
  int2 = 'int2',
  int2vector = 'int2vector',
  int4 = 'int4',
  int8 = 'int8',
  interval = 'interval',
  json = 'json',
  jsonb = 'jsonb',
  line = 'line',
  lseg = 'lseg',
  macaddr = 'macaddr',
  macaddr8 = 'macaddr8',
  money = 'money',
  name = 'name',
  numeric = 'numeric',
  oid = 'oid',
  oidvector = 'oidvector',
  path = 'path',
  pg_dependencies = 'pg_dependencies',
  pg_lsn = 'pg_lsn',
  pg_mcv_list = 'pg_mcv_list',
  pg_ndistinct = 'pg_ndistinct',
  pg_node_tree = 'pg_node_tree',
  point = 'point',
  polygon = 'polygon',
  regproc = 'regproc',
  regtype = 'regtype',
  text = 'text',
  time = 'time',
  timestamp = 'timestamp',
  timestamptz = 'timestamptz',
  timetz = 'timetz',
  tsquery = 'tsquery',
  tsvector = 'tsvector',
  txid_snapshot = 'txid_snapshot',
  uuid = 'uuid',
  varbit = 'varbit',
  varchar = 'varchar',
  xid = 'xid',
  xml = 'xml',
}

export type PgUdtNameType =
  | '_aclitem'
  | '_bool'
  | '_char'
  | '_float4'
  | '_float8'
  | '_int2'
  | '_int4'
  | '_name'
  | '_oid'
  | '_pg_statistic'
  | '_regtype'
  | '_text'
  | '_varchar'
  | 'anyarray'
  | 'bit'
  | 'bool'
  | 'box'
  | 'bpchar'
  | 'bytea'
  | 'char'
  | 'cidr'
  | 'circle'
  | 'date'
  | 'float4'
  | 'float8'
  | 'inet'
  | 'int2'
  | 'int2vector'
  | 'int4'
  | 'int8'
  | 'interval'
  | 'json'
  | 'jsonb'
  | 'line'
  | 'lseg'
  | 'macaddr'
  | 'macaddr8'
  | 'money'
  | 'name'
  | 'numeric'
  | 'oid'
  | 'oidvector'
  | 'path'
  | 'pg_dependencies'
  | 'pg_lsn'
  | 'pg_mcv_list'
  | 'pg_ndistinct'
  | 'pg_node_tree'
  | 'point'
  | 'polygon'
  | 'regproc'
  | 'regtype'
  | 'text'
  | 'time'
  | 'timestamp'
  | 'timestamptz'
  | 'timetz'
  | 'tsquery'
  | 'tsvector'
  | 'txid_snapshot'
  | 'uuid'
  | 'varbit'
  | 'varchar'
  | 'xid'
  | 'xml'
;
