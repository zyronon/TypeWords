import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

// Extract declarations rather than initialize unrelated Nuxt stores in the browser harness.
export function declarations(root, path, names) {
  const file = ts.createSourceFile(path, readFileSync(resolve(root, path), 'utf8'), ts.ScriptTarget.Latest, true)
  return names
    .map(name => {
      const statement = file.statements.find(statement =>
        ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
          ? statement.name?.text === name
          : ts.isVariableStatement(statement) &&
            statement.declarationList.declarations.some(item => ts.isIdentifier(item.name) && item.name.text === name)
      )
      if (!statement) throw new Error(`Missing declaration ${path}:${name}`)
      return statement.getText(file)
    })
    .join('\n')
}
