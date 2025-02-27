import { Chapter, Context, Node } from "js-slang/dist/types";
import { findDeclarationNode, findIdentifierNode } from "js-slang/dist/finder";
import { ArrowFunctionExpression, Identifier, ImportSpecifier, Program, RestElement, SourceLocation } from 'estree';
import { createAcornParserOptions, looseParse } from "js-slang/dist/parser/utils";
import { AUTOCOMPLETE_TYPES, DECLARATIONS, DeclarationSymbol, EXPRESSIONS, NODES, STATEMENTS } from "./types";
import { autocomplete_labels, findLastRange, getNodeChildren, imported_types, mapDeclarationSymbolToDocumentSymbol, mapMetaToCompletionItemKind, module_autocomplete, source_functions, sourceLocInSourceLoc, sourceLocToRange, VsPosInSourceLoc } from "./utils";
import { CompletionItem, Diagnostic, DiagnosticSeverity, DocumentHighlight, DocumentSymbol, Position, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { DeclarationKind } from "js-slang/dist/name-extractor";
import { getAllOccurrencesInScopeHelper } from "js-slang/dist/scope-refactoring";
import { AcornOptions } from "js-slang/dist/parser/types";
import { parse as acornParse } from 'acorn';
import { isDummy } from 'acorn-loose';

export const DEFAULT_ECMA_VERSION = 6;

export class AST {
  private ast: Node;
  private context: Context;
  private declarations: Map<string, Array<DeclarationSymbol>> = new Map();
  private imported_names: {
    [module_name: string]: Map<string, {range: Range, local: string }>
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
    // console.debug(JSON.stringify(this.ast, null, 2));

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
  }

  private processDiagnostics(child: Node, parent: Node) {
    // If else is used over switch cause of type checking
    if (child.type === STATEMENTS.EXPRESSION) {
      const expression = child.expression;
      if (expression.type === EXPRESSIONS.BINARY)
        this.checkIncompleteBinaryStatement(expression.left, expression.right, expression.loc!, "Incomplete binary expression");
      else if (expression.type === EXPRESSIONS.TERNARY)
        this.checkIncompleteBinaryStatement(expression.consequent, expression.alternate, expression.loc!, "Incomplete ternary");
      else if (expression.type === EXPRESSIONS.LITERAL) {
        if (typeof expression.value === "string") {
          if (expression.raw!.length < 2 || !expression.raw!.endsWith("\""))
            this.addDiagnostic("Incomplete string expression", DiagnosticSeverity.Error, expression.loc!);
        }
      }
    }

    else if (child.type === DECLARATIONS.VARIABLE) {
      child.declarations.forEach(declaration => {
        this.checkIncompleteBinaryStatement(declaration.id, declaration.init, child.loc!, "Incomplete variable declaration");
      })
    }

    else if (child.type === DECLARATIONS.FUNCTION) {
      if (this.isDummy(child.id))
        this.addDiagnostic("Missing function name", DiagnosticSeverity.Error, child.loc!)

      let hasRestElement = false;
      for (const param of child.params) {
        if (hasRestElement) {
          this.addDiagnostic("No params allowed after rest element", DiagnosticSeverity.Error, { start: param.loc!.start, end: child.params[child.params.length - 1].loc!.end });
          break;
        }

        hasRestElement = param.type === "RestElement";
      }

      const paramNames = new Set();
      for (const param of child.params) {
        if (param.type === NODES.IDENTIFIER || (param.type === NODES.REST && param.argument.type === NODES.IDENTIFIER)) {
          const name = param.type === NODES.IDENTIFIER ? param.name : (param.argument as Identifier).name;

          if (paramNames.has(name))
            this.addDiagnostic("No duplicate param names", DiagnosticSeverity.Error, param.loc!);
          else
            paramNames.add(name);
        }
      }
    }

    else if (child.type === EXPRESSIONS.CALL) {
      if (child.callee.type === NODES.IDENTIFIER) {
        this.addDiagnosticCallback((child: Node) => {
          const callee = child as Identifier;
          const declaration = this.findDeclarationByName(callee.name, callee.loc!)
          if (declaration !== undefined && declaration.meta !== "func" && !(callee.name in source_functions[this.context.chapter - 1]))
            this.addDiagnostic(`'${callee.name}' is not a function`, DiagnosticSeverity.Error, callee.loc!);
        }, child.callee);
      }
    }

    else if (child.type === NODES.IDENTIFIER && parent.type !== DECLARATIONS.IMPORT) {
      this.addDiagnosticCallback((child: Node) => {
        const identifier = child as Identifier;
        const declaration = this.findDeclarationByName(identifier.name, identifier.loc!)
        if (declaration === undefined && !(identifier.name in source_functions[this.context.chapter - 1]))
          this.addDiagnostic(`'${identifier.name}' not declared`, DiagnosticSeverity.Error, identifier.loc!);
      }, child)
    }
  }

  private addDiagnosticCallback(callback: (child: Node) => void, child: Node): void {
    this.diagnosticsCallbacks.push([callback, child]);
  }

  private checkIncompleteBinaryStatement(left: any, right: any, loc: SourceLocation, message: string) {
    if (left === null || right === null || (left.type === NODES.IDENTIFIER && isDummy(left)) || (right.type === NODES.IDENTIFIER && isDummy(right))) {
      this.addDiagnostic(message, DiagnosticSeverity.Error, loc);
    }
  }

  // Wrapper around isDummy due to type checking issues
  private isDummy(node: any) {
    return isDummy(node);
  }

  private addDiagnostic(message: string, severity: DiagnosticSeverity, loc: SourceLocation) {
    this.diagnostics.push({
      message: message,
      severity: severity,
      range: sourceLocToRange(loc)
    })
  }

  private processDeclarations(child: Node, parent: Node) {
    if (child.type === DECLARATIONS.IMPORT) {
      const module_name = child.source.value as string
      if (imported_types.has(module_name)) {
        if (!this.imported_names[module_name]) this.imported_names[module_name] = new Map();

        child.specifiers.forEach(specifier => {
          // Namespace and default imports are not allowed
          if (specifier.type === NODES.IMPORT_SPECIFIER) {
            const real_name = (specifier.imported as Identifier).name;
            const name = specifier.local.name;
            if (imported_types.get(module_name)!.has(real_name)) {
              this.imported_names[module_name].set(real_name, {range: sourceLocToRange(specifier.loc!), local: name});
              this.addDeclaration(name, {
                type: "declaration",
                name: name,
                scope: parent.loc!,
                meta: imported_types.get(module_name)!.get(real_name)!,
                declarationKind: DeclarationKind.KIND_IMPORT,
                range: sourceLocToRange(child.loc!),
                selectionRange: sourceLocToRange(specifier.loc!)
              })
            }
          }
        })
      }
    }

    else if (child.type === DECLARATIONS.VARIABLE) {
      child.declarations.forEach(declaration => {
        const name = (declaration.id as Identifier).name;
        const variableDeclaration: DeclarationSymbol = {
          type: "declaration",
          name: name,
          scope: parent.loc!,
          meta: child.kind === "var" || child.kind === "let" ? "let" : "const",
          declarationKind: child.kind === "var" || child.kind === "let" ? DeclarationKind.KIND_LET : DeclarationKind.KIND_CONST,
          range: sourceLocToRange(declaration.loc!),
          selectionRange: sourceLocToRange(declaration.id.loc!),
        }
        this.addDeclaration(name, variableDeclaration);


        if (declaration.init && declaration.init.type == DECLARATIONS.LAMBDA) {
          const lambda = declaration.init as ArrowFunctionExpression;
          if (lambda.params.length !== 0) variableDeclaration.parameters = [];

          lambda.params.forEach(param => {
            const name = (param as Identifier).name;
            const param_declaration: DeclarationSymbol = {
              type: "declaration",
              name: name,
              scope: lambda.body.loc!,
              meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
              declarationKind: DeclarationKind.KIND_PARAM,
              range: sourceLocToRange(param.loc!),
              selectionRange: sourceLocToRange(param.loc!),
              showInDocumentSymbols: false
            }
            variableDeclaration.parameters!.push(param_declaration);
            this.addDeclaration(name, param_declaration);
          })
        }
      })
    }

    else if (child.type === DECLARATIONS.FUNCTION) {
      const name = child.id!.name;
      const functionDeclaration: DeclarationSymbol = {
        type: "declaration",
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
        if (param.type === NODES.IDENTIFIER) {
          const name = (param as Identifier).name;
          const param_declaration: DeclarationSymbol = {
            type: "declaration",
            name: name,
            scope: child.body.loc!,
            meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
            declarationKind: DeclarationKind.KIND_PARAM,
            range: sourceLocToRange(param.loc!),
            selectionRange: sourceLocToRange(param.loc!),
            showInDocumentSymbols: false
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
          type: "declaration",
          name: name,
          scope: child.body.loc!,
          meta: this.context.chapter == Chapter.SOURCE_1 || this.context.chapter === Chapter.SOURCE_2 ? "const" : "let",
          declarationKind: DeclarationKind.KIND_PARAM,
          range: sourceLocToRange(param.loc!),
          selectionRange: sourceLocToRange(param.loc!)
        }
        this.addDeclaration(name, param_declaration);
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

  private findDeclarationByName(name: string, loc: SourceLocation): DeclarationSymbol | undefined {
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
    const identifier = findIdentifierNode(this.ast, this.context, { line: pos.line + 1, column: pos.character });
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