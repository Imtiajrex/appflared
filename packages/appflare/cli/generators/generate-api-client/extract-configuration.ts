import ts from "typescript";
import fs from "fs";

export function extractClientConfig(configPath: string): string | null {
	if (!fs.existsSync(configPath)) {
		return null;
	}

	const sourceCode = fs.readFileSync(configPath, "utf-8");
	const sourceFile = ts.createSourceFile(
		"appflare.config.ts",
		sourceCode,
		ts.ScriptTarget.Latest,
		true,
	);

	let clientOptionsNode: ts.Expression | undefined;

	// 1. Find the default export
	// 2. Find the 'auth' property in the object literal
	// 3. Find the 'clientOptions' property in the 'auth' object literal

	function findClientOptions(node: ts.Node) {
		if (ts.isExportAssignment(node)) {
			const expr = node.expression;
			if (ts.isObjectLiteralExpression(expr)) {
				const authProp = expr.properties.find(
					(p) =>
						ts.isPropertyAssignment(p) &&
						ts.isIdentifier(p.name) &&
						p.name.text === "auth",
				) as ts.PropertyAssignment | undefined;

				if (authProp && ts.isObjectLiteralExpression(authProp.initializer)) {
					const clientOptionsProp = authProp.initializer.properties.find(
						(p) =>
							ts.isPropertyAssignment(p) &&
							ts.isIdentifier(p.name) &&
							p.name.text === "clientOptions",
					) as ts.PropertyAssignment | undefined;

					if (clientOptionsProp) {
						clientOptionsNode = clientOptionsProp.initializer;
					}
				}
			}
		}
		ts.forEachChild(node, findClientOptions);
	}

	findClientOptions(sourceFile);

	if (!clientOptionsNode) {
		return null;
	}

	const clientOptionsText = clientOptionsNode.getText(sourceFile);

	// 4. Identify identifiers used in clientOptionsText to find necessary imports
	const usedIdentifiers = new Set<string>();

	function findIdentifiers(node: ts.Node) {
		if (ts.isIdentifier(node)) {
			usedIdentifiers.add(node.text);
		}
		ts.forEachChild(node, findIdentifiers);
	}

	findIdentifiers(clientOptionsNode);

	// 5. Scan top-level imports to find matching named imports
	const importsToKeep: string[] = [];

	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement)) {
			const importClause = statement.importClause;
			if (!importClause) continue;

			const moduleSpecifier = statement.moduleSpecifier.getText(sourceFile);

			// Check for named imports
			if (
				importClause.namedBindings &&
				ts.isNamedImports(importClause.namedBindings)
			) {
				const keepElements: string[] = [];
				for (const element of importClause.namedBindings.elements) {
					if (usedIdentifiers.has(element.name.text)) {
						keepElements.push(element.getText(sourceFile));
					}
				}
				if (keepElements.length > 0) {
					importsToKeep.push(
						`import { ${keepElements.join(", ")} } from ${moduleSpecifier};`,
					);
				}
			}

			// Check for default import
			if (importClause.name && usedIdentifiers.has(importClause.name.text)) {
				importsToKeep.push(
					`import ${importClause.name.text} from ${moduleSpecifier};`,
				);
			}

			// Check for namespace import
			if (
				importClause.namedBindings &&
				ts.isNamespaceImport(importClause.namedBindings)
			) {
				if (usedIdentifiers.has(importClause.namedBindings.name.text)) {
					importsToKeep.push(
						`import * as ${importClause.namedBindings.name.text} from ${moduleSpecifier};`,
					);
				}
			}
		}
	}

	return `${importsToKeep.join("\n")}\n\nexport const clientOptions = ${clientOptionsText};`;
}
