import { Range } from "vscode-languageserver/node";
import * as es from 'estree';

// Note that the order the enum fields appear in determine the order they are displayed in the autocomplete list
export enum AUTOCOMPLETE_TYPES {
	BUILTIN,
	SYMBOL,
	MODULE
}

export enum NODES {
    IDENTIFIER = "Identifier",
    REST = "RestElement",
    SPREAD = "SpreadElement",
    LITERAL = "Literal",
    IMPORT_SPECIFIER = "ImportSpecifier",
    TEMPLATE_LITERAL = "TemplateLiteral"
}

export enum DECLARATIONS {
    VARIABLE = "VariableDeclaration",
    FUNCTION = "FunctionDeclaration",
    IMPORT = "ImportDeclaration",
    LAMBDA = "ArrowFunctionExpression"
}

export enum STATEMENTS {
    EXPRESSION = "ExpressionStatement",
    FOR = "ForStatement",
    IF = "IfStatement",
    WHILE = "WhileStatement",
    BLOCK = "BlockStatement",
    BREAK = "BreakStatement",
    CONTINUE = "ContinueStatement",
    RETURN = "ReturnStatement"
}

export enum EXPRESSIONS {
    BINARY = "BinaryExpression",
    UNARY = "UnaryExpression",
    CONDITIONAL = "ConditionalExpression",
    CALL = "CallExpression",
    ASSIGNMENT = "AssignmentExpression",
    MEMBER = "MemberExpression",
    ARRAY = "ArrayExpression"
}


// Taken from js-slang
export enum DeclarationKind {
  KIND_IMPORT = 'import',
  KIND_FUNCTION = 'func',
  KIND_LET = 'let',
  KIND_PARAM = 'param',
  KIND_CONST = 'const',
  KIND_KEYWORD = 'keyword'
}

export interface DeclarationSymbol {
    name: string,
    scope: es.SourceLocation,
    meta: "const" | "let" | "func",
    declarationKind: DeclarationKind,
    range: Range,
    selectionRange: Range,
    parameters?: Array<ParameterSymbol>,
    showInDocumentSymbols?: boolean;
    unused: boolean
}

export interface ParameterSymbol extends DeclarationSymbol {
    isRestElement: boolean
}

export interface ImportedSymbol extends DeclarationSymbol {
    module_name: string,
    real_name: string
}

export interface Documentation {
    label: string,
    title: string,
    description: string,
    meta: "const" | "func",
    parameters?: string[],
    optional_params?: string[],
    hasRestElement? : boolean
}

export interface CompletionItemData {
    type: AUTOCOMPLETE_TYPES,
    idx: number
    module_name?: string,
    parameters?: string[],
    optional_params?: string[],
    hasRestElement?: boolean
}