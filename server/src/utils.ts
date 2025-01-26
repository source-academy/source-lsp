import { Node } from "js-slang/dist/types"
import * as es from "estree";
import { Range, SymbolKind } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { ProgramSymbols } from "./types";

function isNotNull<T>(x: T): x is Exclude<T, null> {
  // This function exists to appease the mighty typescript type checker
  return x !== null
}

function isNotNullOrUndefined<T>(x: T): x is Exclude<T, null | undefined> {
  // This function also exists to appease the mighty typescript type checker
  return x !== undefined && isNotNull(x)
}


export function getNodeChildren(node: Node): es.Node[] {
  switch (node.type) {
    case 'Program':
      return node.body
    case 'BlockStatement':
      return node.body
    case 'WhileStatement':
      return [node.test, node.body]
    case 'ForStatement':
      return [node.init, node.test, node.update, node.body].filter(isNotNullOrUndefined)
    case 'ExpressionStatement':
      return [node.expression]
    case 'IfStatement':
      const children = [node.test, node.consequent]
      if (isNotNullOrUndefined(node.alternate)) {
        children.push(node.alternate)
      }
      return children
    case 'ReturnStatement':
      return node.argument ? [node.argument] : []
    case 'FunctionDeclaration':
      return [node.body]
    case 'VariableDeclaration':
      return node.declarations.flatMap(getNodeChildren)
    case 'VariableDeclarator':
      return node.init ? [node.init] : []
    case 'ArrowFunctionExpression':
      return [node.body]
    case 'FunctionExpression':
      return [node.body]
    case 'UnaryExpression':
      return [node.argument]
    case 'BinaryExpression':
      return [node.left, node.right]
    case 'LogicalExpression':
      return [node.left, node.right]
    case 'ConditionalExpression':
      return [node.test, node.alternate, node.consequent]
    case 'CallExpression':
      return [...node.arguments, node.callee]
    // case 'Identifier':
    // case 'DebuggerStatement':
    // case 'BreakStatement':
    // case 'ContinueStatement':
    // case 'MemberPattern':
    case 'ArrayExpression':
      return node.elements.filter(isNotNull)
    case 'AssignmentExpression':
      return [node.left, node.right]
    case 'MemberExpression':
      return [node.object, node.property]
    case 'Property':
      return [node.key, node.value]
    case 'ObjectExpression':
      return [...node.properties]
    case 'NewExpression':
      return [...node.arguments, node.callee]
    default:
      return []
  }
}

export function getSubstrFromSouceLoc(text: string[], loc: es.SourceLocation): string {
  return loc.start.line === loc.end.line ?
    text[loc.start.line - 1].substring(loc.start.column, loc.end.column)
    : [text[loc.start.line - 1].substring(loc.start.column), ...text.slice(loc.start.line, loc.end.line - 1), text[loc.end.line - 1].substring(0, loc.end.column)].join('\n');
}

export function sourceLocToRange(loc: es.SourceLocation): Range {
  return {
    start: {
      line: loc.start.line - 1,
      character: loc.start.column
    },
    end: {
      line: loc.end.line - 1,
      character: loc.end.column
    }
  }
}

export function mapDeclarationKindToSymbolKind(kind: DeclarationKind): SymbolKind {
  switch (kind) {
    case DeclarationKind.KIND_IMPORT:
      return SymbolKind.Namespace;
    case DeclarationKind.KIND_FUNCTION:
      return SymbolKind.Function;
    case DeclarationKind.KIND_LET:
    case DeclarationKind.KIND_PARAM:
      return SymbolKind.Variable;
    case DeclarationKind.KIND_CONST:
      return SymbolKind.Constant
    default:
      return SymbolKind.Namespace;
  }
}

// The getNames function in js-slang has some issues, firstly it only get the names within a given scope, and it doesnt return the location of the name
// This implementation doesn't care where the cursor is, and grabs the name of all variables and functions
// @param prog Root node of the program, generated using looseParse
// @returns ProgramSymbols[]
export async function getAllNames(prog: Node): Promise<ProgramSymbols[]> {
	const queue: Node[] = [prog];
	const symbols: ProgramSymbols[] = [];

	while (queue.length > 0) {
		const node = queue.shift()!;

		if (node.type == "VariableDeclaration") {
			node.declarations.map(declaration => symbols.push({
				// We know that x is a variable declarator
				// @ts-ignore
				name: declaration.id.name,
				kind: node.kind === 'var' || node.kind === 'let' ? DeclarationKind.KIND_LET : DeclarationKind.KIND_CONST,
				range: sourceLocToRange(declaration.loc!),
				selectionRange: sourceLocToRange(declaration.id.loc!)
			}));
		}

		if (node.type == "FunctionDeclaration") {
			symbols.push({
				name: node.id!.name,
				kind: DeclarationKind.KIND_FUNCTION,
				range: sourceLocToRange(node.loc!),
				selectionRange: sourceLocToRange(node.id!.loc!)
			});

			node.params.map(param => symbols.push({
				// @ts-ignore
				name: param.name,
				kind: DeclarationKind.KIND_PARAM,
				range: sourceLocToRange(param.loc!),
				selectionRange: sourceLocToRange(param.loc!)
			}))
		}

		queue.push(...getNodeChildren(node))
	}

	return symbols;
}