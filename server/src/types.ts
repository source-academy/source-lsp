import { Range } from "vscode-languageserver/node";
import * as es from 'estree';

/** 
 * Enum for differentiating between types of autocomplete, and also used for sorting the autocomplete items within the autocomplete list
*/
export enum AUTOCOMPLETE_TYPES {
    BUILTIN,
    KEYWORD,
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
    IMPORT = "ImportDeclaration"
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
    ARRAY = "ArrayExpression",
    LAMBDA = "ArrowFunctionExpression"
}

/**
 * Stores information about how that symbol was declared
 */
export interface DeclarationSymbol {
    /**
     * Name of the symbol, taken from the identifier
     */
    name: string,
    /**
     * Scope where the symbol can be used
     * Defined as a SourceLocation object, which has 1-index lines
     */
    scope: es.SourceLocation,
    /**
     * Meta information about the declaration
     * If a constant is declared with a lambda, it will be assigned func
     * If a let is declared with a lambda, it will still be assigned let as it can be reassigned later on
     */
    meta: "const" | "let" | "func",
    /**
     * More meta information about the declaration
     * Has some overlap with `meta`, could be combined in the future
     */
    declarationKind: DeclarationKind,
    /**
     * Range used only for highlighting purposes in DocumentSymbols, not really used anywhere else
     */
    range: Range,
    /**
     * Range representing the location for the identifier of this symbol.
     */
    selectionRange: Range,
    /**
     * Used for functions and lambdas to process child symbols in DocumentSymbols
     */
    parameters?: Array<ParameterSymbol>,
    /**
     * Flag whether to show this symbol in DocumentSymbols
     * As of now, only lambda and function params have this flag set to true, as they are already in the children of the function symbol
     */
    showInDocumentSymbols?: boolean;
    /**
     * Flags whether this symbol has been used or not.
     * Default should be set to true, then when an identifier for this declaration is found, flag can be set to false
     * Right now this check occurs in the identifierRule when parsing for error diagnostics
     */
    unused: boolean
}

export interface ParameterSymbol extends DeclarationSymbol {
    /**
     * Flag for whether this symbol is a rest element or not. Used for some diagnostics.
     */
    isRestElement: boolean
}

export interface ImportedSymbol extends DeclarationSymbol {
    /**
     * String representing the module name where this symbol was imported from
     */
    module_name: string,
    /**
     * String representing the actual defined name of this symbol in the module
     * This should be ImportSpecifier.imported.name
     * Not to be confused with ImportedSpecifier.local.name, which is the name for the DocumentSymbol this inherits from
     */
    real_name: string
}

/**
 * Represents documentation scraped from Source Academy docs
 */
export interface Documentation {
    /**
     * The name of the function/constant
     */
    label: string,
    /**
     * Title of the description for the documentation
     */
    title: string,
    /**
     * The whole description of this documentation
     */
    description: string,
    /**
     * Meta information whether this is a constant or a function
     */
    meta: "const" | "func",
    /**
     * String array of parameters if this is a function
     */
    parameters?: string[],
    /**
     * Strings for names of optional parameters
     */
    optional_params?: string[],
    /**
     * Flag whether the last parameter is a rest element
     * If so the function can take in any amount of parameters after the last one
     */
    hasRestElement?: boolean
}

/**
 * Interface for data to be stored within CompletionItems
 */
export interface CompletionItemData {
    /**
     * Type of autocomplete
     */
    type: AUTOCOMPLETE_TYPES,
    /**
     * Module name if AutoComplete comes from a Module, used for generating auto imports
     */
    module_name?: string,
    /**
     * String array if autocomplete is a function, used for generating autocomplete parameter snippets
     */
    parameters?: string[],
    /**
     * String array of optional parameters, used to ignore parameters in autocomplete snippet
     */
    optional_params?: string[]
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

export enum Chapter {
    SOURCE_1 = 1,
    SOURCE_2 = 2,
    SOURCE_3 = 3,
    SOURCE_4 = 4,
}

/**
 * Context for the file being edited
 */
export interface Context {
    /**
     * Source chapter for this file
     */
    chapter: Chapter,
    /**
     * Number of lines of text being prepended to the file
     */
    prepend?: number
}