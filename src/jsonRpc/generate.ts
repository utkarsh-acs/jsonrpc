import fs from 'fs';
import path from 'path';
import * as url from 'url';
import ts from 'typescript';

const currFolder = path.dirname(url.fileURLToPath(import.meta.url));
const modulesFolder = path.resolve(currFolder, '../modules');
const outFolder = path.join(currFolder, 'out');

const modules = new Map<
    string,
    {
        interfaces: string[];
        functions: Map<
            string,
            {
                name: string;
                paramsType: string;
                returnType: string;
                exposeTo: string;
            }[]
        >;
    }
>();

function start() {
    console.log('Processing exposed interfaces & functions');
    if (fs.existsSync(outFolder)) {
        fs.rmSync(outFolder, { recursive: true, force: true });
    }
    fs.mkdirSync(outFolder);
    parseFiles();
    generateFiles();
}

function parseFiles() {
    fs.readdirSync(modulesFolder).forEach((module) => {
        const modulePath = path.join(modulesFolder, module);
        if (fs.lstatSync(modulePath).isDirectory()) {
            modules.set(module, {
                interfaces: [],
                functions: new Map<
                    string,
                    {
                        name: string;
                        paramsType: string;
                        returnType: string;
                        exposeTo: string;
                    }[]
                >()
            });
            parseFolder(module, modulePath);
        }
    });
}

function parseFolder(module: string, folderPath: string) {
    fs.readdirSync(folderPath).forEach((file) => {
        const filePath = path.join(folderPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            parseFolder(module, filePath);
            return;
        }
        if (path.extname(filePath) === '.ts') {
            parseFile(module, filePath);
        }
    });
}

function parseFile(module: string, filePath: string) {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.ES2020);
    ts.forEachChild(sourceFile, (node) => {
        if (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
            if (commentRanges?.length) {
                const comments: string[] = commentRanges.map((comment) =>
                    sourceFile.text.slice(comment.pos, comment.end)
                );
                comments.forEach((comment) => {
                    comment = comment.trim();
                    const matches = comment.match(/\/\/[\s]*expose/);
                    if (matches?.length) {
                        if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
                            exposeInterface(module, sourceFile, node as ts.InterfaceDeclaration);
                        } else if (node.kind === ts.SyntaxKind.FunctionDeclaration) {
                            const matches = comment.match(/\/\/[\s]*expose\(([a-z]+)\)/);
                            exposeFunction(
                                module,
                                sourceFile,
                                node as ts.FunctionDeclaration,
                                matches ? matches[1] : undefined
                            );
                        }
                    }
                });
            }
        }
    });
}

function exposeInterface(module: string, sourceFile: ts.SourceFile, node: ts.InterfaceDeclaration) {
    const name = node.name!.escapedText.toString();
    console.log(`Exposing interface ${module}.${name}`);
    let exposedInterface = sourceFile.text.slice(node.pos, node.end);
    exposedInterface = exposedInterface.trim();
    exposedInterface = exposedInterface.slice(exposedInterface.search('interface')).trim();
    modules.get(module)?.interfaces.push(exposedInterface);
}

function exposeFunction(module: string, sourceFile: ts.SourceFile, node: ts.FunctionDeclaration, exposeTo?: string) {
    const name = node.name!.escapedText.toString();
    const accessSpecifiers = ['everyone'];
    if (!exposeTo || !accessSpecifiers.includes(exposeTo)) {
        console.log(`Exposed function ${name} should have one the access specifiers ${accessSpecifiers.join(', ')}.`);
        return;
    }
    if (node.parameters.length > 1) {
        console.log(`Exposed function ${name} cannot have more than one parameter.`);
        return;
    }
    let paramsType = '';
    if (node.parameters.length) {
        const parameter = node.parameters[0] as ts.ParameterDeclaration;
        const parameterType = parameter.type as ts.TypeLiteralNode;
        paramsType = sourceFile.text.slice(parameterType.pos, parameterType.end);
    }
    let returnType = '';
    if (node.type) {
        returnType = sourceFile.text.slice(node.type.pos, node.type.end);
    }
    const filePathInsideModule = path.relative(path.join(modulesFolder, module), sourceFile.fileName);
    if (!modules.get(module)?.functions.has(filePathInsideModule)) {
        modules.get(module)?.functions.set(filePathInsideModule, []);
    }
    console.log(`Exposing function ${module}.${name} to ${exposeTo}`);
    modules.get(module)?.functions.get(filePathInsideModule)?.push({
        name,
        paramsType,
        returnType,
        exposeTo
    });
}

function generateFiles() {
    const interfacesFolder = path.join(outFolder, 'interfaces');
    fs.mkdirSync(interfacesFolder);
    for (const module of modules.keys()) {
        generateInterfacesFile(module, path.join(interfacesFolder, `${module}.ts`));
    }
    generateInterfacesIndexFile(path.join(interfacesFolder, 'index.ts'));
    const jsonRpcToFunctionsFolder = path.join(outFolder, 'jsonRpcToFunctions');
    fs.mkdirSync(jsonRpcToFunctionsFolder);
    for (const module of modules.keys()) {
        generateJsonRpcToFunctionsFile(module, path.join(jsonRpcToFunctionsFolder, `${module}.ts`));
    }
    generateJsonRpcToFunctionsIndexFile(path.join(jsonRpcToFunctionsFolder, 'index.ts'));
    const functionsToJsonRpcFolder = path.join(outFolder, 'functionsToJsonRpc');
    fs.mkdirSync(functionsToJsonRpcFolder);
    for (const module of modules.keys()) {
        generateFunctionsToJsonRpcFile(module, path.join(functionsToJsonRpcFolder, `${module}.ts`));
    }
    generateServerFile(path.join(functionsToJsonRpcFolder, 'server.ts'));
    generateFunctionsToJsonRpcIndexFile(path.join(functionsToJsonRpcFolder, 'index.ts'));
}

