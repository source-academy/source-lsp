import { DeclarationKind } from "js-slang/dist/name-extractor";
import { Node } from "js-slang/dist/types";
import { Range } from "vscode-languageserver/node";
import * as es from 'estree';

// Note that the order the enum fields appear in determine the order they are displayed in the autocomplete list
export enum AUTOCOMPLETE_TYPES {
	BUILTIN,
	SYMBOL,
	MODULE
}

export enum DECLARATIONS {
    VARIABLE = "VariableDeclaration",
    FUNCTION = "FunctionDeclaration",
    IMPORT = "ImportDeclaration"
}

export interface DeclarationSymbol {
    name: string,
    scope: es.SourceLocation,
    meta: "const" | "let" | "func",
    declarationKind: DeclarationKind,
    range: Range,
    selectionRange: Range,
    children?: Array<ReferenceSymbol>
}

export interface ReferenceSymbol {
    name: string,
    range: Range
}

export interface ProgramSymbols {
    name: string,
    kind: DeclarationKind,
    range: Range,
    selectionRange: Range,
}

export interface ImportedSymbols extends ProgramSymbols {
    module_name: string
}

export interface NodeToSymbol {
    type: string,
    callback: (node: Node) => ProgramSymbols[]
}

export interface CompletionItemData {
    type: AUTOCOMPLETE_TYPES,
    idx: number
    module_name?: string,
    parameters?: string[]
}

export interface ModuleSymbolSpecifier {
    name: string,
    module_name: string
}

export interface ImportedNameRanges {
    name: string,
    range: Range
}

export interface ModuleImportRanges {
    type: "import",
    module_name: string,
    imports: ImportedNameRanges[]
}

export interface FunctionSymbol {
    type: "function",
    name: string,
    params: string[]
}