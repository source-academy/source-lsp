// @ts-check

import fs from 'fs/promises';
import pathlib from "path";
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import patches from "./patches.json" with { type: "json" };

const CONST_DECL = "const";
const FUNC_DECL = "func";

const BASE_URL = "https://docs.sourceacademy.org"
const SRC_FILENAME = "global.html"
const OUT_DIR = "./"

const TARGETS = [
  "source_1",
  "source_2",
  "source_3",
  "source_4",
]

const FINAL_TARGET = "source";

const turndownService = new TurndownService();

function newTitleNode(title, document) {
  const node = document.createElement('h4');
  const text = document.createTextNode(title);
  node.appendChild(text);
  return node;
}

function buildDescriptionMarkdown(div) {
  return turndownService.turndown(div.outerHTML.replace('/\n+/', '\n'));
}

function processConstant(names, element, document) {
  const header = element.getElementsByTagName('h4')[0];
  const rawName = header.textContent;
  const fields = rawName.split(' ').slice(1)

  let title = fields.join('');
  const name = header.getAttribute('id');
  if (!title) {
    title = name;
  }

  const titleNode = newTitleNode(title, document);
  const descriptionNode = element.getElementsByClassName('description')[0];

  const descriptionDiv = document.createElement('div');
  descriptionDiv.appendChild(titleNode);
  descriptionDiv.appendChild(descriptionNode);
  const markdown = buildDescriptionMarkdown(descriptionDiv);

  names.push({ label: name, title, description: markdown, meta: CONST_DECL });
}

function processFunction(names, element, document) {
  const header = element.getElementsByTagName('h4')[0];
  const title = header.textContent;
  const name = header.getAttribute('id');

  const titleNode = newTitleNode(title, document);
  const descriptionNode = element.getElementsByClassName('description')[0];

  const descriptionDiv = document.createElement('div');
  descriptionDiv.appendChild(titleNode);
  descriptionDiv.appendChild(descriptionNode);
  const html = buildDescriptionMarkdown(descriptionDiv);

  const params = (Object.keys(patches["rename_params"])).includes(name) ? patches["rename_params"][name] : [...title.matchAll(/\w+\(([^)]*)\)/g)][0][1].split(",").map(s => s.trim());
  const autocomplete = { label: name, title, description: html, meta: FUNC_DECL, parameters: params[0] === '' ? [] : params };

  if (Object.keys(patches["optional_params"]).includes(name))
    autocomplete["optional_params"] = patches["optional_params"][name];
  if (patches["hasRestElement"].includes(name))
    autocomplete["hasRestElement"] = true;


  names.push(autocomplete);
}

async function processDirGlobals(global, target, index) {
  const url = `${BASE_URL}/${target}/${SRC_FILENAME}`;
  let document;
  try {
    const contents = await (await fetch(url)).text();
    document = new JSDOM(contents.toString()).window.document;
  } catch (err) {
    console.error(url, "failed", err);
    return err;
  }

  const names = [];

  const constants = document.getElementsByClassName("constant-entry");
  Array.prototype.forEach.call(constants, ele => processConstant(names, ele, document));

  const functions = document.getElementsByClassName('function-entry')
  Array.prototype.forEach.call(functions, ele => processFunction(names, ele, document));

  const outFile = pathlib.join(OUT_DIR, target + '.json');
  await fs.writeFile(outFile, JSON.stringify(names, null, 2), 'utf-8')
  global[index] = (names);
  return undefined
}

await fs.mkdir(OUT_DIR, { recursive: true })

const global = [];
// Exit with error code if the there was some error
const errors = await Promise.all(TARGETS.map((x, i) => processDirGlobals(global, x, i)));
if (errors.find(each => each !== undefined)) process.exit(1);
const outFile = pathlib.join(OUT_DIR, FINAL_TARGET + '.json');
await fs.writeFile(outFile, JSON.stringify(global, null, 2), 'utf-8')

console.log('Finished processing autocomplete documentation')
