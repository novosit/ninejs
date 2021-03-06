import Properties from '../ext/Properties';
export interface Operator {
    name: string;
    operator?: (a: any, b: any) => boolean;
    reductor?: (a: any, b: any) => boolean;
    dataTypeList?: string[];
}
export interface Summary {
    name: string;
    dataTypeList: (item: any) => boolean;
    action?: (data: any) => any;
    postAction?: (values: any[], side: string, fn: (val: any) => boolean) => boolean;
}
export interface RecordContext {
    name: string;
    value: any;
}
declare class Expression extends Properties {
    constructor(args: any);
    operator: string;
    operatorList: {
        [name: string]: Operator;
    };
    summaryList: {
        [name: string]: Summary;
    };
    isNegative: boolean;
    source: any;
    sourceSummary: string;
    target: any;
    targetSummary: string;
    expressionList: Expression[];
    where: Expression;
    ambiguous: boolean;
    _formatValue(val: any, isVariable?: boolean, forDisplay?: boolean): any;
    sourceValueGetter(): any;
    sourceValueForDisplay(): any;
    targetValueGetter(): any;
    targetValueForDisplay(): any;
    toString(): any;
    _buildGetterFunction(src: string): (data: any, recordContextStack: RecordContext[], where: Expression) => any;
    sourceFieldSetter(src: string): void;
    targetFieldSetter(src: string): void;
    ambiguousSetter(val: boolean): void;
    filter(arr: any[], recordContextStack?: RecordContext[]): any[];
    evaluate(data: any, recordContextStack?: RecordContext[]): boolean;
    involvedSourcesGetter(): string[];
    reset(): void;
    clone(): Expression;
    toJson(): any;
    fromJson(data: any): void;
    hasSource(): boolean;
    hasTarget(): boolean;
    isValid(): boolean;
}
export default Expression;
