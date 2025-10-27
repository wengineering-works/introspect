#!/usr/bin/env bun

import { sql } from "bun";
import ts from "typescript";
import prettier from "prettier";

const tables = await sql<{ table_name: string }[]>`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name
`;

// Get all columns with their types
// @todo: maybe consider using oid in the future, but not necessary for tables I have encountered
const columns = await sql<
  {
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
  }[]
>`
  SELECT
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;

console.log(
  "[introspect] fetched tables:",
  tables.map((t) => t.table_name)
);

// Map PostgreSQL types to TypeScript type nodes
function getTypeNode(
  dataType: string,
  udtName: string,
  isNullable: boolean
): ts.TypeNode {
  let baseType: ts.TypeNode;

  // Handle specific UDT names first
  if (udtName === "uuid") {
    baseType = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  } else if (udtName === "timestamptz" || udtName === "timestamp") {
    baseType = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  } else if (udtName === "citext") {
    baseType = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  } else {
    // Handle data types
    switch (dataType) {
      case "character varying":
      case "text":
      case "bigint":
      case "character":
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.StringKeyword
        );
        break;
      case "integer":
      case "smallint":
      case "numeric":
      case "decimal":
      case "real":
      case "double precision":
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.NumberKeyword
        );
        break;
      case "boolean":
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.BooleanKeyword
        );
        break;
      case "date":
        // @todo: watch out for date types here
        baseType = ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
        break;
      case "json":
      case "jsonb":
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.UnknownKeyword
        );
        break;
      case "uuid":
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.StringKeyword
        );
        break;
      default:
        console.warn(`Unknown type: ${dataType} (${udtName})`);
        baseType = ts.factory.createKeywordTypeNode(
          ts.SyntaxKind.UnknownKeyword
        );
    }
  }

  // Add null if nullable
  if (isNullable) {
    return ts.factory.createUnionTypeNode([
      baseType,
      ts.factory.createLiteralTypeNode(
        ts.factory.createToken(ts.SyntaxKind.NullKeyword)
      ),
    ]);
  }

  return baseType;
}

// Convert table name to PascalCase for interface name
function toPascalCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

// Group columns by table
const tableColumns = new Map<string, typeof columns>();
for (const column of columns) {
  if (!tableColumns.has(column.table_name)) {
    tableColumns.set(column.table_name, []);
  }
  tableColumns.get(column.table_name)!.push(column);
}

// Build interface declarations for each table
const interfaceDeclarations: ts.InterfaceDeclaration[] = [];

for (const table of tables) {
  const tableName = table.table_name;
  const cols = tableColumns.get(tableName) || [];

  const properties = cols.map((col) =>
    ts.factory.createPropertySignature(
      undefined,
      ts.factory.createIdentifier(col.column_name),
      undefined,
      getTypeNode(col.data_type, col.udt_name, col.is_nullable === "YES")
    )
  );

  const interfaceDecl = ts.factory.createInterfaceDeclaration(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createIdentifier(toPascalCase(tableName)),
    undefined,
    undefined,
    properties
  );

  interfaceDeclarations.push(interfaceDecl);
}

// Create the Database interface that maps table names to their types
const databaseProperties = tables.map((table) =>
  ts.factory.createPropertySignature(
    undefined,
    ts.factory.createIdentifier(table.table_name),
    undefined,
    ts.factory.createTypeReferenceNode(toPascalCase(table.table_name))
  )
);

const databaseInterface = ts.factory.createInterfaceDeclaration(
  [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
  ts.factory.createIdentifier("Database"),
  undefined,
  undefined,
  databaseProperties
);

// Create the source file with all declarations
const allDeclarations = [...interfaceDeclarations, databaseInterface];

const sourceFile = ts.factory.createSourceFile(
  allDeclarations,
  ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
  ts.NodeFlags.None
);

// Create a printer to convert AST to string
const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
});

// Print the AST to a string
const generatedCode = printer.printFile(sourceFile);

// Add a header comment
const unformattedOutput = `// Generated by introspect on ${new Date().toISOString()}
// DO NOT EDIT - This file is auto-generated

${generatedCode}`;

// Format with prettier
const formattedOutput = await prettier.format(unformattedOutput, {
  parser: "typescript",
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  trailingComma: "es5",
});

// Write to schema.d.ts in the current working directory
const outputPath = "schema.d.ts";
await Bun.write(outputPath, formattedOutput);

console.log(`[introspect] successfully updated schema in schema.d.ts`);
