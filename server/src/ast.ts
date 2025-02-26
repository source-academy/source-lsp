import { Chapter, Context, Node, SourceError } from "js-slang/dist/types";
import { findDeclarationNode, findIdentifierNode } from "js-slang/dist/finder";
import { Identifier, ImportSpecifier, Program, SourceLocation } from 'estree';
import { createAcornParserOptions, looseParse } from "js-slang/dist/parser/utils";
import { AUTOCOMPLETE_TYPES, DECLARATIONS, DeclarationSymbol } from "./types";
import { autocomplete_labels, findLastRange, getNodeChildren, mapDeclarationSymbolToDocumentSymbol, mapMetaToCompletionItemKind, module_autocomplete, sourceLocInSourceLoc, sourceLocToRange, VsPosInSourceLoc } from "./utils";
import { CompletionItem, Diagnostic, DiagnosticSeverity, DocumentHighlight, DocumentSymbol, Position, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { getAllOccurrencesInScopeHelper } from "js-slang/dist/scope-refactoring";
import { AcornOptions } from "js-slang/dist/parser/types";
import { parse as acornParse } from 'acorn';

export const DEFAULT_ECMA_VERSION = 6;

export class AST {
  private ast: Node;
  private context: Context;
  private declarations: Map<string, Array<DeclarationSymbol>> = new Map();
  private imported_names: {
    [module_name: string]: Map<string, Range>
  } = {};
  private uri: string;
  public diagnostics: Diagnostic[] = [];

  constructor(text: string, context: Context, uri: string) {
    const acornOptions: AcornOptions = createAcornParserOptions(
      DEFAULT_ECMA_VERSION,
      undefined,
      {
        onInsertedSemicolon: (pos, loc) => {
          this.diagnostics.push({
            message: "Missing Semicolon",
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: loc!.line - 1, character: loc!.column },
              end: { line: loc!.line - 1, character: loc!.column + 1 }
            }
          })
        },
        onTrailingComma: (pos, loc) => {
          this.diagnostics.push({
            message: "Trailing Comma",
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: loc!.line - 1, character: loc!.column },
              end: { line: loc!.line - 1, character: loc!.column + 1 }
            }
          })
        },
        locations: true,
      }
    )

    try {
      this.ast = acornParse(text, acornOptions) as Node
    }
    catch (e) {
      this.ast = looseParse(text, context) as Node
    }

    this.context = context;
    this.uri = uri;

    const queue: Node[] = [this.ast];
    while (queue.length > 0) {
      const parent = queue.shift()!;

      // We iterate over the children here to maintain the parent pointer to store the scope.
      getNodeChildren(parent).forEach((child: Node) => {
        if (child.type === DECLARATIONS.IMPORT) {
          const module_name = child.source.value as string
          if (!this.imported_names[module_name]) this.imported_names[module_name] = new Map();

          child.specifiers.forEach(specifier => {
            const name = ((specifier as ImportSpecifier).imported as Identifier).name;
            this.imported_names[module_name].set(name, sourceLocToRange(specifier.loc!));
            this.addDeclaration(name, {
              name: name,
              scope: parent.loc!,
              meta: "const",
              declarationKind: DeclarationKind.KIND_IMPORT,
              range: sourceLocToRange(child.loc!),
              selectionRange: sourceLocToRange(specifier.loc!)
            })
          })
        }

        else if (child.type === DECLARATIONS.VARIABLE) {
          child.declarations.forEach(declaration => {
            const name = (declaration.id as Identifier).name;
            this.addDeclaration(name, {
              name: name,
              scope: parent.loc!,
              meta: child.kind === "var" || child.kind === "let" ? "let" : "const",
              declarationKind: child.kind === "var" || child.kind === "let" ? DeclarationKind.KIND_LET : DeclarationKind.KIND_CONST,
              range: sourceLocToRange(declaration.loc!),
              selectionRange: sourceLocToRange(declaration.id.loc!)
            });
          })
        }

        else if (child.type === DECLARATIONS.FUNCTION) {
          const name = child.id!.name;
          const functionDeclaration: DeclarationSymbol = {
            name: name,
            scope: parent.loc!,
            meta: "func",
            declarationKind: DeclarationKind.KIND_FUNCTION,
            range: sourceLocToRange(child.loc!),
            selectionRange: sourceLocToRange(child.id!.loc!),
            parameters: []
          }
          this.addDeclaration(name, functionDeclaration);

          child.params.forEach(param => {
            const name = (param as Identifier).name;
            const param_declaration: DeclarationSymbol = {
              name: name,
              scope: child.body.loc!,
              meta: context.chapter == Chapter.SOURCE_1 || context.chapter === Chapter.SOURCE_2 ? "const" : "let",
              declarationKind: DeclarationKind.KIND_PARAM,
              range: sourceLocToRange(param.loc!),
              selectionRange: sourceLocToRange(param.loc!)
            }
            functionDeclaration.parameters?.push(param_declaration);
          })

          queue.push(child.body);
        }

        else {
          queue.push(child);
        }
      })
    }
  }

  private addDeclaration(name: string, declaration: DeclarationSymbol): void {
    if (!this.declarations.has(name)) this.declarations.set(name, []);
    this.declarations.get(name)!.push(declaration);
  }

  public findDeclaration(pos: Position): SourceLocation | null | undefined {
    const identifier = findIdentifierNode(this.ast, this.context, { line: pos.line + 1, column: pos.character });
    if (!identifier) return null;

    const declaration = findDeclarationNode(this.ast, identifier);
    if (!declaration) return null;

    return declaration.loc;
  }

  public getOccurences(pos: Position): DocumentHighlight[] {
    const identifier = findIdentifierNode(this.ast, this.context, { line: pos.line + 1, column: pos.character });
    if (!identifier) return [];

    const declaration = findDeclarationNode(this.ast, identifier);
    if (!declaration) return [];

    return getAllOccurrencesInScopeHelper(declaration.loc!, this.ast as Program, identifier.name).map(loc => ({ range: sourceLocToRange(loc) }));
  }

  public getDocumentSymbols(): DocumentSymbol[] {

    let ret: DocumentSymbol[] = []
    this.declarations.forEach((value, key) => {
      ret = ret.concat(value.map((declaration: DeclarationSymbol): DocumentSymbol => mapDeclarationSymbolToDocumentSymbol(declaration, this.context)))
    })

    return ret;
  }

  public renameSymbol(pos: Position, newName: string): WorkspaceEdit | null {
    const occurences = this.getOccurences(pos);
    if (occurences.length === 0) return null;

    return {
      changes: {
        [this.uri]: occurences.map(loc => TextEdit.replace(loc.range, newName))
      }
    };
  }

  public getCompletionItems(pos: Position): CompletionItem[] {
    let ret: CompletionItem[] = [];
    this.declarations.forEach(value => {
      // Find the most specific scope
      let mostSpecificDeclaration: DeclarationSymbol | undefined;
      value.forEach(declaration => {
        if (declaration.declarationKind != DeclarationKind.KIND_IMPORT && VsPosInSourceLoc(pos, declaration.scope)) {
          if (mostSpecificDeclaration === undefined || sourceLocInSourceLoc(declaration.scope, mostSpecificDeclaration.scope)) {
            mostSpecificDeclaration = declaration
          }
        }
      })

      if (mostSpecificDeclaration) {
        ret.push({
          label: mostSpecificDeclaration.name,
          labelDetails: { detail: ` (${mostSpecificDeclaration.meta})` },
          kind: mapMetaToCompletionItemKind(mostSpecificDeclaration.meta),
          data: {
            type: AUTOCOMPLETE_TYPES.SYMBOL,
            ...mostSpecificDeclaration.parameters && { parameters: mostSpecificDeclaration.parameters.map(x => x.name) }
          },
          sortText: '' + AUTOCOMPLETE_TYPES.SYMBOL
        })
      }
    })

    return autocomplete_labels[this.context.chapter - 1]
      .concat(ret)
      .concat(module_autocomplete.map((item: CompletionItem): CompletionItem => {
        if (this.imported_names[item.data.module_name]) {
          if (this.imported_names[item.data.module_name].has(item.label)) {
            return {
              ...item,
              detail: `Imported from ${item.data.module_name}`,
              data: { type: AUTOCOMPLETE_TYPES.SYMBOL, ...item.data }
            };
          }
          else {
            // Not sure if the map preserves the order that names were inserted
            let last_imported_range: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
            this.imported_names[item.data.module_name].forEach(range => {
              last_imported_range = findLastRange(last_imported_range, range);
            });
            return {
              ...item,
              additionalTextEdits: [
                TextEdit.insert(last_imported_range.end, `, ${item.label}`)
              ]
            };
          };
        }
        else return {
          ...item,
          additionalTextEdits: [
            TextEdit.insert({ line: 0, character: 0 }, `import { ${item.label} } from "${item.data.module_name};"\n`)
          ]
        };
      }));
  }
}