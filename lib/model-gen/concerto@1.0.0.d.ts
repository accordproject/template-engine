import type { ICode } from './org.accordproject.templatemark@0.5.0';
import type { INode, IAttribute, ITagInfo } from './org.accordproject.commonmark@0.5.0';
import type { IPosition, IRange, ITypeIdentifier, IDecoratorLiteral, IDecorator, IIdentified, IDeclaration, IMapKeyType, IAggregateValueType, IEnumProperty, IProperty, IStringRegexValidator, IStringLengthValidator, IDoubleDomainValidator, IIntegerDomainValidator, ILongDomainValidator, IImport, IModel, IModels } from './concerto.metamodel@1.0.0';
export interface IConcept {
    $class: string;
}
export type ConceptUnion = ICode | INode | IAttribute | ITagInfo | IPosition | IRange | ITypeIdentifier | IDecoratorLiteral | IDecorator | IIdentified | IDeclaration | IMapKeyType | IAggregateValueType | IEnumProperty | IProperty | IStringRegexValidator | IStringLengthValidator | IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | IImport | IModel | IModels;
export interface IAsset extends IConcept {
    $identifier: string;
}
export interface IParticipant extends IConcept {
    $identifier: string;
}
export interface ITransaction extends IConcept {
    $timestamp: string;
}
export interface IEvent extends IConcept {
    $timestamp: string;
}
