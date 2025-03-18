import { Chapter, Context } from "js-slang/dist/types";
import { findDeclarationNode, findIdentifierNode } from "js-slang/dist/finder";
import { CallExpression, Identifier, Literal, Program, SourceLocation, Node } from 'estree';
import { createAcornParserOptions, looseParse } from "js-slang/dist/parser/utils";
import { AUTOCOMPLETE_TYPES, DECLARATIONS, DeclarationSymbol, Documentation, EXPRESSIONS, ImportedSymbol, NODES, ParameterSymbol, STATEMENTS } from "./types";
import { autocomplete_labels, before, builtin_constants, builtin_functions, findLastRange, getImportedName, getNodeChildren, isBuiltinConst, isBuiltinFunction, mapDeclarationSymbolToDocumentSymbol, mapMetaToCompletionItemKind, module_autocomplete, moduleExists, rangeToSourceLoc, sourceLocEquals, sourceLocInSourceLoc, sourceLocToRange, vsPosInSourceLoc, vsPosToEsPos } from "./utils";
import { CompletionItem, Diagnostic, DiagnosticSeverity, DiagnosticTag, DocumentHighlight, DocumentSymbol, Hover, Position, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { getAllOccurrencesInScopeHelper } from "js-slang/dist/scope-refactoring";
import { AcornOptions } from "js-slang/dist/parser/types";
import { parse as acornParse } from 'acorn';
import { rules, bannedNodes } from "./rules";

export const DEFAULT_ECMA_VERSION = 6;

export class AST {
  private ast: Node;
  private context: Context;
  private declarations: Map<string, Array<DeclarationSymbol>> = new Map();
  private imported_names: {
    [module_name: string]: Map<string, { range: Range, local: string }>
  } = {};
  private uri: string;
  private diagnostics: Diagnostic[] = [];
  // Array of callbacks to call once parsing is done
  // Needed for things like checking if an variable name has already been declared
  private diagnosticsCallbacks: Array<[(child: Node) => void, Node]> = [];

  constructor(text: string, context: Context, uri: string) {
    const acornOptions: AcornOptions = createAcornParserOptions(
      DEFAULT_ECMA_VERSION,
      undefined,
      {
        onInsertedSemicolon: (pos, loc) => {
          this.diagnostics.push({
            message: "Missing semicolon",
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: loc!.line - 1, character: loc!.column },
              end: { line: loc!.line - 1, character: loc!.column + 1 }
            },
          })
        },
        onTrailingComma: (pos, loc) => {
          this.diagnostics.push({
            message: "Trailing comma",
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
    console.debug(JSON.stringify(this.ast, null, 2));

    this.context = context;
    this.uri = uri;

    const queue: Node[] = [this.ast];
    while (queue.length > 0) {
      const parent = queue.shift()!;

      // We iterate over the children here to maintain the parent pointer to store the scope.
      getNodeChildren(parent).forEach((child: Node) => {
        this.processDeclarations(child, parent);
        this.processDiagnostics(child, parent);
        queue.push(child);
      })
    }

    this.diagnosticsCallbacks.forEach(val => {
      val[0](val[1]);
    })

    this.declarations.forEach(declarationList => {
      for (let i = 0; i < declarationList.length; i++) {
        const declaration = declarationList[i]
        if (declaration.unused)
          this.addDiagnostic("Unused name", DiagnosticSeverity.Warning, rangeToSourceLoc(declaration.selectionRange), [DiagnosticTag.Unnecessary]);
      }
    })
    // this.declarations.forEach(x => console.debug(JSON.stringify(x, null, 2)));
  }

  private processDiagnostics(child: Node, parent: Node) {
    if (bannedNodes.has(child.type))
      this.addDiagnostic(`${child.type} is not allowed`, DiagnosticSeverity.Error, child.loc!);
    else
      rules.get(child.type)?.process(child, parent, this.context, this);
  }

  public addDiagnosticCallback(callback: (child: Node) => void, child: Node): void {
    this.diagnosticsCallbacks.push([callback, child]);
  }

  public checkIncompleteLeftRightStatement(left: any, right: any, loc: SourceLocation, message: string) {
    if (left === null || right === null || (left.type === NODES.IDENTIFIER && this.isDummy(left)) || (right.type === NODES.IDENTIFIER && this.isDummy(right))) {
      this.addDiagnostic(message, DiagnosticSeverity.Error, loc);
    }
  }

  public isDummy(node: Identifier | Literal): boolean {
    const dummy = "✖"
    if (node.type === NODES.IDENTIFIER)
      return node.name === dummy;
    if (node.type === NODES.LITERAL)
      return node.value === dummy
    return false;
  }

  public addDiagnostic(message: string, severity: DiagnosticSeverity, loc: SourceLocation, tags: DiagnosticTag[] = []) {
    this.diagnostics.push({
      message: message,
      severity: severity,
      range: sourceLocToRange(loc),
      tags: tags
    })
  }

  private processDeclarations(child: Node, parent: Node) {
    if (child.type === DECLARATIONS.IMPORT) {
      const module_name = child.source.value as string
      if (moduleExists(module_name)) {
        if (!this.imported_names[module_name]) this.imported_names[module_name] = new Map();

        child.specifiers.forEach(specifier => {
          // Namespace and default imports are not allowed
          if (specifier.type === NODES.IMPORT_SPECIFIER) {
            if (specifier.imported.type === "Identifier") {
              const real_name = specifier.imported.name;
              const name = specifier.local.name;
              let imported: Documentation | undefined;
              if ((imported = getImportedName(module_name, real_name)) !== undefined) {
                this.imported_names[module_name].set(real_name, { range: sourceLocToRange(specifier.loc!), local: name });
                const declaration: ImportedSymbol = {
                  name: name,
                  scope: parent.loc!,
                  meta: imported.meta,
                  declarationKind: DeclarationKind.KIND_IMPORT,
                  range: sourceLocToRange(child.loc!),
                  selectionRange: sourceLocToRange(specifier.loc!),
                  module_name: module_name,
                  real_name: real_name,
                  unused: true,
                }
                this.addDeclaration(name, declaration)
              }
            }
          }
          else
            this.addDiagnostic("Only normal imports are allowed", DiagnosticSeverity.Error, specifier.loc!)
        })
      }
    }

    else if (child.type === DECLARATIONS.VARIABLE) {
      child.declarations.forEach(declaration => {
        if (declaration.id.type === NODES.IDENTIFIER) {

          const name = declaration.id.name;
          const variableDeclaration: DeclarationSymbol = {
            name: name,
            scope: parent.loc!,
            meta: child.kind === "var" || child.kind === "let" ? "let" : "const",
            declarationKind: child.kind === "var" || child.kind === "let" ? DeclarationKind.KIND_LET : DeclarationKind.KIND_CONST,
            range: sourceLocToRange(declaration.loc!),
            selectionRange: sourceLocToRange(declaration.id.loc!),
            unused: true
          }
          this.addDeclaration(name, variableDeclaration);


          if (declaration.init && declaration.init.type == DECLARATIONS.LAMBDA) {
            const lambda = declaration.init;
            if (lambda.params.length !== 0) variableDeclaration.parameters = [];

            lambda.params.forEach(param => {
              if (param.loc) {
                const loc = param.loc;
                let name = "";
                if (param.type === NODES.IDENTIFIER)
                  name = param.name
                else if (param.type === NODES.REST && param.argument.type === NODES.IDENTIFIER)
                  name = param.argument.name
                else {
                  this.addDiagnostic("Unexpected token", DiagnosticSeverity.Error, loc);
                  return;
                }
                const param_declaration: ParameterSymbol = {
                  name: name,
                  scope: lambda.body.loc!,
                  meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
                  declarationKind: DeclarationKind.KIND_PARAM,
                  range: sourceLocToRange(param.loc!),
                  selectionRange: sourceLocToRange(param.loc!),
                  showInDocumentSymbols: false,
                  isRestElement: param.type === NODES.REST,
                  unused: true
                }
                variableDeclaration.parameters!.push(param_declaration);
                this.addDeclaration(name, param_declaration);
              }
            })
          }
        }
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
        parameters: [],
        unused: true
      }
      this.addDeclaration(name, functionDeclaration);

      child.params.forEach(param => {
        if (param.loc) {
          const loc = param.loc;
          let name = "";
          if (param.type === NODES.IDENTIFIER)
            name = param.name
          else if (param.type === NODES.REST && param.argument.type === NODES.IDENTIFIER)
            name = param.argument.name
          else {
            this.addDiagnostic("Unexpected token", DiagnosticSeverity.Error, loc);
            return;
          }
          const param_declaration: ParameterSymbol = {
            name: name,
            scope: child.body.loc!,
            meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
            declarationKind: DeclarationKind.KIND_PARAM,
            range: sourceLocToRange(loc),
            selectionRange: sourceLocToRange(loc),
            showInDocumentSymbols: false,
            isRestElement: param.type === NODES.REST,
            unused: true
          }
          functionDeclaration.parameters!.push(param_declaration);
          this.addDeclaration(name, param_declaration);
        }
      })
    }
    // Handle anonymous lambdas
    else if (child.type === DECLARATIONS.LAMBDA && parent.type !== DECLARATIONS.VARIABLE) {
      child.params.forEach(param => {
        const name = (param as Identifier).name;
        const param_declaration: DeclarationSymbol = {
          name: name,
          scope: child.body.loc!,
          meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
          declarationKind: DeclarationKind.KIND_PARAM,
          range: sourceLocToRange(param.loc!),
          selectionRange: sourceLocToRange(param.loc!),
          unused: true
        }
        this.addDeclaration(name, param_declaration);
      })
    }
  }

  private addDeclaration(name: string, declaration: DeclarationSymbol): void {
    if (!this.declarations.has(name)) this.declarations.set(name, []);
    const declarations = this.declarations.get(name)!
    if (declarations.some(x => sourceLocEquals(x.scope, declaration.scope)))
      this.addDiagnostic(`Identifier '${name}' has already been declared`, DiagnosticSeverity.Error, rangeToSourceLoc(declaration.selectionRange))
    else
      declarations.push(declaration);
  }

  public findDeclaration(pos: Position): SourceLocation | null | undefined {
    const identifier = findIdentifierNode(this.ast, this.context, { line: pos.line + 1, column: pos.character });
    if (!identifier) return null;

    const declaration = findDeclarationNode(this.ast, identifier);
    if (!declaration) return null;

    return declaration.loc;
  }

  public findDeclarationByName(name: string, loc: SourceLocation): DeclarationSymbol | undefined {
    if (this.declarations.has(name)) {
      let mostSpecificDeclaration: DeclarationSymbol | undefined;
      this.declarations.get(name)!.forEach(declaration => {
        if (sourceLocInSourceLoc(loc, declaration.scope) && (mostSpecificDeclaration === undefined || sourceLocInSourceLoc(declaration.scope, mostSpecificDeclaration.scope)))
          mostSpecificDeclaration = declaration;
      })

      return mostSpecificDeclaration;
    }
    else return undefined;
  }

  public getOccurences(pos: Position): DocumentHighlight[] {
    const identifier = findIdentifierNode(this.ast, this.context, vsPosToEsPos(pos));
    if (!identifier) return [];

    const declaration = findDeclarationNode(this.ast, identifier);
    if (!declaration) return [];

    return getAllOccurrencesInScopeHelper(declaration.loc!, this.ast as Program, identifier.name).map(loc => ({ range: sourceLocToRange(loc) }));
  }

  public getDocumentSymbols(): DocumentSymbol[] {

    let ret: DocumentSymbol[] = []
    this.declarations.forEach((value, key) => {
      ret = ret.concat(value.filter(x => x.showInDocumentSymbols !== false).map((declaration: DeclarationSymbol): DocumentSymbol => mapDeclarationSymbolToDocumentSymbol(declaration, this.context)))
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

  public onHover(pos: Position): Hover | null {
    const identifier = findIdentifierNode(this.ast, this.context, vsPosToEsPos(pos));
    let value: string | undefined = undefined;
    if (identifier) {
      const declaration = this.findDeclarationByName(identifier.name, identifier.loc!);
      if (declaration) {
        if (declaration.declarationKind === DeclarationKind.KIND_IMPORT) {
          const importedDeclaration = declaration as ImportedSymbol
          value = getImportedName(importedDeclaration.module_name, importedDeclaration.real_name)!.description
        }
        else value = declaration.meta === "func" ? "Function" :
          declaration.meta === "const" ? "Constant" :
            declaration.meta === "let" ? "Variable" : undefined;
      }
      else if (isBuiltinConst(identifier.name, this.context))
        value = builtin_constants[this.context.chapter - 1][identifier.name].description
      else if (isBuiltinFunction(identifier.name, this.context))
        value = builtin_functions[this.context.chapter - 1][identifier.name].description
    }
    if (value === undefined)
      return null;
    else return {
      contents: {
        kind: "markdown",
        value: value
      }
    }
  }

  public getCompletionItems(pos: Position): CompletionItem[] {
    let ret: CompletionItem[] = [];
    this.declarations.forEach(value => {
      // Find the most specific scope
      let mostSpecificDeclaration: DeclarationSymbol | undefined;
      value.forEach(declaration => {
        if (declaration.declarationKind != DeclarationKind.KIND_IMPORT && vsPosInSourceLoc(pos, declaration.scope)) {
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
              label: this.imported_names[item.data.module_name].get(item.label)!.local,
              detail: `Imported from ${item.data.module_name}`,
              data: { type: AUTOCOMPLETE_TYPES.SYMBOL, ...item.data }
            };
          }
          else {
            // Not sure if the map preserves the order that names were inserted
            let last_imported_range: Range = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
            this.imported_names[item.data.module_name].forEach(range => {
              last_imported_range = findLastRange(last_imported_range, range.range);
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
            TextEdit.insert({ line: 0, character: 0 }, `import { ${item.label} } from "${item.data.module_name}";\n`)
          ]
        };
      }));
  }

  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics.map(diagnostic => ({
      ...diagnostic,
      source: `Source ${this.context.chapter}`
    }))
  }
}
