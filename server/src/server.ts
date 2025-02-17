import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	InsertTextFormat,
	Range,
	DocumentHighlightParams,
	DocumentSymbolParams,
	RenameParams,
	WorkspaceEdit,
	DocumentSymbol
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

import { createContext } from 'js-slang'
import { Chapter, Variant } from 'js-slang/dist/types'
import { sourceLocToRange } from './utils';

import { AST } from './ast';

const chapter_names = {
	"Source 1": Chapter.SOURCE_1,
	"Source 2": Chapter.SOURCE_2,
	"Source 3": Chapter.SOURCE_3,
	"Source 4": Chapter.SOURCE_4
};

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;
let context = createContext(Chapter.SOURCE_1, Variant.DEFAULT);

let astCache: Map<string, AST> = new Map();

function getAST(uri: string): AST {
	if(astCache.has(uri)) return astCache.get(uri)!;

	const ast = new AST(documents.get(uri)!.getText(), context, uri);
	astCache.set(uri, ast);
	return ast;
}

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
	};
	return result;
}


// Custom request to set the language version
connection.onRequest("setLanguageVersion", (params: { version: string }) => {
	if (Object.keys(chapter_names).includes(params.version)) {
		context = createContext(chapter_names[params.version as keyof typeof chapter_names], Variant.DEFAULT);
		astCache.clear();
		return { success: true };
	}
	else return {success: false};
});

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
let timeout: NodeJS.Timeout | undefined = undefined;
documents.onDidChangeContent(change => {
	if (timeout) clearTimeout(timeout); 
	timeout = setTimeout(() => {
		validateTextDocument(change.document);
		astCache.delete(change.document.uri);
	}, 300);
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
					message: "test"
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

		// const text = document.getText();
		// const pos = textDocumentPosition.position;

		// return getCompletionItems(text, pos, context);

		return getAST(textDocumentPosition.textDocument.uri).getCompletionItems(textDocumentPosition.position);
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
	if (item.data.parameters) {
		item.insertText = `${item.label}(${item.data.parameters.map((param: string, idx: number) => `\${${idx+1}:${param}}`)})`;
		item.insertTextFormat = InsertTextFormat.Snippet;
	};

	return item;
}
);



// This handler provides the declaration location of the name at the location provided
connection.onDeclaration(async (params) => {
	const position = params.position;

	const result = getAST(params.textDocument.uri).findDeclaration(position);

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

	return getAST(params.textDocument.uri).getOccurences(params.position);
})

connection.onDocumentSymbol(async (params: DocumentSymbolParams) : Promise<DocumentSymbol[] | null> => {
	return getAST(params.textDocument.uri).getDocumentSymbols();
})

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
	const document = documents.get(params.textDocument.uri);
	if (!document) return null;

	const position = params.position;

	return getAST(params.textDocument.uri).renameSymbol(position, params.newName);
})


// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();