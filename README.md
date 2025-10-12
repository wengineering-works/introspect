# introspect

## Preamble

Postgres and Typescript are common tools. I use them in nearly every project.

Most projects require fetching rows from a database table. This should always be typed.

I have explored other tools, namely:

- Kysely
- Zapatos

@todo: I'll share more notes in the future about my experiences with them.

However, I have realized that AI tools allow us to be confident diving into deeper APIs, and writing code with fewer dependencies.

A few things:

1. Postgres already has good tools to help you introspect it, you can query, via SQL, for table information. `SELECT ... FROM information_schema.tables ...` for example.
2. The actual Typescript we are generating is not complex, and we simply need something to create it... which is already in the Typescript project!
3. Bun.sh has made it easier to write scripts touching SQL because we don't need to also set up a node-postgres dependency, or other bindings, especially for a few simple calls.

## This project

This introspect is an exploration of working with the basic tools themselves.

The user only needs to enter a `DATABASE_URL` env.

First, we query the `information_schema` in the database for information about tables and columns.

Then, we use the Typescript compiler API to generate representations for each table.

@todo: In the future I'll share more info about how to manipulate common types. For example, date types should sometimes be `Date` objects in Typescript, but other times you want to represent them as `string` types.

## Usage

Note: this project is very much an exploration, I do advise anyone to install it directly at the moment. It is best to copy paste the source, or simply ask AI to generate something similar for you. Some postgres types will need special consideration, like Arrays, etc, which I have not programmed yet.

1. Set up the environment, set `DATABASE_URL` to `postgres://...`
2. Run, `bun index.ts`
3. The generated file is living at `schema.d.ts`

## Output

This project converts every table to an interface (in camel case), and also exposes a Database interface which contains all the tables.

```
// Example output:

export interface TableName {
  column1: string;
  column2: number | null;
}

export interface Database {
  table_name: TableName;
  ...
}
```

Note: in most cases, you should be commiting the output (schema.d.ts) to the git repo. However, in this project I have added it to .gitignore because otherwise you will see a very specific database.