#!/usr/bin/env node
/* @flow */
import { parse, buildSchema, GraphQLSchema } from 'graphql';
import { createTypes } from '@teip/create-flow-types';
import { fillMap } from '@teip/wald';
import babelGenerator from '@babel/generator';
import commander from 'commander';
import fs from 'fs';
import path from 'path';
import glob from 'glob';
import { getGraphQLConfig } from 'graphql-config';
import pkg from '../package.json';

const DEFAULT_MATCHER = 'src/components/Module/definitions.graphql'; // '**/*.g*(raph)ql';

const HEADER = `/* @flow */
// This file is autogenerated with teip cli version ${pkg.version}.
// Do not manually update this file otherwise your changes will overwritten eventually!
import { type DefinitionNode } from 'graphql';

`;

commander.version(pkg.version);

commander
  .command('generate [pattern]')
  .description('Generate flow types for files')
  .action(async (pattern = DEFAULT_MATCHER) => {
    const schemaCache: Map<string, GraphQLSchema> = new Map();
    const files = glob.sync(pattern);
    const globalConfig = getGraphQLConfig(process.cwd());
    const pathMap = new Map();
    await Promise.all(files.map(file => fillMap(file, pathMap)));
    const writtenFiles = files.forEach(file => {
      const config = globalConfig.getConfigForFile(file);
      if (config.schemaPath !== path.resolve(file)) {
        let schema: ?GraphQLSchema = schemaCache.get(config.schemaPath);
        if (!schema) {
          schema = buildSchema(fs.readFileSync(config.schemaPath).toString('utf8'));
          schemaCache.set(config.schemaPath, schema);
        }
        try {
          const generated = HEADER + babelGenerator(createTypes(file, schema, pathMap)).code + '\n';
          fs.writeFileSync(path.resolve(process.cwd(), `${file}.flow`), generated);
        } catch (error) {
          console.log(error);
        }
      }
    });
  });

commander
  .command('wald [file]')
  .description('Run wald on entry file and print tree')
  .action(file => {
    const map = new Map();
    fillMap(file, map)
      .then(() => console.log(require('util').inspect(map, { depth: 3 })))
      .catch(error => console.error(error));
  });

commander.parse(process.argv);
