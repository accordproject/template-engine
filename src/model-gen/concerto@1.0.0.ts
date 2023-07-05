/* eslint-disable @typescript-eslint/no-empty-interface */
// Generated code for namespace: concerto@1.0.0

// imports

// Warning: Beware of circular dependencies when modifying these imports
import type {
	CodeType,
	ICode
} from './org.accordproject.templatemark@0.5.0';
import type {
	INode,
	IAttribute,
	ITagInfo
} from './org.accordproject.commonmark@0.5.0';
import type {
	IPosition,
	IRange,
	ITypeIdentifier,
	IDecoratorLiteral,
	IDecorator,
	IIdentified,
	IDeclaration,
	IMapKeyType,
	IAggregateValueType,
	IEnumProperty,
	IProperty,
	IStringRegexValidator,
	IStringLengthValidator,
	IDoubleDomainValidator,
	IIntegerDomainValidator,
	ILongDomainValidator,
	IImport,
	IModel,
	IModels
} from './concerto.metamodel@1.0.0';

// interfaces
export interface IConcept {
   $class: string;
}

export type ConceptUnion = ICode | 
INode | 
IAttribute | 
ITagInfo | 
IPosition | 
IRange | 
ITypeIdentifier | 
IDecoratorLiteral | 
IDecorator | 
IIdentified | 
IDeclaration | 
IMapKeyType | 
IAggregateValueType | 
IEnumProperty | 
IProperty | 
IStringRegexValidator | 
IStringLengthValidator | 
IDoubleDomainValidator | 
IIntegerDomainValidator | 
ILongDomainValidator | 
IImport | 
IModel | 
IModels;

export interface IAsset extends IConcept {
   $identifier: string;
}

export interface IParticipant extends IConcept {
   $identifier: string;
}

export interface ITransaction extends IConcept {
   $timestamp: Date;
}

export interface IEvent extends IConcept {
   $timestamp: Date;
}