function generateInterfacesFile(module: string, file: string) {
    fs.writeFileSync(file, ``);
    modules.get(module)?.interfaces.forEach((exposedInterface) => {
        fs.appendFileSync(file, `export ${exposedInterface}\n`);
    });
    modules.get(module)?.functions.forEach((arr) => {
        arr.forEach((exposedFunction) => {
            if (exposedFunction.paramsType) {
                fs.appendFileSync(
                    file,
                    `export interface ${exposedFunction.name}_params ${exposedFunction.paramsType.trim()}\n`
                );
            }
        });
    });
}

function generateJsonRpcToFunctionsFile(module: string, file: string) {
    fs.writeFileSync(file, `/* eslint-disable @typescript-eslint/no-explicit-any */\n`);
    fs.appendFileSync(file, `import { InvalidRequest } from '../../handler';\n`);
    modules.get(module)?.functions.forEach((arr, filePathInsideModule) => {
        fs.appendFileSync(
            file,
            `import { ${arr
                .map((exposedFunction) => exposedFunction.name)
                .join(', ')} } from '../../../modules/${module}/${filePathInsideModule
                .substring(0, filePathInsideModule.length - 3)
                .replace(path.sep, '/')}';\n`
        );
    });
    fs.appendFileSync(file, `\n`);
    fs.appendFileSync(file, `export async function call(functionName: string, params?: any): Promise<any> {\n`);
    fs.appendFileSync(file, `    switch (functionName) {\n`);
    modules.get(module)?.functions.forEach((arr) => {
        arr.forEach((exposedFunction) => {
            fs.appendFileSync(file, `        case '${exposedFunction.name}':\n`);
            fs.appendFileSync(
                file,
                `            return await ${exposedFunction.name}(${exposedFunction.paramsType ? 'params' : ''});\n`
            );
        });
    });
    fs.appendFileSync(file, `        default:\n`);
    fs.appendFileSync(file, `            throw new InvalidRequest('Invalid JSON-RPC method');\n`);
    fs.appendFileSync(file, `    }\n`);
    fs.appendFileSync(file, `}\n`);
}

function generateInterfacesIndexFile(file: string) {
    fs.writeFileSync(file, `import { ICheckerSuite, createCheckers } from 'ts-interface-checker';\n`);
    for (const module of modules.keys()) {
        fs.appendFileSync(file, `import ${module} from './${module}-ti';\n`);
    }
    fs.appendFileSync(file, `const interfaceCheckers = new Map<string, ICheckerSuite>();\n`);
    for (const module of modules.keys()) {
        fs.appendFileSync(file, `interfaceCheckers.set('${module}', createCheckers(${module}))\n`);
    }
    fs.appendFileSync(file, `export default interfaceCheckers;\n`);
}

function generateJsonRpcToFunctionsIndexFile(file: string) {
    fs.writeFileSync(file, `import { InvalidRequest } from '../../handler';\n`);
    for (const module of modules.keys()) {
        fs.appendFileSync(file, `import { call as ${module} } from './${module}';\n`);
    }
    fs.appendFileSync(file, `\n`);
    fs.appendFileSync(
        file,
        `export async function call(module: string, functionName: string, params?: any): Promise<any> {\n`
    );
    fs.appendFileSync(file, `    switch (module) {\n`);
    for (const module of modules.keys()) {
        fs.appendFileSync(file, `        case '${module}':\n`);
        fs.appendFileSync(file, `            return await ${module}(functionName, params);\n`);
    }
    fs.appendFileSync(file, `        default:\n`);
    fs.appendFileSync(file, `            throw new InvalidRequest('Invalid JSON-RPC method');\n`);
    fs.appendFileSync(file, `    }\n`);
    fs.appendFileSync(file, `}\n`);
}

function generateFunctionsToJsonRpcFile(module: string, file: string) {
    fs.writeFileSync(file, `import { callJsonRpcMethod } from './server';\n`);
    modules.get(module)?.interfaces.forEach((exposedInterface) => {
        fs.appendFileSync(file, `\n`);
        fs.appendFileSync(file, `export ${exposedInterface}\n`);
    });
    modules.get(module)?.functions.forEach((arr) => {
        arr.forEach((exposedFunction) => {
            fs.appendFileSync(file, `\n`);
            fs.appendFileSync(
                file,
                `export async function ${exposedFunction.name}(${
                    exposedFunction.paramsType && 'params: ' + exposedFunction.paramsType.trim()
                })${exposedFunction.returnType && ': Promise<' + exposedFunction.returnType.trim() + '>'} {\n`
            );
            fs.appendFileSync(
                file,
                `    ${exposedFunction.returnType && 'return '}await callJsonRpcMethod('${module}_${
                    exposedFunction.name
                }'${exposedFunction.paramsType && ', params'});\n`
            );
            fs.appendFileSync(file, `}\n`);
        });
    });
}

function generateServerFile(file: string) {
    fs.writeFileSync(file, `import { RpcParams } from 'jsonrpc-lite';\n`);
    fs.appendFileSync(
        file,
        `export async function callJsonRpcMethod(method: string, params?: RpcParams): Promise<any> {}\n`
    );
    fs.appendFileSync(file, `export async function setUrl(url: string) {}\n`);
}

function generateFunctionsToJsonRpcIndexFile(file: string) {
    fs.writeFileSync(file, `export * as server from './server';\n`);
    for (const module of modules.keys()) {
        fs.appendFileSync(file, `export * as ${module} from './${module}';\n`);
    }
}

start();
