import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import {
	commands,
	window
} from 'vscode'

let client: LanguageClient;
const SECTION = "\u00A7";

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join("dist", 'source-lsp.js')
	);

    let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'sourcejs' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		traceOutputChannel: window.createOutputChannel("source-lsp trace")
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

  // Start the client. This will also launch the server
  (async function () {
    console.log("Going to call client.start()");
    await client.start();
    console.log("client.start() called");
  })();

	context.subscriptions.push(
		commands.registerCommand("sourcejs.setLanguageVersion", async () => {
			const versions = [`Source ${SECTION}1`, `Source ${SECTION}2`, `Source ${SECTION}3`, `Source ${SECTION}4`]
			const selectedVersion = await window.showQuickPick(versions, {
				placeHolder: "Select the language version",
			});

			if (selectedVersion) {
				await setLanguageVersion(selectedVersion);
			}

		})
	)
}

// Function to send the version to the server
async function setLanguageVersion(version: string) {
	if (!client) {
	  window.showErrorMessage("Language server is not running.");
	  return;
	}
	try {
	  const response = await client.sendRequest("setLanguageVersion", { version });
	  window.showInformationMessage(`Language version set to ${version}`);
	} catch (error) {
	  window.showErrorMessage(`Failed to set language version: ${error}`);
	}
  }

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
