import { IConcept } from './concerto@1.0.0';
export interface IDecorator extends IConcept {
}
export interface IDotNetNamespace extends IDecorator {
    namespace: string;
}
