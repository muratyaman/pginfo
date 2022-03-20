import { Pool } from 'pg';

const sqlSelectSchemataAll = `
SELECT
  *
FROM information_schema.schemata
WHERE catalog_name = $1
ORDER BY schema_name;
`;

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
  *,
  obj_description((table_schema || '.' || table_name)::regclass) AS table_comment
FROM information_schema.tables
WHERE table_catalog = $1
  AND table_schema = $2
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;
`;

const sqlSelectTablesWithArrayColumns = `
SELECT relname AS table_name, attname AS column_name, attndims AS array_dimension
FROM pg_class c
JOIN pg_namespace s ON c.relnamespace = s.oid
JOIN pg_attribute a ON c.oid = attrelid 
  AND a.attndims > 0 -- array
  AND a.attnum > 0 -- not system column
JOIN pg_type t ON t.oid = atttypid
WHERE c.relkind = 'r' AND s.nspname = $1
`;

const sqlSelectColumns = `
SELECT
  cols.*,
  col_description(((cols.table_schema || '.' || cols.table_name)::regclass)::oid, ordinal_position) AS column_comment,
  null AS array_dimension -- to be appended
FROM information_schema.columns AS cols
WHERE cols.table_catalog = $1
  AND cols.table_schema = $2
ORDER BY cols.table_name, cols.column_name
`;

const sqlSelectColumnsByTable = `
SELECT
  cols.*,
  col_description(((cols.table_schema || '.' || cols.table_name)::regclass)::oid, ordinal_position) AS column_comment,
  null AS array_dimension -- to be appended
FROM information_schema.columns AS cols
WHERE cols.table_catalog = $1
  AND cols.table_schema = $2
  AND cols.table_name = $3
ORDER BY cols.column_name
`;

const sqlSelectDomains = `
select
  *
FROM information_schema.domains
ORDER BY 1,2,3;
`;

const sqlSelectTypes = (catalog: string) => `
select
  *
FROM ${catalog}.pg_type
ORDER BY typname;
`;

// get UDTs
const sqlSelectUserDefinedTypes = `
SELECT
*
FROM information_schema.user_defined_types
WHERE user_defined_type_catalog = $1
  AND user_defined_type_schema = $2
ORDER BY user_defined_type_name
`;

// details of composite UDTs
const sqlSelectAttributes = `
SELECT
  *
FROM information_schema.attributes
WHERE udt_catalog = $1
  AND udt_schema = $2
