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
	RenameParams,
	WorkspaceEdit,
	TextEdit
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import source from './docs/source.json'
import modules from "./docs/modules/modules.json";

import { findDeclaration, createContext, getAllOccurrencesInScope } from 'js-slang'
import { Chapter, Variant } from 'js-slang/dist/types'
import { looseParse, parseWithComments } from 'js-slang/dist/parser/utils'
import { getAllNames, mapDeclarationKindToSymbolKind, sourceLocToRange } from './utils';
import { getProgramNames } from 'js-slang/dist/name-extractor';


enum AUTOCOMPLETE_TYPES {
	BUILTIN,
	SYMBOL,
	MODULE
}

const chapter_names = {
	"Source 1": Chapter.SOURCE_1,
	"Source 2": Chapter.SOURCE_2,
	"Source 3": Chapter.SOURCE_3,
	"Source 4": Chapter.SOURCE_4
}

const autocomplete_labels = source.map(version => version.map((doc, idx): CompletionItem => {
	return {
		label: doc.label,
		labelDetails: {detail: ` (${doc.meta})`},
		kind: doc.meta === "const" ? CompletionItemKind.Constant : CompletionItemKind.Function, 
		data: [AUTOCOMPLETE_TYPES.BUILTIN, idx]
	}
}));

const module_autocomplete: CompletionItem[] = [];

for (const key in modules) {
	const module = modules[key as keyof typeof modules];

	module.forEach((doc, idx) => {
		module_autocomplete.push({
			label: doc.label,
			labelDetails: {detail: ` (${doc.meta})`},
			kind: doc.meta === "const" ? CompletionItemKind.Constant : CompletionItemKind.Function, 
			data: [AUTOCOMPLETE_TYPES.MODULE, idx, key]
		})
	})
}

console.debug(module_autocomplete);

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
			documentSymbolProvider: true,
			renameProvider: true
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
	async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
		const document = documents.get(textDocumentPosition.textDocument.uri);
		if (!document) return [];

		const text = document.getText();
		const pos = textDocumentPosition.position;
		const [program, comments] = parseWithComments(text)

		const [names, _success] = await getProgramNames(program, comments, {line: pos.line+1, column: pos.character});

		const new_labels: CompletionItem[] = names.map((name, idx) => ({
			label: name.name,
			labelDetails: {detail: ` (${name.meta})`},
			kind: CompletionItemKind.Text,
			data: AUTOCOMPLETE_TYPES.SYMBOL
		}))

		const temp = autocomplete_labels[source_version-1].concat(module_autocomplete).concat(new_labels);
		console.debug(temp);
		return temp;
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data[0] === AUTOCOMPLETE_TYPES.BUILTIN || item.data[0] === AUTOCOMPLETE_TYPES.MODULE) {
			const doc = item.data[0] === AUTOCOMPLETE_TYPES.BUILTIN ? source[source_version-1][item.data[1]] : modules[item.data[2] as keyof typeof modules][item.data[1]];
			item.detail = doc.title;
			item.documentation = {
				kind: MarkupKind.Markdown,
				value: doc.description
			};
			if (doc.meta === "func") {
				// @ts-ignore
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
	if (!document) return null;
  
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
	if (!document) return null;

	const text = document.getText();
	const position = params.position;

	const occurences = getAllOccurrencesInScope(text, createContext(source_version, Variant.DEFAULT), { line: position.line+1, column: position.character });

	return occurences.map(loc => ({
		range: sourceLocToRange(loc)
	}));
})

connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const text = document.getText();
	const names = await getAllNames(looseParse(text, createContext(source_version, Variant.DEFAULT)));
	
	return names.map(name => ({
		...name,
		kind: mapDeclarationKindToSymbolKind(name.kind)
	}));
})

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const text = document.getText();
	const position = params.position;

	const occurences = getAllOccurrencesInScope(text, createContext(source_version, Variant.DEFAULT), { line: position.line+1, column: position.character });

	if (occurences.length === 0) {
		return null;
	}

	return {
		changes: {
			[params.textDocument.uri]: occurences.map(loc => TextEdit.replace(sourceLocToRange(loc), params.newName))
		}
	};
})


// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();