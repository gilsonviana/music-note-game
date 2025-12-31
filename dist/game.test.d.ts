/**
 * Tests for Music Note Game
 * Run with: npx ts-node game.test.ts
 */
declare class TestRunner {
    tests: Array<{
        description: string;
        fn: (runner: TestRunner) => void;
    }>;
    passed: number;
    failed: number;
    test(description: string, fn: (runner: TestRunner) => void): void;
    assert(condition: boolean, message?: string): void;
    assertEqual(actual: any, expected: any, message?: string): void;
    assertDeepEqual(actual: any, expected: any, message?: string): void;
    run(): boolean;
}
declare const runner: TestRunner;
declare const success: boolean;
