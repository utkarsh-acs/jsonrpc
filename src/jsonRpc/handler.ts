import jsonrpc from 'jsonrpc-lite';
import interfaces from './out/interfaces';
import { call } from './out/jsonRpcToFunctions';

export class InvalidRequest extends Error {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handle(request: any) {
    const parsedObj = jsonrpc.parseObject(request);
    if (!parsedObj || parsedObj.type !== 'request') throw new InvalidRequest('Invalid JSON-RPC format');
    if (parsedObj.payload.jsonrpc !== '2.0') throw new InvalidRequest('Invalid JSON-RPC version');
    const method = parsedObj.payload.method;
    const methodSplit = method.split('_');
    if (methodSplit.length !== 2) throw new InvalidRequest('Invalid JSON-RPC method');
    const module = methodSplit[0];
    const functionName = methodSplit[1];
    if (!interfaces.has(module)) throw new InvalidRequest('Invalid JSON-RPC method');
    const params = parsedObj.payload.params;
    const checkerSuite = interfaces.get(module)!;
    if (checkerSuite[`${functionName}_params`]) {
        if (!checkerSuite[`${functionName}_params`].test(params)) {
            throw new InvalidRequest('Invalid JSON-RPC method params format');
        }
    }
    const result = await call(module, functionName, params);
    return jsonrpc.success(parsedObj.payload.id, result === undefined ? null : result);
}
