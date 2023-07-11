// generated code, do not modify

// IMPORTS
import * as TemplateModel from './test@1.0.0';
import dayjs from 'dayjs';
import jp from 'jsonpath';
import {GenerationOptions} from './runtime/TypeScriptRuntime';

// FORMULAE
/// ---cut---
export function formula_53113a901ca88208df47bc83374866e8d497d84099c0f88123c918ff1960b17e(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return now.diff(lastVisit,'day')
}


/// ---cut---
export function formula_7841bd178366af21ea233d10968eaf538d12fb7a50cbaf9cbe1b51a00cb0f6a8(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   // test we can use typescript!
const addressBook:Map<string,string> = new Map<string,string>();
addressBook.set('123', 'Dan Selman');
addressBook.set('234', 'Isaac Selman');
addressBook.set('456', 'Tenzin Selman');
addressBook.set('789', 'Mi-a Selman');
let result = '';
addressBook.forEach((value, key) => {
   result += `[${key} : ${value}]`;
});
return result;
}


/// ---cut---
export function formula_4b8f7e95470eda90057c4648aac4e4c7abb3f93559ed348246b6a15ec1fea473(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return preferences.favoriteColors !== undefined ? preferences.favoriteColors.join(' and ') : 'No favorite colors!'
}


/// ---cut---
export function formula_a8a1d7714d95baa82f730e0105d2f2d0a9fc25ee9b6055058cc09667c01c01ab(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return jp.query(library, `$.clauses[?(@.category=="onboarding")]`);
}


/// ---cut---
export function formula_daca9cb2f5bc16b65f544e6f408c1e3121d50a3251ec4fbe2f27132818acc3d2(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return jp.query(library, `$.clauses[?(@.author=="${firstName}")]`);
}


/// ---cut---
export function formula_4c874b2977b5eef204e4987efc0a5594c7cce66403e54c17daa1e1c721d755a0(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return jp.query(library, `$.clauses[?(@.risk>4)]`);
}


/// ---cut---
export function formula_646a6cadec2125e4fd9e4b756aac72bc618b528967f04d325b28a817774441dd(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : any {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return jp.query(library, `$.clauses[?(@.risk<3 && @.author=="${firstName}")]`);
}



// CONDITIONALS
/// ---cut---
export function condition_nodes_0_nodes_1_nodes_5(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : boolean {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return lastName.startsWith('S')
}


/// ---cut---
export function condition_nodes_0_nodes_15_nodes_4_nodes_0(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : boolean {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return preferences.favoriteColors !== undefined && preferences.favoriteColors.includes('PINK')
}



// CLAUSES
/// ---cut---
export function condition_nodes_0_nodes_15(data:TemplateModel.ITemplateData, library:any, options:GenerationOptions) : boolean {
   const now = dayjs(options?.now);
   const locale = options?.locale;
   const firstName = data.firstName;
   const lastName = data.lastName;
   const middleNames = data.middleNames;
   const gender = data.gender;
   const active = data.active;
   const lastVisit = data.lastVisit;
   const address = data.address;
   const orders = data.orders;
   const loyaltyStatus = data.loyaltyStatus;
   const preferences = data.preferences;
   return preferences.favoriteColors !== undefined && preferences.favoriteColors.length > 0
}



