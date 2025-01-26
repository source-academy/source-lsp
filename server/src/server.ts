import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	MarkupKind,
	InsertTextFormat,
	Range,
	DocumentHighlightParams,
	DocumentSymbolParams,
	DocumentSymbol,
	SymbolKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import source from '../docs/source.json'

import { findDeclaration, createContext, getAllOccurrencesInScope } from 'js-slang'
import { Chapter, Node, Variant } from 'js-slang/dist/types'
import { looseParse } from 'js-slang/dist/parser/utils'
import { ProgramSymbols } from './types';
import { getNodeChildren, mapDeclarationKindToSymbolKind, sourceLocToRange } from './utils';
import { DeclarationKind } from 'js-slang/dist/name-extractor';
import { Identifier } from 'js-slang/dist/typeChecker/tsESTree'


const autocomplete_labels = source.map(version => version.map((doc, idx) => {
		return {
			label: doc.label,
			labelDetails: {detail: ` (${doc.meta})`},
			kind: CompletionItemKind.Text, 
			data: idx
		}
	})
);

const chapter_names = {
	"Source 1": Chapter.SOURCE_1,
	"Source 2": Chapter.SOURCE_2,
	"Source 3": Chapter.SOURCE_3,
	"Source 4": Chapter.SOURCE_4
}

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;
let source_version = 1;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			declarationProvider: true,
			documentHighlightProvider: true,
			documentSymbolProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});



function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}


// Custom request to set the language version
connection.onRequest("setLanguageVersion", (params: {version: string }) => {
	source_version = chapter_names[params.version as keyof typeof chapter_names];
	connection.console.log(`Set language version to ${params.version}`);
	return { success: true };
  });


// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: source_version + ''
				}
			];
		}
		diagnostics.push(diagnostic);
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VS Code
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		const document = documents.get(textDocumentPosition.textDocument.uri);
		if (!document) {
			return [];
		}

		const text = document.getText();
		const pos = textDocumentPosition.position;

		return autocomplete_labels[source_version-1];
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data < source[source_version].length) {
			const doc = source[source_version-1][item.data];
			item.detail = doc.title;
			item.documentation = {
				kind: MarkupKind.Markdown,
				value: doc.description
			};
			if (doc.meta === "func") {
				item.insertText = `${item.label}(${doc.parameters})`;
				item.insertTextFormat = InsertTextFormat.Snippet;
			}
		}

		return item;
	}
);

// This handler provides the declaration location of the name at the location provided
connection.onDeclaration(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
	  return null;
	}
  
	const text = document.getText();
	const position = params.position;
	const loc = {
		line: position.line+1,
		column: position.character
	}
	const context = createContext(source_version, Variant.DEFAULT);

	const result = findDeclaration(text, context, loc);

	if (result) {
		const range: Range = sourceLocToRange(result);

		return {
			uri: params.textDocument.uri,
			range
		};
	}
	else {
		return null;
	}
});

connection.onDocumentHighlight((params: DocumentHighlightParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}

	const text = document.getText();
	const position = params.position;

	const occurences = getAllOccurrencesInScope(text, createContext(source_version, Variant.DEFAULT), { line: position.line+1, column: position.character });

	return occurences.map(loc => ({
		range: sourceLocToRange(loc)
	}));
})


// The getNames function in js-slang has some issues, firstly it only get the names within a given scope, and it doesnt return the location of the name
// This implementation doesn't care where the cursor is, and grabs the name of all variables and functions
// @param prog Root node of the program, generated using looseParse
// @returns ProgramSymbols[]
async function getAllNames(prog: Node): Promise<ProgramSymbols[]> {
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
			console.debug(node);
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

connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return null;
	}

	const text = document.getText();
	const names = await getAllNames(looseParse(text, createContext(source_version, Variant.DEFAULT)));
	
	return names.map(name => ({
		...name,
		kind: mapDeclarationKindToSymbolKind(name.kind)
	}));
})


// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