ORDER BY udt_name, attribute_name
`;

export const pgMsgDbQueryError = 'DB query error';
export const pgMsgDbConnError  = 'DB connection error';

export class PgInfoService {

  constructor(protected _db: Pool, public readonly dbName: string, protected _logger = console) {
    if (dbName.trim() === '') throw new Error('invalid database name');
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
        this._logger.error(pgMsgDbQueryError, err);
      } finally {
        client.release();
      }
    } catch (err) {
      dbErr = err;
      this._logger.error(pgMsgDbConnError, err);
      throw err;
    }
    if (dbErr) throw dbErr;
    return rows;
  }

  async schemataAll(): Promise<PgSchema[]> {
    return this.query<PgSchema>(sqlSelectSchemataAll, [this.dbName], 'schemataAll');
  }

  async schemata(): Promise<PgSchema[]> {
    return this.query<PgSchema>(sqlSelectSchemata, [this.dbName], 'schemata');
  }

  schema(schemaName: string): PgSchemaService {
    return new PgSchemaService(this, schemaName);
  }

  async types(catalog = 'pg_catalog'): Promise<PgType[]> {
    let isValidCatalog = catalog === 'pg_catalog';
    if (!isValidCatalog) {
      const schemata = await this.schemataAll();
      const schemaFound = schemata.find(s => s.schema_name === catalog);
      isValidCatalog = !!schemaFound;
    }
    if (!isValidCatalog) throw new Error(`invalid catalog "${catalog}" to find types`);
    return this.query<PgType>(sqlSelectTypes(catalog), [], 'types_in_' + catalog);
  }

  async domains(): Promise<PgDomain[]> {
    return this.query<PgDomain>(sqlSelectDomains, [], 'domains');
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
    const colRecords = await this._pg.query<PgColumn>(sqlSelectColumns, [this._pg.dbName, this.schemaName], 'columns');
    const arrInfoRecords = await this.arrayColumns();
    this.appendArrayDimension(colRecords, arrInfoRecords);
    return colRecords;
  }
  
  async attributes(): Promise<PgAttribute[]> {
    return this._pg.query<PgAttribute>(sqlSelectAttributes, [this._pg.dbName, this.schemaName], 'attributes');
  }
  
  async arrayColumns(): Promise<PgTableArrayColumn[]> {
    return this._pg.query<PgTableArrayColumn>(sqlSelectTablesWithArrayColumns, [this.schemaName], 'arrayColumns');
  }

  table(tableName: string) {
    return new PgTableService(this._pg, this, tableName);
  }

  // this has side-effect on colRecords
  appendArrayDimension(colRecords: PgColumn[], arrInfoRecords: PgTableArrayColumn[]) {
    for (const arrInfoRecord of arrInfoRecords) {
      const colRecord = colRecords.find(c => c.table_name === arrInfoRecord.table_name && c.column_name === arrInfoRecord.column_name);
      if (colRecord) { // in reality arrInfoRecords is a subset of colRecords
        colRecord.array_dimension = arrInfoRecord.array_dimension;
      }
    }
  }
}

export class PgTableService {
  constructor(protected _pg: PgInfoService, protected _pgSchema: PgSchemaService, public readonly tableName: string) {}

  async columns(): Promise<PgColumn[]> {
    const colRecords = await this._pg.query<PgColumn>(sqlSelectColumnsByTable, [this._pg.dbName, this._pgSchema.schemaName, this.tableName], 'columnsByTable');
    const arrInfoRecords = await this._pgSchema.arrayColumns();
    this._pgSchema.appendArrayDimension(colRecords, arrInfoRecords);
    return colRecords;
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
  /**
   * artificial property dynamically retrieves array dimension if data_type is 'ARRAY'
   */
  array_dimension?: number | null;
}

export interface PgTableArrayColumn {
  table_name: string;
  column_name: string;
  array_dimension: number;
}

// @see https://www.postgresql.org/docs/current/infoschema-domains.html
export interface PgDomain {
  character_maximum_length: number | null; // int4
  character_octet_length:   number | null; // int4
  character_set_catalog:    string | null; // name
  character_set_name:       string | null; // name
  character_set_schema:     string | null; // name
  collation_catalog:        string | null; // name
  collation_name:           string | null; // name
  collation_schema:         string | null; // name
  data_type:                string | null; // varchar
  datetime_precision:       number | null; // int4
  domain_catalog:           string | null; // name
  domain_default:           string | null; // varchar
  domain_name:              string | null; // name
  domain_schema:            string | null; // name
  dtd_identifier:           string | null; // name
  interval_precision:       number | null; // int4
  interval_type:            string | null; // varchar
  maximum_cardinality:      number | null; // int4
  numeric_precision:        number | null; // int4
  numeric_precision_radix:  number | null; // int4
  numeric_scale:            string | null; // int4
  scope_catalog:            string | null; // name
  scope_name:               string | null; // name
  scope_schema:             string | null; // name
  udt_catalog:              string | null; // name
  udt_name:                 string | null; // name
  udt_schema:               string | null; // name
}

// @see https://www.postgresql.org/docs/current/catalog-pg-type.html
export interface PgType {
  oid:            string | null; // oid
  typacl:         string | null; // _aclitem ARRAY
  typalign:       string | null; // char
  typanalyze:     any; // regproc
  typarray:       string | null; // oid
  typbasetype:    string | null; // oid
  typbyval:       boolean | null; // boolean
  typcategory:    string | null; // char
  typcollation:   string | null; // oid
  typdefault:     string | null; // text
  typdefaultbin:  any; // pg_node_tree
  typdelim:       string | null; // char
  typelem:        string | null; // oid
  typinput:       any; // regproc
  typisdefined:   boolean | null; // boolean
  typispreferred: boolean | null; // boolean
  typlen:         number | null; // smallint
  typmodin:       any; // regproc
  typmodout:      any; // regproc
  typname:        string | null; // name
  typnamespace:   string | null; // oid
  typndims:       number | null; // integer
  typnotnull:     boolean | null; // boolean
  typoutput:      any; // regproc
  typowner:       string | null; // oid
  typreceive:     any; // regproc
  typrelid:       string | null; // oid
  typsend:        any; // regproc
  typstorage:     string | null; // char
  typsubscript:   any; // regproc
  typtype:        PgTypeTypeEnum | PgTypeType | string | null; // char 1
  typtypmod:      number | null; // integer
}

export type PgTypeType = 'b' | 'c' | 'd' | 'e' | 'p' | 'r' | 'm';
export enum PgTypeTypeEnum {
  b = 'b', // base
  c = 'c', // composite
  d = 'd', // domain
  e = 'e', // enum
  m = 'm', // multi-range
  p = 'p', // pseudo
  r = 'r', // range
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
  is_final:                   PgYesOrNoEnum | PgYesOrNoType | string | null; // max 3
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

// @see https://www.postgresql.org/docs/current/infoschema-attributes.html
export interface PgAttribute {
  attribute_default:              string | null;
  attribute_name:                 string | null;
  attribute_udt_catalog:          string | null;
  attribute_udt_name:             string | null;
  attribute_udt_schema:           string | null;
  character_maximum_length:       number | null;
  character_octet_length:         number | null;
  character_set_catalog:          string | null;
  character_set_name:             string | null;
  character_set_schema:           string | null;
  collation_catalog:              string | null;
  collation_name:                 string | null;
  collation_schema:               string | null;
  data_type:                      string | null;
  datetime_precision:             number | null;
  dtd_identifier:                 string | null;
  interval_precision:             number | null;
  interval_type:                  string | null;
  is_derived_reference_attribute: PgYesOrNoEnum | PgYesOrNoType | string | null; // max 3
  is_nullable:                    PgYesOrNoEnum | PgYesOrNoType | string | null; // max 3
  maximum_cardinality:            number | null;
  numeric_precision:              number | null;
  numeric_precision_radix:        number | null;
  numeric_scale:                  number | null;
  ordinal_position:               number | null;
  scope_catalog:                  string | null;
  scope_name:                     string | null;
  scope_schema:                   string | null;
  udt_catalog:                    string | null;
  udt_name:                       string | null;
  udt_schema:                     string | null;
}

// @see https://www.postgresql.org/docs/8.4/catalog-pg-enum.html
export interface PgEnum {
  enumlabel:     string;
  enumsortorder: number; // float4
  enumtypid:     string; // ==> parent UDT kind enum
  oid:           string;
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
  char = '"char"',
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
  | '"char"'
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
