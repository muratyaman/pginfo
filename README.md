# pgsqlinfo

TypeScript library to work with information schema of PostgreSQL.

TypeScript models have been prepared based on the following links:

* https://www.postgresql.org/docs/current/information-schema.html
* https://www.postgresql.org/docs/current/infoschema-schemata.html
* https://www.postgresql.org/docs/current/infoschema-tables.html
* https://www.postgresql.org/docs/current/infoschema-columns.html
* https://www.postgresql.org/docs/current/infoschema-domains.html
* https://www.postgresql.org/docs/current/infoschema-user-defined-types.html
* https://www.postgresql.org/docs/current/infoschema-attributes.html

such as:

```typescript
export interface PgSchema {
  catalog_name:                  string | null;
  default_character_set_catalog: string | null;
  default_character_set_name:    string | null;
  default_character_set_schema:  string | null;
  schema_name:                   string | null;
  schema_owner:                  string | null;
  sql_path:                      string | null;
}
```

## Requirements

* [Node.js](https://nodejs.org/en/) - use active LTS

## Development

```sh
# clone repo
npm i
npm run build
npm run test
npm run test:coverage
```

## Usage

```sh
npm i pgsqlinfo
```

```typescript
import { Pool } from 'pg';
import { PgInfoService } from 'pgsqlinfo';

main();

async function main() {
  const db = new Pool();
  const pgInfo = new PgInfoService(db, PGDATABASE, console);

  const schemaRecords = await pgInfo.schemata();
  console.log({ schemaRecords });

  const schema = pgInfo.schema('public');
  const tableRecords = await schema.tables();
  console.log({ tableRecords });

  // all columns of all tables
  // const columnRecords = await schema.columns();

  const usersTable = schema.table('users');
  const columnRecordsOfUsersTable = await usersTable.columns();
  console.log({ columnRecordsOfUsersTable });
}
```
