import { Name } from './interfaces';

// expose(everyone)
export function foo() {
    console.log('foo called');
}

// expose(everyone)
export function getCurrentTime(): string {
    return new Date().toISOString();
}

// expose(everyone)
export function sum(params: { x: number; y?: number }): number {
    return params.x + (params.y || 0);
}

// expose(everyone)
export function subtract(params: { x: number; y: number }): number {
    return params.x - params.y;
}

// expose(everyone)
export function multiply(params: { x: number; y: number }): number {
    return params.x * params.y;
}

// expose(everyone)
export function greet(params: { name: Name }): string {
    const { first, middle, last } = params.name;
    return ['Hello', first, middle, last].filter((str) => str).join(' ');
}
