import { Chapter, Context, Node } from "js-slang/dist/types"
import * as es from "estree";
import { CompletionItem, CompletionItemKind, DocumentSymbol, MarkupKind, Position, Range, SymbolKind } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { AUTOCOMPLETE_TYPES, CompletionItemData, DeclarationSymbol, Documentation } from "./types";

import source from './docs/source.json'
import modules from "./docs/modules/modules.json";

export const builtin_functions: Array<{[key: string]: Documentation}> = source.map(version => version.filter(doc => doc.meta === "func").reduce((a, v) => ({...a, [v.label]: v}), {}));
export const builtin_constants: Array<{[key: string]: Documentation}> = source.map(version => version.filter(doc => doc.meta === "const").reduce((a, v) => ({...a, [v.label]: v}), {}));

export const autocomplete_labels = source.map(version => version.map((doc, idx): CompletionItem => {
	return {
		label: doc.label,
		labelDetails: { detail: ` (${doc.meta})` },
		detail: doc.title,
		documentation: {
			kind: MarkupKind.Markdown,
			value: doc.description
		},
		kind: doc.meta === "const" ? CompletionItemKind.Constant : CompletionItemKind.Function,
		data: { type: AUTOCOMPLETE_TYPES.BUILTIN, idx: idx, parameters: doc.parameters, optional_params: doc.optional_params, hasRestElement: doc.hasRestElement} as CompletionItemData,
		sortText: '' + AUTOCOMPLETE_TYPES.BUILTIN
	};
}));

export const module_autocomplete: CompletionItem[] = [];

for (const key in modules) {
	const module = modules[key as keyof typeof modules] as {[key: string]: Documentation}; 

	Object.values(module).forEach((doc, idx) => {
		module_autocomplete.push({
			label: doc.label,
			labelDetails: { detail: ` (${doc.meta})` },
			detail: doc.title,
			documentation: {
				kind: MarkupKind.Markdown,
				value: doc.description
			},
			kind: doc.meta === "const" ? CompletionItemKind.Constant : CompletionItemKind.Function,
			// @ts-ignore
			data: { type: AUTOCOMPLETE_TYPES.MODULE, idx: idx, module_name: key, parameters: doc.parameters, optional_params: doc.optional_params } as CompletionItemData,
			sortText: '' + AUTOCOMPLETE_TYPES.MODULE
		});
	});
}

export function moduleExists(module_name: string): boolean {
  return module_name in modules;
}

export function getImportedName(module_name: string, name: string): Documentation | undefined {
  if (module_name in modules) {
    const module = modules[module_name as keyof typeof modules] as {[key: string]: Documentation}; 
    return module[name];
  }
  return undefined;
}


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
    case 'ImportDeclaration':
      return node.specifiers.flatMap(getNodeChildren)
    case 'ImportSpecifier':
      return [node.imported, node.local]
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
export function rangeToSourceLoc(loc: Range): es.SourceLocation {
  return {
    start: {
      line: loc.start.line + 1,
      column: loc.start.character
    },
    end: {
      line: loc.end.line + 1,
      column: loc.end.character
    }
  }
}

export function vsPosToEsPos(pos: Position): es.Position {
  return { line: pos.line+1, column: pos.character }
}

export function mapDeclarationKindToSymbolKind(kind: DeclarationKind, context: Context): SymbolKind {
  switch (kind) {
    case DeclarationKind.KIND_IMPORT:
      return SymbolKind.Namespace;
    case DeclarationKind.KIND_FUNCTION:
      return SymbolKind.Function;
    case DeclarationKind.KIND_LET:
      return SymbolKind.Variable;
    case DeclarationKind.KIND_PARAM:
      return context.chapter === Chapter.SOURCE_1 || context.chapter === Chapter.SOURCE_2 ? SymbolKind.Constant : SymbolKind.Variable;
    case DeclarationKind.KIND_CONST:
      return SymbolKind.Constant
    default:
      return SymbolKind.Namespace;
  }
}

export function mapMetaToCompletionItemKind(meta: string) {
  switch (meta) {
    case "const":
      return CompletionItemKind.Constant;
    case "let":
      return CompletionItemKind.Variable;
    case "import":
      return CompletionItemKind.Module;
    default:
      return CompletionItemKind.Text;
  }
}


export function mapDeclarationSymbolToDocumentSymbol(declaration: DeclarationSymbol, context: Context): DocumentSymbol {
  return ({
    name: declaration.name,
    kind: mapDeclarationKindToSymbolKind(declaration.declarationKind, context),
    range: declaration.range,
    selectionRange: declaration.selectionRange,
    ...declaration.parameters && { children: declaration.parameters.map(x => mapDeclarationSymbolToDocumentSymbol(x, context)) }
  });
}

// Helper function to find which range ends later
export function findLastRange(r1: Range, r2: Range): Range {
  if (r1.end.line > r2.end.line) return r1;
  if (r1.end.line < r2.end.line) return r2;
  if (r1.end.character < r2.end.character) return r2;
  return r1;
}

export function before(first: es.Position, second: es.Position) {
  return first.line < second.line || (first.line === second.line && first.column <= second.column)
}

export function vsPosInSourceLoc(pos: Position, loc: es.SourceLocation) {
  const esPos: es.Position = vsPosToEsPos(pos);

  return before(loc.start, esPos) && before(esPos, loc.end);
}

export function sourceLocInSourceLoc(inner: es.SourceLocation, outer: es.SourceLocation) {
  return vsPosInSourceLoc({line: inner.start.line - 1, character: inner.start.column}, outer) && vsPosInSourceLoc({line: inner.end.line - 1, character: inner.end.column}, outer);
}

export function sourceLocEquals(s1: es.SourceLocation, s2: es.SourceLocation) {
  return s1.start.column === s2.start.column && s1.start.line === s2.start.line && s1.end.column === s2.end.column && s1.end.line === s2.end.line;
}

export function isBuiltinFunction(name: string, context: Context) {
  return name in builtin_functions[context.chapter-1];
}

export function isBuiltinConst(name: string, context: Context) {
  return name in builtin_constants[context.chapter-1];
}