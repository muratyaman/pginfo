# pgsqlinfo

TypeScript library to work with information schema of PostgreSQL.

TypeScript models have been prepared based on the following links:

* https://www.postgresql.org/docs/current/infoschema-schemata.html
* https://www.postgresql.org/docs/current/infoschema-tables.html
* https://www.postgresql.org/docs/current/infoschema-columns.html

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
import { newPgInfo } from 'pgsqlinfo';

main();

async function main() {
  const db = new Pool();
  const pgInfo = newPgInfo(db, PGDATABASE, console);

  const schemaRows = await pgInfo.schemata();
  console.log({ schemaRows });

  const schema = pgInfo.schema('public');
  const tableRows = await schema.tables();
  console.log({ tableRows });

  // all columns of all tables
  // const columnRows = await schema.columns();

  const usersTable = schema.table('users');
  const columnRowsOfUsersTable = await usersTable.columns();
  console.log({ columnRowsOfUsersTable });
}
```
